import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, getSql } from "../src/server/db/core";
import { cityWorkerHeartbeats } from "../src/server/db/schema";
import { claimJob, createExecution, enqueueRetention, failRun, finishRun, heartbeat, LeaseLostError, performRetention, renewLease } from "../src/server/city/jobs";
import { runAnalysis } from "../src/server/city/ai/runner";
import { CityError } from "../src/server/city/errors";
import type { JobLease } from "../src/server/city/job-contracts";
import { processSearchJob } from "../src/server/city/searches";
import { cityJobs } from "../src/server/db/schema";
import { and } from "drizzle-orm";

const workerId = process.env.CITY_WORKER_ID || `native-${randomUUID()}`;
const shutdown = new AbortController();
const running = new Set<AbortController>();
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  shutdown.abort(); for (const controller of running) controller.abort(new Error("WORKER_SHUTDOWN"));
});
function failureCode(error: unknown, signal: AbortSignal) {
  if (signal.aborted || (error instanceof Error && /timeout|deadline/i.test(error.name + error.message))) return "PROVIDER_TIMEOUT";
  if (error instanceof CityError) return ["AI_UNAVAILABLE", "PROVIDER_TIMEOUT", "STORAGE_UNAVAILABLE"].includes(error.code) ? error.code : "INVALID_AI_RESULT";
  let providerError = error;
  for (let depth=0; depth<3 && providerError && typeof providerError === "object"; depth++) {
    if ("statusCode" in providerError) {
      const status = Number(providerError.statusCode);
      if (status === 429) return "RATE_LIMITED";
      if ([401,403,404].includes(status) || status >= 500) return "AI_UNAVAILABLE";
    }
    providerError = "lastError" in providerError ? providerError.lastError : "cause" in providerError ? providerError.cause : null;
  }
  return "INVALID_AI_RESULT";
}
async function processOne() {
  const job = await claimJob(workerId);
  if (!job) return false;
  if (job.kind === "retention") { await performRetention(job); return true; }
  if (!job.ownerId || (job.kind === "analysis" && !job.runId)) return true;
  const controller = new AbortController(); running.add(controller);
  const deadline = setTimeout(() => controller.abort(new Error("RUN_DEADLINE")), Math.max(1, job.deadlineAt.getTime() - Date.now()));
  const lease: JobLease = { id: job.id, runId: job.runId ?? "", ownerId: job.ownerId, token: job.leaseToken, workerId, deadlineAt: job.deadlineAt, signal: controller.signal };
  let renewing = false;
  const renew = setInterval(async () => {
    if (renewing) return; renewing = true;
    try { if (!await renewLease(job.id, job.leaseToken)) controller.abort(new LeaseLostError()); }
    catch { controller.abort(new LeaseLostError()); }
    finally { renewing = false; }
  }, 10000);
  try {
    if (job.kind === "search") await processSearchJob(job, controller.signal);
    else {
      const execution = await createExecution(lease);
      const result = await runAnalysis(execution);
      await finishRun(lease, result);
    }
  } catch (error) {
    if (!shutdown.signal.aborted) {
      const code = failureCode(error, controller.signal);
      if (job.kind === "search") await getDb().update(cityJobs).set({ status: "failed", leaseUntil: null, errorCode: code }).where(and(eq(cityJobs.id, job.id), eq(cityJobs.leaseToken, job.leaseToken), eq(cityJobs.status, "running")));
      else await failRun(lease, code);
      console.error("city_run_failed", { runId: job.runId, code, name: error instanceof Error ? error.name : "unknown" });
    }
  } finally { clearTimeout(deadline); clearInterval(renew); running.delete(controller); }
  return true;
}
async function lane() {
  while (!shutdown.signal.aborted) {
    try { if (!await processOne()) await pause(650); }
    catch (error) { console.error("city_worker_retry", { name: error instanceof Error ? error.name : "unknown" }); await pause(2000); }
  }
}
async function main() {
  await heartbeat(workerId); await enqueueRetention();
  const beat = setInterval(() => { void heartbeat(workerId).catch(() => console.error("city_worker_heartbeat_failed")); }, 10000);
  const maintenance = setInterval(() => { void enqueueRetention().catch(() => console.error("city_worker_retention_enqueue_failed")); }, 60000);
  console.log("city_worker_ready", { revision: process.env.APP_REVISION || "local", aiConfigured: !!process.env.OPENAI_API_KEY });
  try { await Promise.all([lane(), lane()]); }
  finally {
    clearInterval(beat); clearInterval(maintenance);
    await getDb().delete(cityWorkerHeartbeats).where(eq(cityWorkerHeartbeats.id, workerId));
    await getSql().end();
  }
}
main().catch(error => { console.error("city_worker_start_failed", { name: error instanceof Error ? error.name : "unknown" }); process.exitCode = 1; });

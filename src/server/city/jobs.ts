import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb, type CityTx } from "@/server/db/core";
import { cityAnalyses, cityJobs, cityOwners, cityRateWindows, cityRuns, cityScenarios, citySearches, cityToolReceipts, cityWorkerHeartbeats } from "@/server/db/schema";
import { stableJson } from "@/features/city/search";
import type { JobLease, StoredRun, ToolExecution } from "./job-contracts";
import { appendEvent } from "./events";
import { CityError } from "./errors";

export class LeaseLostError extends Error { constructor() { super("LEASE_LOST"); } }
export async function withLease<T>(lease: JobLease, work: (tx: CityTx, run: StoredRun) => Promise<T>): Promise<T> {
  lease.signal.throwIfAborted();
  return getDb().transaction(async tx => {
    const [job] = await tx.select().from(cityJobs).where(eq(cityJobs.id, lease.id)).for("update");
    if (!job || job.leaseToken !== lease.token || job.status !== "running" || !job.leaseUntil || job.leaseUntil.getTime() <= Date.now() || job.deadlineAt.getTime() <= Date.now()) throw new LeaseLostError();
    const [run] = await tx.select().from(cityRuns).where(eq(cityRuns.id, lease.runId)).for("update");
    if (!run || run.status !== "running") throw new LeaseLostError();
    const [scope] = await tx.select({ deletedAt: cityScenarios.deletedAt, expiresAt: cityOwners.expiresAt }).from(cityScenarios)
      .innerJoin(cityOwners, eq(cityOwners.id, cityScenarios.ownerId))
      .where(and(eq(cityScenarios.id, run.scenarioId), eq(cityScenarios.ownerId, lease.ownerId)));
    if (!scope || scope.deletedAt || (scope.expiresAt && scope.expiresAt.getTime() <= Date.now())) throw new LeaseLostError();
    lease.signal.throwIfAborted();
    const result = await work(tx, run);
    lease.signal.throwIfAborted();
    return result;
  });
}

export async function claimJob(workerId: string) {
  return getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(81945071)`);
    const now = new Date();
    const expired = await tx.select().from(cityJobs).where(or(and(eq(cityJobs.status, "running"), lte(cityJobs.leaseUntil, now)), and(inArray(cityJobs.status, ["queued", "running"]), lte(cityJobs.deadlineAt, now)))).for("update", { skipLocked: true });
    for (const job of expired) {
      const retry = job.attempts < 2 && job.deadlineAt > now;
      await tx.update(cityJobs).set({ status: retry ? "queued" : "failed", errorCode: retry ? null : "PROVIDER_TIMEOUT", leaseUntil: null, workerId: null, leaseToken: job.leaseToken + 1 }).where(eq(cityJobs.id, job.id));
      if (job.runId) {
        const [changed] = await tx.update(cityRuns).set({ status: retry ? "queued" : "failed", errorCode: retry ? null : "PROVIDER_TIMEOUT" }).where(and(eq(cityRuns.id, job.runId), inArray(cityRuns.status, ["queued", "running"]))).returning();
        if (changed) await appendEvent(tx, job.runId, { kind: "status", status: retry ? "queued" : "failed", payload: retry ? { resumed: true } : { code: "PROVIDER_TIMEOUT" } });
      }
    }
    const running = await tx.select({ quotaKey: cityJobs.quotaKey }).from(cityJobs).where(and(eq(cityJobs.status, "running"), gt(cityJobs.leaseUntil, now)));
    if (running.length >= 2) return null;
    const due = await tx.select().from(cityJobs).where(and(eq(cityJobs.status, "queued"), lte(cityJobs.notBefore, now), gt(cityJobs.deadlineAt, now))).orderBy(asc(cityJobs.createdAt)).limit(30).for("update", { skipLocked: true });
    const job = due.find(item => !running.some(active => active.quotaKey === item.quotaKey));
    if (!job) return null;
    const [claimed] = await tx.update(cityJobs).set({ status: "running", workerId, attempts: job.attempts + 1, leaseToken: job.leaseToken + 1, leaseUntil: new Date(Date.now() + 30000) }).where(eq(cityJobs.id, job.id)).returning();
    if (job.runId) {
      const [run] = await tx.update(cityRuns).set({ status: "running", errorCode: null }).where(and(eq(cityRuns.id, job.runId), eq(cityRuns.status, "queued"))).returning();
      if (!run) { await tx.update(cityJobs).set({ status: "cancelled", leaseUntil: null }).where(eq(cityJobs.id, job.id)); return null; }
      await appendEvent(tx, run.id, { kind: "status", status: "running", payload: { resumed: claimed.attempts > 1 } });
    }
    return claimed;
  });
}
export async function renewLease(id: string, token: number) {
  const changed = await getDb().update(cityJobs).set({ leaseUntil: new Date(Date.now() + 30000) })
    .where(and(eq(cityJobs.id, id), eq(cityJobs.leaseToken, token), eq(cityJobs.status, "running"), gt(cityJobs.leaseUntil, new Date()), gt(cityJobs.deadlineAt, new Date()))).returning({ id: cityJobs.id });
  return changed.length > 0;
}

export async function createExecution(lease: JobLease): Promise<ToolExecution> {
  const run = await withLease(lease, async (_, row) => row);
  return {
    lease, run,
    async updateUsage(inputTokens: number, outputTokens: number) {
      const overBudget = await withLease(lease, async (tx, current) => {
        const usage = { inputTokens: current.usage.inputTokens + Math.max(0, inputTokens || 0), outputTokens: current.usage.outputTokens + Math.max(0, outputTokens || 0) };
        await tx.update(cityRuns).set({ usage }).where(eq(cityRuns.id, run.id));
        return usage.outputTokens > 4000;
      });
      if (overBudget) throw new CityError("INVALID_AI_RESULT", 503);
    },
    async tool<T, P = T>(name: string, input: unknown, prepare: () => Promise<P>, commit?: (tx: CityTx, prepared: P) => Promise<T>): Promise<T> {
      const allowed = ["readScenario", "readEvidence", "getAttribution", "comparePlans", "priceCondition", "applyAlternative", "validatePlan", "simulatePlan", "searchPlans", "saveAlternative", "saveAnalysis", "requestClarification"];
      if (!allowed.includes(name)) throw new CityError("INVALID_AI_RESULT", 503);
      const encoded = stableJson(input);
      if (Buffer.byteLength(encoded) > 65536) throw new CityError("INVALID_AI_RESULT", 503);
      const argumentHash = createHash("sha256").update(encoded).digest("hex");
      const existing = await withLease(lease, async (tx, current) => {
        const [receipt] = await tx.select().from(cityToolReceipts).where(and(eq(cityToolReceipts.runId, run.id), eq(cityToolReceipts.logicalStepId, name), eq(cityToolReceipts.argumentHash, argumentHash)));
        if (receipt) return receipt;
        const searches = name === 'priceCondition' ? 2 : name === 'searchPlans' ? 1 : 0;
        if (current.toolCount >= 8 || current.searchCount + searches > 3) throw new CityError("INVALID_AI_RESULT", 503);
        await tx.update(cityRuns).set({ toolCount: current.toolCount + 1, searchCount: current.searchCount + searches }).where(eq(cityRuns.id, run.id));
        const [created] = await tx.insert(cityToolReceipts).values({ id: randomUUID(), runId: run.id, logicalStepId: name, argumentHash, input, toolName: name, status: "started" }).returning();
        await appendEvent(tx, run.id, { kind: "tool", status: "started", toolName: name, payload: { receiptId: created.id } });
        return created;
      });
      if (existing.status === "completed") return existing.output as T;
      const prepared = await prepare();
      return withLease(lease, async tx => {
        const [receipt] = await tx.select().from(cityToolReceipts).where(eq(cityToolReceipts.id, existing.id));
        if (receipt.status === "completed") return receipt.output as T;
        const output = commit ? await commit(tx, prepared) : prepared as unknown as T;
        if (Buffer.byteLength(JSON.stringify(output)) > 256 * 1024) throw new CityError("INVALID_AI_RESULT", 503);
        await tx.update(cityToolReceipts).set({ status: "completed", output }).where(eq(cityToolReceipts.id, receipt.id));
        const failed = !!output && typeof output === "object" && (("ok" in output && output.ok === false) || ("value" in output && !!output.value && typeof output.value === "object" && "accepted" in output.value && output.value.accepted === false));
        await appendEvent(tx, run.id, { kind: "tool", status: failed ? "failed" : "completed", toolName: name, payload: { receiptId: receipt.id } });
        return output;
      });
    },
  };
}

export async function finishRun(lease: JobLease, result: { status: "completed" | "waiting_input"; question?: string }) {
  await withLease(lease, async (tx, run) => {
    if (result.status === "completed") {
      const [analysis] = await tx.select().from(cityAnalyses).where(and(eq(cityAnalyses.runId, run.id), eq(cityAnalyses.ownerId, run.ownerId)));
      if (!analysis) throw new CityError("INVALID_AI_RESULT", 503);
      if (run.procedure === "plan" && !run.alternativeRevisionIds.includes(analysis.document.candidateRevisionId ?? "")) {
        const [search] = await tx.select().from(citySearches).where(and(eq(citySearches.id, analysis.document.searchId ?? ""), eq(citySearches.runId, run.id), eq(citySearches.ownerId, run.ownerId)));
        if (!search || search.result.status !== "complete" || search.result.feasibleCount !== 0 || !analysis.document.relaxation) throw new CityError("INVALID_AI_RESULT", 503);
      }
    } else if (!(result.question || run.question)?.trim()) throw new CityError("INVALID_AI_RESULT", 503);
    await tx.update(cityRuns).set({ status: result.status, question: result.question ?? run.question, errorCode: null }).where(eq(cityRuns.id, run.id));
    await tx.update(cityJobs).set({ status: "completed", leaseUntil: null }).where(eq(cityJobs.id, lease.id));
    await appendEvent(tx, run.id, { kind: "status", status: result.status });
  });
}
export async function failRun(lease: JobLease, code: string) {
  // Deadline failure is allowed after lease expiry only for this still-current fencing token.
  await getDb().transaction(async tx => {
    const [job] = await tx.select().from(cityJobs).where(eq(cityJobs.id, lease.id)).for("update");
    if (!job || job.leaseToken !== lease.token || job.status !== "running") return;
    const [run] = await tx.select().from(cityRuns).where(eq(cityRuns.id, lease.runId)).for("update");
    if (!run || run.status !== "running") return;
    await tx.update(cityJobs).set({ status: "failed", leaseUntil: null }).where(eq(cityJobs.id, job.id));
    await tx.update(cityRuns).set({ status: "failed", errorCode: code }).where(eq(cityRuns.id, run.id));
    await appendEvent(tx, run.id, { kind: "status", status: "failed", payload: { code } });
  });
}
export async function heartbeat(workerId: string) {
  await getDb().insert(cityWorkerHeartbeats).values({ id: workerId, revision: process.env.APP_REVISION ?? "local", seenAt: new Date() })
    .onConflictDoUpdate({ target: cityWorkerHeartbeats.id, set: { seenAt: new Date(), revision: process.env.APP_REVISION ?? "local" } });
}
export async function enqueueRetention() {
  const hour = Math.floor(Date.now() / 3600000);
  await getDb().insert(cityJobs).values({ id: `retention:${hour}`, kind: "retention", quotaKey: "maintenance", deadlineAt: new Date(Date.now() + 120000) }).onConflictDoNothing();
}
export async function performRetention(job: typeof cityJobs.$inferSelect) {
  await getDb().transaction(async tx => {
    const [current] = await tx.select().from(cityJobs).where(eq(cityJobs.id, job.id)).for("update");
    if (!current || current.status !== "running" || current.leaseToken !== job.leaseToken || !current.leaseUntil || current.leaseUntil.getTime() <= Date.now()) throw new LeaseLostError();
    const expired = await tx.select({ id: cityOwners.id }).from(cityOwners).where(and(isNull(cityOwners.userId), lt(cityOwners.expiresAt, new Date()))).limit(100).for("update", { skipLocked: true });
    if (expired.length) await tx.delete(cityOwners).where(inArray(cityOwners.id, expired.map(row => row.id)));
    await tx.delete(cityRateWindows).where(lt(cityRateWindows.windowStart, new Date(Date.now() - 86400000)));
    await tx.delete(cityWorkerHeartbeats).where(lt(cityWorkerHeartbeats.seenAt, new Date(Date.now() - 86400000)));
    await tx.update(cityJobs).set({ status: "completed", leaseUntil: null }).where(eq(cityJobs.id, current.id));
    await tx.delete(cityJobs).where(and(eq(cityJobs.kind, "retention"), eq(cityJobs.status, "completed"), lt(cityJobs.createdAt, new Date(Date.now() - 86400000))));
  });
}

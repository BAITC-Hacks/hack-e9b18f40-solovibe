import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/server/db/core";
import { cityJobs, cityOwners, citySearches } from "@/server/db/schema";
import { AKIM_DATASET } from "@/features/city/data/akim-v1";
import { searchPlans } from "@/features/city/search";
import type { SearchJobInput } from "@/features/city/ai-contracts";
import type { Principal } from "./principal";
import { requireScenario } from "./scenarios";
import { consumeRate } from "./limits";
import { CityError } from "./errors";
import { LeaseLostError } from "./jobs";

export async function createSearch(p: Principal, input: SearchJobInput) {
  const id = await getDb().transaction(async tx => {
    const scenario = await requireScenario(p, input.scenarioId, tx, true);
    const [owner] = await tx.select().from(cityOwners).where(eq(cityOwners.id, scenario.ownerId));
    const quotaKey = owner.userId ? `account:${owner.userId}` : `guest:${owner.id}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${quotaKey}))`);
    const [duplicate] = await tx.select().from(cityJobs).where(and(eq(cityJobs.ownerId, owner.id), eq(cityJobs.clientRequestId, input.clientRequestId)));
    if (duplicate) return duplicate.id;
    if (scenario.currentRevisionId !== input.inputRevisionId) throw new CityError("STALE_REVISION", 409);
    const [active] = await tx.select().from(cityJobs).where(and(eq(cityJobs.quotaKey, quotaKey), inArray(cityJobs.status, ["queued", "running"])));
    if (active) throw new CityError("RATE_LIMITED", 429, undefined, 10);
    await consumeRate(tx, `search:${quotaKey}`, owner.userId ? 100 : 30);
    const jobId = randomUUID();
    await tx.insert(cityJobs).values({ id: jobId, ownerId: owner.id, quotaKey, kind: "search", input, clientRequestId: input.clientRequestId, deadlineAt: new Date(Date.now() + 120000) });
    return jobId;
  });
  return getSearch(p, id);
}
export async function getSearch(p: Principal, id: string) {
  const [job] = await getDb().select().from(cityJobs).where(and(eq(cityJobs.id, id), eq(cityJobs.kind, "search"), inArray(cityJobs.ownerId, p.ownerIds)));
  if (!job?.input) throw new CityError("NOT_FOUND", 404);
  const scenario = await requireScenario(p, job.input.scenarioId);
  const [record] = job.resultId ? await getDb().select().from(citySearches).where(and(eq(citySearches.id, job.resultId), inArray(citySearches.ownerId, p.ownerIds))) : [];
  return { id: job.id, status: job.status, errorCode: job.errorCode, searchId: record?.id ?? null, result: record?.result ?? null, inputRevisionId: job.input.inputRevisionId, stale: scenario.currentRevisionId !== job.input.inputRevisionId };
}
export async function processSearchJob(job: typeof cityJobs.$inferSelect, signal: AbortSignal) {
  if (!job.input || !job.ownerId) throw new CityError("INVALID_REQUEST");
  const input = job.input;
  const principal: Principal = { ownerIds: [job.ownerId], primaryOwnerId: job.ownerId, kind: "guest", userId: null };
  await requireScenario(principal, input.scenarioId);
  const result = await searchPlans({ datasetVersion: AKIM_DATASET.version, constraints: input.constraints, assumptions: input.assumptions, limit: input.limit, signal, deadlineMs: Math.min(10000, job.deadlineAt.getTime() - Date.now()) });
  signal.throwIfAborted();
  await getDb().transaction(async tx => {
    const [live] = await tx.select().from(cityJobs).where(eq(cityJobs.id, job.id)).for("update");
    if (!live || live.status !== "running" || live.leaseToken !== job.leaseToken || !live.leaseUntil || live.leaseUntil.getTime() <= Date.now() || live.deadlineAt.getTime() <= Date.now()) throw new LeaseLostError();
    await requireScenario(principal, input.scenarioId, tx);
    const [owner] = await tx.select().from(cityOwners).where(eq(cityOwners.id, job.ownerId!));
    if (!owner || (owner.expiresAt && owner.expiresAt.getTime() <= Date.now())) throw new LeaseLostError();
    const searchId = randomUUID();
    await tx.insert(citySearches).values({ id: searchId, ownerId: job.ownerId!, scenarioId: input.scenarioId, inputRevisionId: input.inputRevisionId, inputHash: result.inputHash, result });
    await tx.update(cityJobs).set({ status: "completed", resultId: searchId, leaseUntil: null }).where(eq(cityJobs.id, job.id));
    signal.throwIfAborted();
  });
}

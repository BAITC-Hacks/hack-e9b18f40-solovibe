import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { createRunSchema, type RunRecord, type RunView, type RunEvent } from "@/features/city/ai-contracts";
import { getDb, type CityDb, type CityTx } from "@/server/db/core";
import { cityAnalyses, cityJobs, cityOwners, cityRunEvents, cityRuns,cityBriefs } from "@/server/db/schema";
import { getStress } from './stress';
import {evaluate} from '@/features/city/engine';
import {AKIM_DATASET} from '@/features/city/data/akim-v1';
import type { Principal } from "./principal";
import { getRevision, requireScenario } from "./scenarios";
import { CityError } from "./errors";
import { appendEvent } from "./events";
import { anonymousNetworkKey, consumeRate } from "./limits";

export function runRecord(row: typeof cityRuns.$inferSelect): RunRecord {
  return { id: row.id, scenarioId: row.scenarioId, inputRevisionId: row.inputRevisionId, parentRunId: row.parentRunId, procedure: row.procedure, objective: row.objective, locale: row.locale,context:row.context,
    status: row.status, errorCode: row.errorCode, question: row.question, analysisId: row.analysisId, alternativeRevisionIds: row.alternativeRevisionIds, usage: row.usage, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function requireRun(p: Principal, id: string, db: CityDb | CityTx = getDb()) {
  const [row] = await db.select().from(cityRuns).where(and(eq(cityRuns.id, id), inArray(cityRuns.ownerId, p.ownerIds)));
  if (!row) throw new CityError("NOT_FOUND", 404);
  await requireScenario(p, row.scenarioId, db);
  return row;
}
export async function getRunEvents(p: Principal, id: string, after = 0): Promise<RunEvent[]> {
  await requireRun(p, id);
  const rows = await getDb().select().from(cityRunEvents).where(and(eq(cityRunEvents.runId, id), gt(cityRunEvents.seq, after))).orderBy(cityRunEvents.seq).limit(100);
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
export async function getRun(p: Principal, id: string): Promise<RunView> {
  const row = await requireRun(p, id);
  const [scenario, source, events, analyses, alternatives] = await Promise.all([
    requireScenario(p, row.scenarioId), getRevision(p, row.scenarioId, row.inputRevisionId), getRunEvents(p, id),
    getDb().select().from(cityAnalyses).where(and(eq(cityAnalyses.runId, id), eq(cityAnalyses.ownerId, row.ownerId))),
    Promise.all(row.alternativeRevisionIds.map(revisionId => getRevision(p, row.scenarioId, revisionId))),
  ]);
  const analysis = analyses[0];
  const supplementaryEvaluations:import('@/features/city/records').EvaluationRecord[]=[];
  if(row.context.stressId){const stress=await getStress(p,row.context.stressId);source.evaluation={id:`stress:${stress.experiment.id}:stressed`,revisionId:source.revision.id,result:stress.experiment.stressed};for(const alt of alternatives)alt.evaluation={id:`stress:${stress.experiment.id}:repair:${alt.revision.id}`,revisionId:alt.revision.id,result:evaluate(AKIM_DATASET,alt.revision.decisions,stress.experiment.assumption)};}
  if(row.context.stressId){const s=await getStress(p,row.context.stressId);supplementaryEvaluations.push({id:`stress:${s.experiment.id}:baseline`,revisionId:row.inputRevisionId,result:s.experiment.baseline});}
  return { run: runRecord(row), source, events, alternatives,supplementaryEvaluations, stale: scenario.currentRevisionId !== row.inputRevisionId,
    analysis: analysis ? { id: analysis.id, runId: id, sourceRevisionId: analysis.sourceRevisionId, document: analysis.document, createdAt: analysis.createdAt.toISOString() } : null };
}
export async function listRuns(p: Principal, scenarioId: string, before?: string) {
  await requireScenario(p, scenarioId);
  if (before) {
    const anchor = await requireRun(p, before);
    if (anchor.scenarioId !== scenarioId) throw new CityError("NOT_FOUND", 404);
  }
  const rows = await getDb().select().from(cityRuns).where(and(eq(cityRuns.scenarioId, scenarioId), inArray(cityRuns.ownerId, p.ownerIds),
    before ? sql`(${cityRuns.createdAt}, ${cityRuns.id}) < (select created_at, id from city_runs where id=${before})` : undefined))
    .orderBy(desc(cityRuns.createdAt), desc(cityRuns.id)).limit(21);
  const items = rows.slice(0, 20);
  return { items: items.map(runRecord), nextCursor: rows.length > 20 ? items.at(-1)!.id : null };
}
export async function createRun(p: Principal, raw: z.input<typeof createRunSchema>, network: string) {
  const input=createRunSchema.parse(raw);
  const id = await getDb().transaction(async tx => {
    const scenario = await requireScenario(p, input.scenarioId, tx, true);
    const [owner] = await tx.select().from(cityOwners).where(eq(cityOwners.id, scenario.ownerId));
    const quotaKey = owner.userId ? `account:${owner.userId}` : `guest:${owner.id}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${quotaKey}))`);
    const [duplicate] = await tx.select().from(cityRuns).where(and(eq(cityRuns.ownerId, scenario.ownerId), eq(cityRuns.clientRequestId, input.clientRequestId)));
    if (duplicate) return duplicate.id;
    // A retried request returns its durable result even after the brief has advanced.
    if(input.context.stressId){const s=await getStress(p,input.context.stressId,tx);if(s.experiment.scenarioId!==input.scenarioId||s.experiment.sourceRevisionId!==input.inputRevisionId)throw new CityError('INVALID_REQUEST');}
    if(input.procedure==='brief'){
      const [brief]=await tx.select().from(cityBriefs).where(and(eq(cityBriefs.id,input.context.briefId??''),inArray(cityBriefs.ownerId,p.ownerIds)));
      if(!brief||brief.scenarioId!==input.scenarioId||brief.sourceRevisionId!==input.inputRevisionId)throw new CityError('NOT_FOUND',404);
      if(brief.version!==input.context.briefVersion)throw new CityError('STALE_BRIEF',409);
    }else if(input.context.briefId)throw new CityError('INVALID_REQUEST');

    if (!input.context.stressId && input.procedure!=='brief' && scenario.currentRevisionId !== input.inputRevisionId) throw new CityError("STALE_REVISION", 409);
    if (input.parentRunId) {
      const parent = await requireRun(p, input.parentRunId, tx);
      if (parent.scenarioId !== scenario.id) throw new CityError("NOT_FOUND", 404);
    }
    const [active] = await tx.select({ id: cityJobs.id }).from(cityJobs).where(and(eq(cityJobs.quotaKey, quotaKey), inArray(cityJobs.status, ["queued", "running"])));
    if (active) throw new CityError("RATE_LIMITED", 429, undefined, 10);
    await consumeRate(tx, `ai:${quotaKey}`, owner.userId ? 30 : 10);
    if (!owner.userId) await consumeRate(tx, `ai-network:${anonymousNetworkKey(network)}`, Number(process.env.CITY_AI_NETWORK_HOURLY_LIMIT) || 60);
    const runId = randomUUID(); const configured = !!process.env.OPENAI_API_KEY?.trim();
    const deadlineAt = new Date(Date.now() + 120000);
    await tx.insert(cityRuns).values({ id: runId, ownerId: scenario.ownerId, quotaKey, scenarioId: scenario.id, inputRevisionId: input.inputRevisionId, parentRunId: input.parentRunId,
      procedure: input.procedure, objective: input.objective, locale: input.locale, clientRequestId: input.clientRequestId,context:input.context,
      inputHash: createHash("sha256").update(JSON.stringify([input.inputRevisionId, input.procedure, input.objective,input.context])).digest("hex"),
      status: configured ? "queued" : "failed", errorCode: configured ? null : "AI_UNAVAILABLE", deadlineAt });
    await appendEvent(tx, runId, { kind: "status", status: configured ? "queued" : "failed", payload: configured ? {} : { code: "AI_UNAVAILABLE" } });
    if (configured) await tx.insert(cityJobs).values({ id: randomUUID(), kind: "analysis", runId, ownerId: scenario.ownerId, quotaKey, deadlineAt });
    return runId;
  });
  return getRun(p, id);
}
export async function cancelRun(p: Principal, id: string) {
  await requireRun(p, id);
  await getDb().transaction(async tx => {
    await tx.select().from(cityJobs).where(eq(cityJobs.runId, id)).for("update");
    const run = await requireRun(p, id, tx);
    if (!["queued", "running"].includes(run.status)) return;
    await tx.update(cityJobs).set({ status: "cancelled", leaseToken: sql`${cityJobs.leaseToken}+1`, leaseUntil: null }).where(eq(cityJobs.runId, id));
    await tx.update(cityRuns).set({ status: "cancelled", updatedAt: new Date() }).where(eq(cityRuns.id, id));
    await appendEvent(tx, id, { kind: "status", status: "cancelled" });
  });
  return getRun(p, id);
}

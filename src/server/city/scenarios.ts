import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { constraintsSchema, decisionSchema, type Constraints, type Decision } from "@/features/city/contracts";
import { PROOF_DECISIONS } from '@/features/city/data/proof-scenarios';
import { AKIM_DATASET, DEFAULT_CONSTRAINTS, EXAMPLE_DECISIONS } from "@/features/city/data/akim-v1";
import { canonicalDecisions, evaluate } from "@/features/city/engine";
import type { EvaluationRecord, RevisionRecord, ScenarioList, ScenarioRecord, ScenarioView } from "@/features/city/records";
import { getDb, type CityDb, type CityTx } from "@/server/db/core";
import { cityEvaluations, cityJobs, cityOwners, cityRevisions, cityRuns, cityScenarios } from "@/server/db/schema";
import { appendEvent } from "./events";
import { CityError } from "./errors";
import type { Principal } from "./principal";

export const createScenarioSchema = z.object({
  source: z.enum(["example", "blank", "proof"]), proofVariant: z.enum(["best", "two-districts"]).optional(),
  title: z.string().trim().min(1).max(120).optional(), clientMutationId: z.string().uuid(),
}).strict();
export const revisionSchema = z.object({ expectedRevisionId: z.string().uuid(), decisions: z.array(decisionSchema).max(5),
  constraints: constraintsSchema, clientMutationId: z.string().uuid(), intent: z.string().max(2000).optional() }).strict();
export const titleSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();
export const forkSchema = z.object({ clientMutationId: z.string().uuid(), title: z.string().trim().min(1).max(120).optional(), revisionId:z.string().uuid().optional() }).strict();
export const applySchema = z.object({ revisionId: z.string().uuid(), expectedRevisionId: z.string().uuid(), clientMutationId: z.string().uuid() }).strict();

type Executor = CityDb | CityTx;
const ownedWhere = (p: Principal, id: string) => and(eq(cityScenarios.id, id), inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt));
function scenarioRecord(row: typeof cityScenarios.$inferSelect): ScenarioRecord {
  if (!row.currentRevisionId) throw new CityError("STORAGE_UNAVAILABLE", 503);
  return { id: row.id, title: row.title, datasetVersion: row.datasetVersion, currentRevisionId: row.currentRevisionId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function revisionRecord(row: typeof cityRevisions.$inferSelect): RevisionRecord { return { ...row, createdAt: row.createdAt.toISOString() }; }

export async function requireScenario(p: Principal, id: string, db: Executor = getDb(), lock = false) {
  if (!p.ownerIds.length) throw new CityError("NOT_FOUND", 404);
  const query = db.select().from(cityScenarios).where(ownedWhere(p, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw new CityError("NOT_FOUND", 404);
  return row;
}
export async function getRevision(p: Principal, scenarioId: string, revisionId: string, db: Executor = getDb()) {
  await requireScenario(p, scenarioId, db);
  const [row] = await db.select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityRevisions)
    .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
    .where(and(eq(cityRevisions.id, revisionId), eq(cityRevisions.scenarioId, scenarioId)));
  if (!row) throw new CityError("NOT_FOUND", 404);
  return { revision: revisionRecord(row.revision), evaluation: { id: row.evaluation.id, revisionId, result: row.evaluation.result } };
}
export async function getScenario(p: Principal, id: string, db: Executor = getDb()): Promise<ScenarioView> {
  const scenario = await requireScenario(p, id, db);
  if (!scenario.currentRevisionId) throw new CityError("STORAGE_UNAVAILABLE", 503);
  const current = await getRevision(p, id, scenario.currentRevisionId, db);
  const rows = await db.select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityRevisions)
    .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
    .where(and(eq(cityRevisions.scenarioId, id), eq(cityRevisions.cause, "alternative")))
    .orderBy(desc(cityRevisions.createdAt)).limit(30);
  return { scenario: scenarioRecord(scenario), ...current, principalKind: p.kind,
    alternatives: rows.map(r => ({ revision: revisionRecord(r.revision), evaluation: { id: r.evaluation.id, revisionId: r.revision.id, result: r.evaluation.result } })) };
}

export async function insertRevision(tx: CityTx, data: {
  scenarioId: string; decisions: Decision[]; constraints: Constraints; clientMutationId: string;
  parentId?: string | null; sourceRevisionId?: string | null; cause: string; intent?: string; title?: string;
}): Promise<{ revision: RevisionRecord; evaluation: EvaluationRecord }> {
  const result = evaluate(AKIM_DATASET, data.decisions);
  if (!result.valid) throw new CityError("INVALID_PLAN", 400, result.issues);
  const id = randomUUID();
  const [row] = await tx.insert(cityRevisions).values({ ...data, id, decisions: canonicalDecisions(data.decisions), intent: data.intent ?? "" }).returning();
  const evaluation = { id: randomUUID(), revisionId: id, result };
  await tx.insert(cityEvaluations).values(evaluation);
  return { revision: revisionRecord(row), evaluation };
}
async function enforceQuota(tx: CityTx, p: Principal) {
  if (!p.primaryOwnerId) throw new CityError("SESSION_EXPIRED", 401);
  await tx.select({ id: cityOwners.id }).from(cityOwners).where(eq(cityOwners.id, p.primaryOwnerId)).for("update");
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(cityScenarios).where(and(inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt)));
  if (row.count >= (p.kind === "account" ? 100 : 10)) throw new CityError("SCENARIO_LIMIT", 429);
}
export async function createScenario(p: Principal, input: z.infer<typeof createScenarioSchema>, preset?: { decisions: Decision[]; constraints: Constraints; sourceRevisionId: string; intent: string }): Promise<ScenarioView> {
  if (!p.primaryOwnerId) throw new CityError("SESSION_EXPIRED", 401);
  let decisions = preset?.decisions ?? (input.source === "blank" ? [] : EXAMPLE_DECISIONS);
  let constraints = preset?.constraints ?? DEFAULT_CONSTRAINTS;
  // Continue precisely the immutable evaluated example shown on the landing page.
  if (input.source === "proof") {
    constraints = { ...DEFAULT_CONSTRAINTS, minDirectDistricts: input.proofVariant === "two-districts" ? 2 : 0 };
    decisions = PROOF_DECISIONS[input.proofVariant ?? "best"];
  }
  return getDb().transaction(async tx => {
    await tx.select({ id: cityOwners.id }).from(cityOwners).where(eq(cityOwners.id, p.primaryOwnerId!)).for("update");
    const [existing] = await tx.select().from(cityScenarios).where(and(inArray(cityScenarios.ownerId, p.ownerIds), eq(cityScenarios.clientMutationId, input.clientMutationId)));
    if (existing) return getScenario(p, existing.id, tx);
    await enforceQuota(tx, p);
    const id = randomUUID();
    await tx.insert(cityScenarios).values({ id, ownerId: p.primaryOwnerId!, title: input.title ?? "CityBalance", datasetVersion: AKIM_DATASET.version, rulesVersion: AKIM_DATASET.rulesVersion,
      clientMutationId: input.clientMutationId, createdAt: new Date(), updatedAt: new Date() });
    const saved = await insertRevision(tx, { scenarioId: id, decisions, constraints, clientMutationId: input.clientMutationId, cause: preset ? "fork" : input.source, sourceRevisionId: preset?.sourceRevisionId, intent: preset?.intent });
    await tx.update(cityScenarios).set({ currentRevisionId: saved.revision.id }).where(eq(cityScenarios.id, id));
    return getScenario(p, id, tx);
  });
}
export async function saveRevision(p: Principal, id: string, input: z.infer<typeof revisionSchema>, provenance?: { sourceRevisionId: string; cause: "apply" }): Promise<ScenarioView> {
  return getDb().transaction(async tx => {
    const current = await requireScenario(p, id, tx, true);
    const result = evaluate(AKIM_DATASET, input.decisions);
    if (!result.valid) throw new CityError("INVALID_PLAN", 400, result.issues);
    const [duplicate] = await tx.select().from(cityRevisions).where(and(eq(cityRevisions.scenarioId, id), eq(cityRevisions.clientMutationId, input.clientMutationId)));
    if (duplicate) return getScenario(p, id, tx);
    if (current.currentRevisionId !== input.expectedRevisionId) throw new CityError("STALE_REVISION", 409);
    const saved = await insertRevision(tx, { scenarioId: id, decisions: input.decisions, constraints: input.constraints, intent: input.intent, clientMutationId: input.clientMutationId, parentId: current.currentRevisionId, cause: provenance?.cause ?? "edit", sourceRevisionId: provenance?.sourceRevisionId });
    const updated = await tx.update(cityScenarios).set({ currentRevisionId: saved.revision.id, updatedAt: new Date() })
      .where(and(ownedWhere(p, id), eq(cityScenarios.currentRevisionId, input.expectedRevisionId))).returning({ id: cityScenarios.id });
    if (!updated.length) throw new CityError("STALE_REVISION", 409);
    return getScenario(p, id, tx);
  });
}
export async function renameScenario(p: Principal, id: string, title: string) {
  const updated = await getDb().update(cityScenarios).set({ title, updatedAt: new Date() }).where(ownedWhere(p, id)).returning({ id: cityScenarios.id });
  if (!updated.length) throw new CityError("NOT_FOUND", 404);
  return getScenario(p, id);
}
export async function deleteScenario(p: Principal, id: string) {
  await getDb().transaction(async tx => {
    await requireScenario(p, id, tx, true);
    const active = await tx.select().from(cityRuns).where(and(eq(cityRuns.scenarioId, id), inArray(cityRuns.status, ["queued", "running"])));
    if (active.length) {
      await tx.update(cityJobs).set({ status: "cancelled", leaseToken: sql`${cityJobs.leaseToken}+1`, leaseUntil: null }).where(inArray(cityJobs.runId, active.map(run => run.id)));
      await tx.update(cityRuns).set({ status: "cancelled" }).where(inArray(cityRuns.id, active.map(run => run.id)));
      for (const run of active) await appendEvent(tx, run.id, { kind: "status", status: "cancelled" });
    }
    await tx.update(cityJobs).set({ status: "cancelled", leaseToken: sql`${cityJobs.leaseToken}+1`, leaseUntil: null })
      .where(and(eq(cityJobs.kind, "search"), inArray(cityJobs.ownerId, p.ownerIds), sql`${cityJobs.input}->>'scenarioId' = ${id}`, inArray(cityJobs.status, ["queued", "running"])));
    await tx.update(cityScenarios).set({ deletedAt: new Date(), updatedAt: new Date() }).where(ownedWhere(p, id));
  });
  return { deleted: true, id };
}
export async function forkScenario(p: Principal, id: string, input: z.infer<typeof forkSchema>) {
  const source = await getScenario(p, id);
  const selected = input.revisionId ? await getRevision(p,id,input.revisionId) : source;
  return createScenario(p, { source: "blank", clientMutationId: input.clientMutationId, title: input.title ?? source.scenario.title }, {
    decisions: selected.revision.decisions, constraints: selected.revision.constraints, sourceRevisionId: selected.revision.id, intent: selected.revision.intent,
  });
}
export async function applyRevision(p: Principal, id: string, input: z.infer<typeof applySchema>) {
  const selected = await getRevision(p, id, input.revisionId);
  return saveRevision(p, id, { ...input, decisions: selected.revision.decisions, constraints: selected.revision.constraints, intent: selected.revision.intent }, { sourceRevisionId: selected.revision.id, cause: "apply" });
}
export async function listScenarios(p: Principal, query: { cursor?: string; q?: string }): Promise<ScenarioList> {
  if (!p.ownerIds.length) return { items: [], nextCursor: null, principalKind: p.kind };
  let cursor: { time: string; id: string } | null = null;
  if (query.cursor) {
    try { cursor = z.object({ time: z.iso.datetime(), id: z.string().uuid() }).parse(JSON.parse(Buffer.from(query.cursor, "base64url").toString())); }
    catch { throw new CityError("INVALID_REQUEST"); }
  }
  const q = query.q?.slice(0, 120).replace(/[\\%_]/g, "\\$&");
  const rows = await getDb().select({ scenario: cityScenarios, revision: cityRevisions, evaluation: cityEvaluations }).from(cityScenarios)
    .innerJoin(cityRevisions, eq(cityRevisions.id, cityScenarios.currentRevisionId))
    .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
    .where(and(inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt), q ? ilike(cityScenarios.title, `%${q}%`) : undefined,
      cursor ? or(lt(cityScenarios.updatedAt, new Date(cursor.time)), and(eq(cityScenarios.updatedAt, new Date(cursor.time)), lt(cityScenarios.id, cursor.id))) : undefined))
    .orderBy(desc(cityScenarios.updatedAt), desc(cityScenarios.id)).limit(21);
  const visible = rows.slice(0, 20);
  const last = visible.at(-1)?.scenario;
  return { items: visible.map(r => ({ ...scenarioRecord(r.scenario), cost: r.evaluation.result.cost, score: r.evaluation.result.score, decisionCount: r.revision.decisions.length })),
    nextCursor: rows.length > 20 && last ? Buffer.from(JSON.stringify({ time: last.updatedAt.toISOString(), id: last.id })).toString("base64url") : null, principalKind: p.kind };
}

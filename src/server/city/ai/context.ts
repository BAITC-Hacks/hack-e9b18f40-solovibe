import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Constraints, Decision, Evaluation, SearchResult } from '@/features/city/contracts';
import type { EvaluationRecord, RevisionRecord } from '@/features/city/records';
import { AKIM_DATASET } from '@/features/city/data/akim-v1';
import { getDb, type CityTx } from '@/server/db/core';
import { cityAnalyses, cityEvaluations, cityRevisions, cityRuns, cityScenarios, citySearches, cityToolReceipts } from '@/server/db/schema';
import type { StoredRun } from '../job-contracts';
import { CityError } from '../errors';

export interface SourceContext { revision: RevisionRecord; evaluation: EvaluationRecord }
type Reader = ReturnType<typeof getDb> | CityTx;
export async function loadSource(run: StoredRun, db: Reader = getDb()): Promise<SourceContext> {
  const [row] = await db.select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityScenarios)
    .innerJoin(cityRevisions, and(eq(cityRevisions.scenarioId, cityScenarios.id), eq(cityRevisions.id, run.inputRevisionId)))
    .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
    .where(and(eq(cityScenarios.id, run.scenarioId), eq(cityScenarios.ownerId, run.ownerId), isNull(cityScenarios.deletedAt)));
  if (!row) throw new CityError('NOT_FOUND', 404);
  if (row.evaluation.result.datasetVersion !== AKIM_DATASET.version || row.evaluation.result.sourceHash !== AKIM_DATASET.sourceHash || row.evaluation.result.evaluatorVersion !== AKIM_DATASET.evaluatorVersion) throw new CityError('STALE_EVIDENCE');
  return { revision: { ...row.revision, createdAt: row.revision.createdAt.toISOString() }, evaluation: row.evaluation };
}
export async function freshRun(run: StoredRun, db: Reader = getDb()) {
  const [row] = await db.select().from(cityRuns).where(and(eq(cityRuns.id, run.id), eq(cityRuns.ownerId, run.ownerId)));
  if (!row) throw new CityError('NOT_FOUND', 404);
  return row;
}
export async function loadEvaluation(run: StoredRun, evaluationId: string, db: Reader = getDb()): Promise<EvaluationRecord> {
  const source = await loadSource(run, db);
  if (source.evaluation.id === evaluationId) return source.evaluation;
  const current = await freshRun(run, db);
  if (!current.alternativeRevisionIds.length) throw new CityError('UNKNOWN_EVIDENCE');
  const [row] = await db.select({ evaluation: cityEvaluations }).from(cityEvaluations)
    .innerJoin(cityRevisions, eq(cityRevisions.id, cityEvaluations.revisionId))
    .where(and(eq(cityEvaluations.id, evaluationId), inArray(cityRevisions.id, current.alternativeRevisionIds), eq(cityRevisions.scenarioId, run.scenarioId), eq(cityRevisions.sourceRevisionId, run.inputRevisionId)));
  if (!row) throw new CityError('UNKNOWN_EVIDENCE');
  return row.evaluation;
}
export async function loadSearch(run: StoredRun, searchId: string, db: Reader = getDb()) {
  await loadSource(run, db);
  const [row] = await db.select().from(citySearches).where(and(eq(citySearches.id, searchId), eq(citySearches.runId, run.id), eq(citySearches.ownerId, run.ownerId), eq(citySearches.inputRevisionId, run.inputRevisionId)));
  if (!row) throw new CityError('UNKNOWN_SEARCH');
  return row;
}
export async function observations(run: StoredRun) {
  const rows = await getDb().select({ toolName: cityToolReceipts.toolName, input: cityToolReceipts.input, output: cityToolReceipts.output }).from(cityToolReceipts)
    .where(and(eq(cityToolReceipts.runId, run.id), eq(cityToolReceipts.status, 'completed'))).orderBy(asc(cityToolReceipts.createdAt)).limit(8);
  return rows;
}
/** Bounded, owned conversation context. Historical references never replace the current source. */
export async function conversationContext(run: StoredRun) {
  const turns: { request: string; status: string; sourceRevisionId: string; question: string | null; explanation: string[]; proposedDecisions: Decision[] | null }[] = [];
  let parentId = run.parentRunId;
  const seen = new Set<string>([run.id]);
  while (parentId && turns.length < 4 && !seen.has(parentId)) {
    seen.add(parentId);
    const [parent] = await getDb().select().from(cityRuns).where(and(eq(cityRuns.id, parentId), eq(cityRuns.ownerId, run.ownerId), eq(cityRuns.scenarioId, run.scenarioId)));
    if (!parent) break;
    const [analysis] = await getDb().select().from(cityAnalyses).where(and(eq(cityAnalyses.runId, parent.id), eq(cityAnalyses.ownerId, run.ownerId)));
    const candidateId = analysis?.document.candidateRevisionId;
    const [candidate] = candidateId ? await getDb().select({ decisions: cityRevisions.decisions }).from(cityRevisions).where(and(eq(cityRevisions.id, candidateId), eq(cityRevisions.scenarioId, run.scenarioId), inArray(cityRevisions.id, parent.alternativeRevisionIds))) : [];
    turns.push({ request: parent.objective, status: parent.status, sourceRevisionId: parent.inputRevisionId, question: parent.question, explanation: analysis?.document.blocks.map(block => block.text) ?? [], proposedDecisions: candidate?.decisions ?? null });
    parentId = parent.parentRunId;
  }
  return turns.reverse();
}
export function compactEvaluation(e: Evaluation, evaluationId?: string) {
  return { evaluationId, kind: e.kind, score: e.score, cost: e.cost, remaining: e.remaining, issues: e.issues,
    populationMean: e.populationMean, minimumDistrictScore: e.minimumDistrictScore, criticalPairs: e.criticalPairs,
    directionCounts: e.directionCounts, directDistrictIds: e.directDistrictIds,
    districts: e.districts.map(d => ({ districtId: d.districtId, score: d.score, evidenceId: d.evidenceId, changedIndicators: d.indicators.filter(i => i.delta !== 0) })),
    evidence: e.evidence.filter(x => ['total', 'population', 'synergy', 'critical'].includes(x.kind)).map(x => ({ id: x.id, kind: x.kind, value: x.value, districtId: x.districtId, indicatorId: x.indicatorId })),
  };
}
export function compactSearch(result: SearchResult) {
  return { status: result.status, termination: result.termination, constraints: result.constraints, inputHash: result.inputHash,
    evaluatedCount: result.evaluatedCount, feasibleCount: result.feasibleCount, certificate: result.certificate, issues: result.issues,
    candidates: result.candidates.map((c, candidateIndex) => ({ candidateIndex, decisions: c.decisions, evaluation: compactEvaluation(c.evaluation) })) };
}
/** These unambiguous phrases add protection; they never remove persisted hard conditions. */
export function intentConstraints(source: Constraints, objective: string): Constraints {
  const c = structuredClone(source), text = objective.toLowerCase();
  const school = /школ|school|мектеп/u.test(text), nura = /нур|nura|нұр/u.test(text), preserve = /сохран|остав|не\s*(?:убира|меня|трога)|keep|preserv|retain|сақта/u.test(text);
  if (school && nura && preserve && !c.locked.some(d => d.measureId === 'M7' && d.districtId === 'nura')) c.locked.push({ measureId: 'M7', districtId: 'nura' });
  if (/(?:все|всем|всех|all|барлық).{0,20}(?:направлен|direction|бағыт)/u.test(text)) c.requiredDirections = ['transport', 'ecology', 'social', 'safety', 'services'];
  if (/(?:без|ноль|нулев|zero|no).{0,15}(?:критич|critical)|критич.{0,15}(?:ноль|нет|нуль)/u.test(text)) c.maxCriticalPairs = 0;
  return c;
}
export function hardConditionIssues(required: Constraints, actual: Constraints): string[] {
  const issues: string[] = [];
  if (required.locked.some(d => !actual.locked.some(a => a.measureId === d.measureId && a.districtId === d.districtId))) issues.push('LOST_LOCK');
  if (required.excludedMeasureIds.some(id => !actual.excludedMeasureIds.includes(id))) issues.push('LOST_EXCLUSION');
  if (required.requiredDirections?.some(d => !actual.requiredDirections?.includes(d))) issues.push('LOST_DIRECTION_REQUIREMENT');
  if (actual.minDirectDistricts < required.minDirectDistricts || actual.maxSpend > required.maxSpend) issues.push('RELAXED_HARD_CONDITION');
  if (required.maxCriticalPairs !== undefined && (actual.maxCriticalPairs === undefined || actual.maxCriticalPairs > required.maxCriticalPairs)) issues.push('RELAXED_CRITICAL_LIMIT');
  if (required.districtFloors?.some(f => !actual.districtFloors?.some(a => a.districtId === f.districtId && a.minScore >= f.minScore))) issues.push('LOST_DISTRICT_FLOOR');
  if (required.indicatorFloors?.some(f => !actual.indicatorFloors?.some(a => a.districtId === f.districtId && a.indicatorId === f.indicatorId && a.minValue >= f.minValue))) issues.push('LOST_INDICATOR_FLOOR');
  return issues;
}
export function failedAnalysisAttempts(rows: { toolName: string; output: unknown }[]): number {
  return rows.filter(row => {
    if (row.toolName !== 'saveAnalysis') return false;
    const result = row.output as { ok?: boolean; value?: { accepted?: boolean } } | null;
    return result?.ok === false || result?.value?.accepted === false;
  }).length;
}
/** Catalogue semantics supplied alongside numeric rules; prose is localized by the model. */
export const catalogueForModel = AKIM_DATASET.measures.map(measure => ({ ...measure, name: ({
  M1: 'Dedicated bus lanes', M2: 'Adaptive traffic lights', M3: 'Light rail line or extension',
  M4: 'Park or public garden', M5: 'Private homes switched to clean fuel', M6: 'City greening and windbreaks',
  M7: 'School and kindergarten', M8: 'Family health center or clinic', M9: 'Neighborhood sports hubs',
  M10: 'Street lighting and cameras', M11: 'Safe crossings and school zones', M12: 'City platform for resident requests',
  M13: 'Heating and water network modernization', M14: 'Emergency utility crews and early warning',
} as const)[measure.id] }));

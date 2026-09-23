import { analysisDocumentSchema, type AnalysisDocument } from '@/features/city/ai-contracts';
import { DIRECTIONS, type Constraints, type EvidenceRef, type SearchResult } from '@/features/city/contracts';
import type { EvaluationRecord, RevisionRecord } from '@/features/city/records';
import {withoutNegatedGuarantees} from '@/features/city/claim-language';

export interface QualityContext {
  procedure: 'plan' | 'explain';
  source: { revision: RevisionRecord; evaluation: EvaluationRecord };
  candidate?: { revision: RevisionRecord; evaluation: EvaluationRecord };
  search?: { id: string; result: SearchResult };
  requiredConstraints: Constraints;
  evaluations: ReadonlyMap<string, EvaluationRecord>;
}
export type QualityResult = { ok: true; document: AnalysisDocument } | { ok: false; issues: string[] };
function comparisonDelta(ref: EvidenceRef, evaluation: EvaluationRecord, compared?: EvaluationRecord): number | null {
  if (compared) {
    const before = compared.result.evidence.find(e => e.id === ref.id);
    return before ? ref.value - before.value : null;
  }
  if (['effect', 'synergy', 'clipping'].includes(ref.kind)) return ref.value;
  if (ref.kind === 'indicator') {
    const indicator = evaluation.result.districts.find(d => d.districtId === ref.districtId)?.indicators.find(i => i.indicatorId === ref.indicatorId);
    return indicator?.delta ?? null;
  }
  return null;
}
function meaningfulRelaxation(document: AnalysisDocument, search: SearchResult): boolean {
  const c = search.constraints;
  switch (document.relaxation) {
    case 'locked': return c.locked.length > 0;
    case 'excludedMeasureIds': return c.excludedMeasureIds.length > 0;
    case 'requiredDirections': return !!c.requiredDirections?.length;
    case 'maxCriticalPairs': return c.maxCriticalPairs !== undefined && c.maxCriticalPairs < 50;
    case 'minDirectDistricts': return c.minDirectDistricts > 0;
    case 'districtFloors': return !!c.districtFloors?.some(f => f.minScore > 0);
    case 'indicatorFloors': return !!c.indicatorFloors?.some(f => f.minValue > 0);
    case 'maxSpend': return c.maxSpend < 100;
    default: return false;
  }
}
export function checkAnalysis(input: unknown, context: QualityContext): QualityResult {
  const parsed = analysisDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: ['INVALID_ANALYSIS_SCHEMA'] };
  const document = parsed.data, issues: string[] = [];
  const candidate = context.candidate;
  const evaluation = candidate?.evaluation ?? context.source.evaluation;
  const result = evaluation.result;
  const infeasible = document.blocks.some(b => b.kind === 'infeasible');
  if (!document.blocks.some(b => b.kind === 'limitation')) issues.push('MODEL_LIMITATION_REQUIRED');
  if (document.candidateRevisionId && document.candidateRevisionId !== candidate?.revision.id) issues.push('UNKNOWN_CANDIDATE');
  if (document.searchId && document.searchId !== context.search?.id) issues.push('UNKNOWN_SEARCH');
  if (context.procedure === 'plan' && !infeasible && (!candidate || !document.candidateRevisionId)) issues.push('SAVED_CANDIDATE_REQUIRED');
  if (!infeasible && (!result.valid || !result.complete || result.score === null)) issues.push('LEGAL_COMPLETE_EVALUATION_REQUIRED');
  if (candidate && context.requiredConstraints.locked.some(lock => !candidate.revision.decisions.some(d => d.measureId === lock.measureId && d.districtId === lock.districtId))) issues.push('LOST_LOCK');
  if (candidate && (!context.search || !document.searchId || !context.search.result.candidates.some(c => JSON.stringify(c.evaluation.decisions) === JSON.stringify(result.decisions)))) issues.push('CANDIDATE_SEARCH_MISMATCH');
  if (infeasible) {
    const search = context.search?.result;
    if (candidate || document.candidateRevisionId || !document.searchId || !search || search.status !== 'complete' || !search.certificate?.exhaustive || search.feasibleCount !== 0) issues.push('EXHAUSTIVE_INFEASIBILITY_REQUIRED');
    else if (!meaningfulRelaxation(document, search)) issues.push('ACTIONABLE_RELAXATION_REQUIRED');
  } else if (!document.blocks.some(b => b.kind === 'benefit' || b.kind === 'tradeoff' || b.kind === 'noImprovement')) issues.push('CONCRETE_OUTCOME_REQUIRED');
  for (const block of document.blocks) {
    if (/\p{N}|https?:\/\//u.test(block.text)) issues.push('NUMERIC_PROSE_OR_URL');
    if (/гарантир\w*|реальн\w* эконом\w*|сэконом\w* тенге|guaranteed|actual (?:savings|residents served)|нақты эконом/u.test(withoutNegatedGuarantees(block.text).toLowerCase())) issues.push('UNSUPPORTED_REAL_WORLD_CLAIM');
    if (['benefit', 'tradeoff', 'risk', 'noImprovement'].includes(block.kind) && !block.refs.length) issues.push('EVIDENCE_REQUIRED');
    const deltas: number[] = [];
    for (const link of block.refs) {
      const record = context.evaluations.get(link.evaluationId);
      const ref = record?.result.evidence.find(e => e.id === link.evidenceId);
      const compared = link.compareToEvaluationId ? context.evaluations.get(link.compareToEvaluationId) : undefined;
      if (!record || !ref || (link.compareToEvaluationId && !compared)) { issues.push('UNKNOWN_EVIDENCE'); continue; }
      if (record.result.sourceHash !== context.source.evaluation.result.sourceHash || record.result.evaluatorVersion !== context.source.evaluation.result.evaluatorVersion) issues.push('STALE_EVIDENCE');
      if (compared && !compared.result.evidence.some(e => e.id === ref.id)) issues.push('COMPARISON_EVIDENCE_MISMATCH');
      const delta = comparisonDelta(ref, record, compared);
      if (delta !== null) deltas.push(delta);
    }
    if (block.kind === 'benefit' && (!deltas.some(d => d > 0) || deltas.some(d => d < 0))) issues.push('BENEFIT_DIRECTION_MISMATCH');
    if (block.kind === 'tradeoff' && (!deltas.some(d => d < 0) || deltas.some(d => d > 0))) issues.push('TRADEOFF_DIRECTION_MISMATCH');
    if (block.kind === 'noImprovement') {
      const original = context.source.evaluation.result.score;
      if (!candidate || original === null || result.score === null || result.score > original) issues.push('FALSE_NO_IMPROVEMENT');
    }
  }
  for (const claim of document.claims) {
    if (claim === 'noCriticalPairs' && (infeasible || result.criticalPairs.length !== 0)) issues.push('FALSE_NO_CRITICAL_PAIRS');
    if (claim === 'allDirections' && (infeasible || DIRECTIONS.some(d => result.directionCounts[d] === 0))) issues.push('FALSE_ALL_DIRECTIONS');
    if (claim === 'improvedScore' && (!candidate || context.source.evaluation.result.score === null || result.score === null || result.score <= context.source.evaluation.result.score)) issues.push('FALSE_IMPROVED_SCORE');
    if (claim === 'preservedLocks' && (!candidate || context.requiredConstraints.locked.some(l => !candidate.revision.decisions.some(d => d.measureId === l.measureId && d.districtId === l.districtId)))) issues.push('FALSE_PRESERVED_LOCKS');
    if (claim === 'optimal') {
      const search = context.search?.result, best = search?.candidates[0]?.evaluation;
      const equalObjective = search?.objective === 'minCost' ? best?.cost === result.cost : search?.objective === 'protectDistrict' ? best?.districts.find(d => d.districtId === search.constraints.priorityDistrictId)?.score === result.districts.find(d => d.districtId === search.constraints.priorityDistrictId)?.score && best?.score === result.score : best?.score === result.score;
      if (!candidate || !search || search.status !== 'complete' || !search.certificate?.exhaustive || search.certificate.inputHash !== search.inputHash || !equalObjective) issues.push('UNPROVEN_OPTIMALITY');
    }
  }
  return issues.length ? { ok: false, issues: [...new Set(issues)] } : { ok: true, document };
}

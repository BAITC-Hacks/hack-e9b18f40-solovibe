import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnalysisDocument } from '@/features/city/ai-contracts';
import type { Decision, SearchResult } from '@/features/city/contracts';
import { AKIM_DATASET, DEFAULT_CONSTRAINTS, EXAMPLE_DECISIONS } from '@/features/city/data/akim-v1';
import { evaluate } from '@/features/city/engine';
import { checkAnalysis, type QualityContext } from './quality';
import { hardConditionIssues, intentConstraints } from './context';
import { analysisToolSchema, createCityTools } from './tools';
import type { ToolExecution } from '../job-contracts';

const sourceId = '11111111-1111-4111-8111-111111111111';
const candidateId = '22222222-2222-4222-8222-222222222222';
const searchId = '33333333-3333-4333-8333-333333333333';
const source = { revision: { id: sourceId, scenarioId: 'scenario', parentId: null, sourceRevisionId: null, decisions: EXAMPLE_DECISIONS, constraints: DEFAULT_CONSTRAINTS, intent: '', cause: 'example', title: null, createdAt: new Date(0).toISOString() }, evaluation: { id: 'source-evaluation', revisionId: sourceId, result: evaluate(AKIM_DATASET, EXAMPLE_DECISIONS) } };
const alternative: Decision[] = [{ measureId: 'M3', districtId: 'nura' }, { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' }, { measureId: 'M11', districtId: 'yesil' }, { measureId: 'M14', districtId: null }];
const candidate = { revision: { ...source.revision, id: candidateId, sourceRevisionId: sourceId, decisions: alternative, cause: 'alternative' }, evaluation: { id: 'candidate-evaluation', revisionId: candidateId, result: evaluate(AKIM_DATASET, alternative) } };
const search: SearchResult = { status: 'complete', termination: 'exhausted', inputHash: 'test-input', datasetVersion: AKIM_DATASET.version, sourceHash: AKIM_DATASET.sourceHash, rulesVersion: AKIM_DATASET.rulesVersion, evaluatorVersion: AKIM_DATASET.evaluatorVersion, constraints: DEFAULT_CONSTRAINTS, objective: 'maxScore', evaluatedCount: 1, validCount: 1, feasibleCount: 1, candidates: [{ decisions: alternative, evaluation: candidate.evaluation.result }], issues: [], elapsedMs: 1, certificate: { exhaustive: true, inputHash: 'test-input', bestValue: candidate.evaluation.result.score, feasibleCount: 1 } };
const total = candidate.evaluation.result.evidence.find(e => e.kind === 'total')!.id;
const indicator = (district: string, key: string) => candidate.evaluation.result.districts.find(d => d.districtId === district)!.indicators.find(i => i.indicatorId === key)!.evidenceId;
const base: QualityContext = { procedure: 'plan', source, candidate, search: { id: searchId, result: search }, requiredConstraints: { ...DEFAULT_CONSTRAINTS, locked: [{ measureId: 'M7', districtId: 'nura' }] }, evaluations: new Map([[source.evaluation.id, source.evaluation], [candidate.evaluation.id, candidate.evaluation]]) };
const good: AnalysisDocument = { candidateRevisionId: candidateId, searchId, claims: ['improvedScore', 'noCriticalPairs', 'preservedLocks', 'optimal'], blocks: [
  { kind: 'benefit', text: 'Расчётный итог улучшается при сохранении школы в Нуре.', refs: [{ evaluationId: candidate.evaluation.id, evidenceId: total, compareToEvaluationId: source.evaluation.id }] },
  { kind: 'tradeoff', text: 'Улучшение воздуха в Сарыарке уступает исходному решению.', refs: [{ evaluationId: candidate.evaluation.id, evidenceId: indicator('saryarka', 'E2'), compareToEvaluationId: source.evaluation.id }] },
  { kind: 'limitation', text: 'Синтетические исходные данные и фиксированные эффекты ограничивают выводы модели.', refs: [] },
] };
const rejected = (document: AnalysisDocument, code: string, context = base) => { const result = checkAnalysis(document, context); assert.equal(result.ok, false); if (!result.ok) assert.ok(result.issues.includes(code), JSON.stringify(result)); };
test('quality accepts evidence-backed benefit, actual tradeoff and preserved school', () => assert.equal(checkAnalysis(good, base).ok, true));
test('rejects numeric prose, unknown and stale evidence', () => {
  const numeric = structuredClone(good); numeric.blocks[0].text += ' Score 99'; rejected(numeric, 'NUMERIC_PROSE_OR_URL');
  const unknown = structuredClone(good); unknown.blocks[0].refs[0].evaluationId = 'someone-else'; rejected(unknown, 'UNKNOWN_EVIDENCE');
  const stale = structuredClone(candidate.evaluation); stale.result.sourceHash = 'old-source'; rejected(good, 'STALE_EVIDENCE', { ...base, evaluations: new Map([[source.evaluation.id, source.evaluation], [stale.id, stale]]) });
});
test('rejects sign mismatch and unsupported claims', () => {
  const wrongSign = structuredClone(good); wrongSign.blocks[1].kind = 'benefit'; rejected(wrongSign, 'BENEFIT_DIRECTION_MISMATCH');
  const all = structuredClone(good); all.claims.push('allDirections'); rejected(all, 'FALSE_ALL_DIRECTIONS');
  rejected(good, 'UNPROVEN_OPTIMALITY', { ...base, search: { id: searchId, result: { ...search, status: 'incomplete', certificate: null } } });
  rejected(good, 'LOST_LOCK', { ...base, requiredConstraints: { ...DEFAULT_CONSTRAINTS, locked: [{ measureId: 'M5', districtId: 'saryarka' }] } });
});
test('infeasibility needs exhaustive empty search and active explicit relaxation', () => {
  const infeasible: AnalysisDocument = { searchId, relaxation: 'requiredDirections', claims: [], blocks: [
    { kind: 'infeasible', text: 'Условия несовместимы; разрешите отказаться от охвата всех направлений.', refs: [] },
    { kind: 'limitation', text: 'Вывод относится только к синтетической модели и заданным условиям.', refs: [] },
  ] };
  const empty = { ...search, candidates: [], feasibleCount: 0, constraints: { ...DEFAULT_CONSTRAINTS, requiredDirections: ['transport', 'ecology', 'social', 'safety', 'services'] as typeof DEFAULT_CONSTRAINTS.requiredDirections, maxCriticalPairs: 0 }, certificate: { ...search.certificate!, bestValue: null, feasibleCount: 0 } };
  const context = { ...base, candidate: undefined, search: { id: searchId, result: empty } };
  assert.equal(checkAnalysis(infeasible, context).ok, true);
  assert.equal(analysisToolSchema.safeParse(infeasible).success, true);
  assert.equal('candidateRevisionId' in analysisToolSchema.parse(infeasible), false);
  rejected({ ...infeasible, candidateRevisionId: sourceId }, 'UNKNOWN_CANDIDATE', context);
  rejected({ ...infeasible, relaxation: 'locked' }, 'ACTIONABLE_RELAXATION_REQUIRED', context);
  rejected(infeasible, 'EXHAUSTIVE_INFEASIBILITY_REQUIRED', { ...context, search: { id: searchId, result: { ...empty, status: 'incomplete', certificate: null } } });
});
test('explain accepts real source social indicator benefit without invented negative effect', () => {
  const explanation: AnalysisDocument = { claims: ['noCriticalPairs'], blocks: [
    { kind: 'benefit', text: 'Школа и поликлиника улучшают социальные показатели Нуры.', refs: source.evaluation.result.districts[4].indicators.filter(i => i.indicatorId === 'S1' || i.indicatorId === 'S2').map(i => ({ evaluationId: source.evaluation.id, evidenceId: i.evidenceId })) },
    { kind: 'limitation', text: 'Это условные эффекты на синтетических данных, а не прогноз реального города.', refs: [] },
  ] };
  assert.equal(checkAnalysis(explanation, { ...base, procedure: 'explain', candidate: undefined, search: undefined }).ok, true);
});
test('hard constraints and multilingual school intent are never weakened', () => {
  for (const text of ['Сохрани школу в Нуре, улучши результат', 'Keep the school in Nura and improve the plan', 'Нұрадағы мектепті сақта']) assert.ok(intentConstraints(DEFAULT_CONSTRAINTS, text).locked.some(d => d.measureId === 'M7' && d.districtId === 'nura'));
  const required = intentConstraints(DEFAULT_CONSTRAINTS, 'Все пять направлений и без критических показателей'); assert.equal(required.requiredDirections?.length, 5); assert.equal(required.maxCriticalPairs, 0);
  assert.ok(hardConditionIssues(required, DEFAULT_CONSTRAINTS).includes('RELAXED_CRITICAL_LIMIT'));
  assert.ok(hardConditionIssues(base.requiredConstraints, { ...DEFAULT_CONSTRAINTS, locked: [{ measureId: 'M7', districtId: 'yesil' }] }).includes('LOST_LOCK'));
});

test('Responses tools explicitly keep optional wire fields optional; local schemas remain strict', () => {
  const tools = createCityTools({} as ToolExecution);
  for (const registered of Object.values(tools)) assert.equal(registered.strict, false);
  assert.equal(analysisToolSchema.safeParse({ ...good, arbitraryOwnership: 'untrusted' }).success, false);
});

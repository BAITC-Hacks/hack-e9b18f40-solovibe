import { randomUUID } from 'node:crypto';
import { tool } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { analysisDocumentSchema, type AnalysisDocument } from '@/features/city/ai-contracts';
import { constraintsSchema, decisionSchema,stressAssumptionSchema } from '@/features/city/contracts';
import { AKIM_DATASET, DEFAULT_CONSTRAINTS } from '@/features/city/data/akim-v1';
import { evaluate, validateDecisions } from '@/features/city/engine';
import { readEvidence } from '@/features/city/evidence';
import { getAttribution } from '@/features/city/attribution';
import { comparePlans } from '../comparisons';
import { searchPlans as exactSearch } from '@/features/city/search';
import { getDb, type CityTx } from '@/server/db/core';
import { cityAnalyses, cityEvaluations, cityRevisions, cityRuns, cityScenarios, citySearches,cityStressTests } from '@/server/db/schema';
import {createStress,getStress} from '../stress';
import type { ToolExecution } from '../job-contracts';
import { CityError } from '../errors';
import { getRevision, insertRevision, requireScenario } from '../scenarios';
import { catalogueForModel, compactEvaluation, compactSearch, failedAnalysisAttempts, freshRun, hardConditionIssues, intentConstraints, loadEvaluation, loadSearch, loadSource, observations,stressForRun,evaluationForRun } from './context';
import { checkAnalysis, type QualityContext } from './quality';

type ToolResult<T> = { ok: true; value: T } | { ok: false; code: string; issues?: unknown };
const empty = z.object({}).strict();
export const analysisToolSchema = analysisDocumentSchema.extend({
  candidateRevisionId: analysisDocumentSchema.shape.candidateRevisionId.describe('Optional. Exact revisionId returned by saveAlternative in this run. OMIT this property for infeasibility and source-only explanations. Never use the source revision ID or invent a branch ID.'),
  searchId: analysisDocumentSchema.shape.searchId.describe('Exact searchId returned by this run. Required for a planned alternative or an infeasibility explanation.'),
});
const decisionsInput = z.object({ decisions: z.array(decisionSchema).max(5) }).strict();
export function createCityTools(execution: ToolExecution) {
  const run = execution.run;
  async function perform<P, T = P>(name: string, input: unknown, prepare: () => Promise<P>, commit?: (tx: CityTx, value: P) => Promise<T>): Promise<ToolResult<T | P>> {
    return execution.tool<ToolResult<T | P>, ToolResult<P>>(name, input, async () => {
      execution.lease.signal.throwIfAborted();
      try { return { ok: true, value: await prepare() }; }
      catch (error) {
        if (error instanceof CityError) return { ok: false, code: error.code, issues: error.fieldIssues };
        throw error;
      }
    }, async (tx, result) => {
      if (!result.ok) return result;
      return { ok: true, value: commit ? await commit(tx, result.value) : result.value };
    });
  }
  async function qualityContext(document: AnalysisDocument): Promise<QualityContext> {
    const source = await loadSource(run);
    const requiredConstraints = intentConstraints(source.revision.constraints, run.objective);
    const evaluations = new Map([[source.evaluation.id, source.evaluation]]);
    const stress=await stressForRun(run);if(stress)evaluations.set(`stress:${stress.id}:baseline`,{id:`stress:${stress.id}:baseline`,revisionId:run.inputRevisionId,result:stress.baseline});
    let candidate: QualityContext['candidate'];
    if (document.candidateRevisionId) {
      const current = await freshRun(run);
      if (!current.alternativeRevisionIds.includes(document.candidateRevisionId)) {
        throw new CityError('UNKNOWN_CANDIDATE', 400, [{ code: 'USE_SAVED_CANDIDATE_OR_OMIT', params: {
          correction: 'For infeasibility or source-only explanation, omit candidateRevisionId entirely. Otherwise use only an exact revisionId returned by saveAlternative in this run. Never use sourceRevisionId.',
        } }]);
      }
      const [row] = await getDb().select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityRevisions)
        .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
        .where(and(eq(cityRevisions.id, document.candidateRevisionId), eq(cityRevisions.scenarioId, run.scenarioId), eq(cityRevisions.sourceRevisionId, run.inputRevisionId)));
      if (!row) throw new CityError('UNKNOWN_CANDIDATE');
      candidate = { revision: { ...row.revision, createdAt: row.revision.createdAt.toISOString() }, evaluation: await evaluationForRun(run,row.evaluation) };
      evaluations.set(candidate.evaluation.id, candidate.evaluation);
    }
    // Only the exact source and selected own-run candidate can support this document.
    const search = document.searchId ? await loadSearch(run, document.searchId) : undefined;
    if (search && hardConditionIssues(requiredConstraints, search.result.constraints).length) throw new CityError('RELAXED_HARD_CONDITION');
    return { procedure: run.procedure==='plan'?'plan':'explain', source, candidate, search, requiredConstraints, evaluations };
  }
  return {
    stressTest:tool({strict:false,description:'Inspect the run-bound sensitivity experiment, or save a requested cost/delay experiment on a selected source measure. Returns real baseline and stressed results; over-budget has no valid Score. Binds subsequent repair/search to exactly this assumption.',inputSchema:z.object({sourceRevisionId:z.string().uuid(),assumption:stressAssumptionSchema}).strict(),execute:input=>perform('stressTest',input,async()=>{if(input.sourceRevisionId!==run.inputRevisionId)throw new CityError('NOT_FOUND',404);await loadSource(run);const existing=await stressForRun(run);if(existing&&(existing.assumption.measureId!==input.assumption.measureId||existing.assumption.costIncreasePct!==input.assumption.costIncreasePct||existing.assumption.extraLagQuarters!==input.assumption.extraLagQuarters))throw new CityError('INVALID_REQUEST');return existing;},async(tx,existing)=>{const p={ownerIds:[run.ownerId],primaryOwnerId:run.ownerId,userId:null,kind:'guest' as const};const s=existing??await createStress(p,{sourceRevisionId:run.inputRevisionId,...input.assumption,clientMutationId:`run:${run.id}`},tx);run.context={...run.context,stressId:s.id};await tx.update(cityRuns).set({context:run.context}).where(eq(cityRuns.id,run.id));return {stressId:s.id,assumption:s.assumption,baseline:compactEvaluation(s.baseline,`stress:${s.id}:baseline`),stressed:compactEvaluation(s.stressed,`stress:${s.id}:stressed`)};})}),
    repairStress:tool({strict:false,description:'Search feasible repairs under the exact saved sensitivity assumption and original commitments. Returns a saved search ID for saveAlternative. Never replaces the source or removes locks silently.',inputSchema:z.object({stressId:z.string().uuid(),constraints:constraintsSchema}).strict(),execute:input=>perform('repairStress',input,async()=>{const p={ownerIds:[run.ownerId],primaryOwnerId:run.ownerId,userId:null,kind:'guest' as const},s=await getStress(p,input.stressId);if(s.experiment.sourceRevisionId!==run.inputRevisionId||s.experiment.scenarioId!==run.scenarioId||run.context.stressId!==input.stressId)throw new CityError('NOT_FOUND',404);const source=await loadSource(run);if(hardConditionIssues(intentConstraints(source.revision.constraints,run.objective),input.constraints).length)throw new CityError('RELAXED_HARD_CONDITION');const result=await exactSearch({datasetVersion:AKIM_DATASET.version,constraints:input.constraints,assumptions:s.experiment.assumption,limit:3,signal:execution.lease.signal});return {id:randomUUID(),result};},async(tx,prepared)=>{await tx.insert(citySearches).values({id:prepared.id,ownerId:run.ownerId,scenarioId:run.scenarioId,inputRevisionId:run.inputRevisionId,runId:run.id,inputHash:prepared.result.inputHash,result:prepared.result});return {searchId:prepared.id,...compactSearch(prepared.result)};})}),
    priceCondition:tool({strict:false,description:'Run two exact searches for the price of ONE added condition, holding every other condition/objective fixed. Baseline explicitly removes only the named condition; it is a diagnostic comparison, never authorization to relax the actual plan. A Score optimality gap requires both exhaustive maxScore results.',
      inputSchema:z.object({sourceRevisionId:z.string().uuid(),constraints:constraintsSchema,changedConstraint:z.enum(['minDirectDistricts','maxCriticalPairs','maxSpend','requiredDirections','locked','excludedMeasureIds','districtFloors','indicatorFloors'])}).strict(),
      execute:input=>perform('priceCondition',input,async()=>{if(input.sourceRevisionId!==run.inputRevisionId)throw new CityError('NOT_FOUND',404);const source=await loadSource(run);if(hardConditionIssues(intentConstraints(source.revision.constraints,run.objective),input.constraints).length)throw new CityError('RELAXED_HARD_CONDITION');
        const base={...input.constraints,[input.changedConstraint]:DEFAULT_CONSTRAINTS[input.changedConstraint]};
        const before=await exactSearch({datasetVersion:AKIM_DATASET.version,constraints:base,limit:1,signal:execution.lease.signal});
        const after=await exactSearch({datasetVersion:AKIM_DATASET.version,constraints:input.constraints,limit:3,signal:execution.lease.signal});return {before,after};
      },async(tx,value)=>{const beforeId=randomUUID(),afterId=randomUUID();for(const [id,result] of [[beforeId,value.before],[afterId,value.after]] as const)await tx.insert(citySearches).values({id,ownerId:run.ownerId,scenarioId:run.scenarioId,inputRevisionId:run.inputRevisionId,runId:run.id,inputHash:result.inputHash,result});return {before:{searchId:beforeId,...compactSearch(value.before)},after:{searchId:afterId,...compactSearch(value.after)},changedConstraint:input.changedConstraint};})}),
    applyAlternative:tool({strict:false,description:'Only for an explicit user request to apply/replace the current plan. Create a new active revision from an owned candidate in the same scenario, preserving history. Suggestion or comparison requests do not authorize this operation; stale current revisions fail.',
      inputSchema:z.object({scenarioId:z.string().uuid(),expectedRevisionId:z.string().uuid(),candidateRevisionId:z.string().uuid()}).strict(),execute:input=>perform('applyAlternative',input,async()=>{if(input.scenarioId!==run.scenarioId||input.expectedRevisionId!==run.inputRevisionId)throw new CityError('STALE_REVISION',409);if(!/(?:примени|замени|используй|apply|replace|қолдан|ауыстыр)/iu.test(run.objective)||/(?:не\s+(?:примен|замен|использ)|do not|don't)/iu.test(run.objective))throw new CityError('FORBIDDEN',403);const p={ownerIds:[run.ownerId],primaryOwnerId:run.ownerId,userId:null,kind:'guest' as const};return getRevision(p,run.scenarioId,input.candidateRevisionId);},async(tx,selected)=>{const p={ownerIds:[run.ownerId],primaryOwnerId:run.ownerId,userId:null,kind:'guest' as const};const scenario=await requireScenario(p,run.scenarioId,tx,true);if(scenario.currentRevisionId!==input.expectedRevisionId)throw new CityError('STALE_REVISION',409);const saved=await insertRevision(tx,{scenarioId:run.scenarioId,decisions:selected.revision.decisions,constraints:selected.revision.constraints,clientMutationId:`apply:${run.id}:${input.candidateRevisionId}`,cause:'apply',parentId:input.expectedRevisionId,sourceRevisionId:input.candidateRevisionId,intent:run.objective});await tx.update(cityScenarios).set({currentRevisionId:saved.revision.id,updatedAt:new Date()}).where(eq(cityScenarios.id,run.scenarioId));return {revisionId:saved.revision.id,evaluation:compactEvaluation(saved.evaluation.result,saved.evaluation.id)};})}),
    getAttribution: tool({strict:false,description:'Exact Shapley allocation of source model Score change over every subset/order. This is model attribution, never real-world causality. Values add to final minus baseline; cite existing source evaluation evidence.',
      inputSchema:z.object({revisionId:z.string().uuid()}).strict(),execute:input=>perform('getAttribution',input,async()=>{if(input.revisionId!==run.inputRevisionId)throw new CityError('NOT_FOUND',404);const source=await loadSource(run);if(!source.evaluation.result.complete)throw new CityError('INVALID_PLAN');return {evaluationId:source.evaluation.id,...getAttribution(AKIM_DATASET,source.revision.decisions)};})}),
    comparePlans: tool({strict:false,description:'Compare up to three owned official revisions from this scenario with exact district, component and decision differences. No ranking across sensitivity assumptions.',
      inputSchema:z.object({revisionIds:z.array(z.string().uuid()).min(1).max(3)}).strict(),execute:input=>perform('comparePlans',input,async()=>{await loadSource(run);const view=await comparePlans({ownerIds:[run.ownerId],primaryOwnerId:run.ownerId,userId:null,kind:'guest'},input.revisionIds);if(view.snapshots.some(s=>s.revision.scenarioId!==run.scenarioId))throw new CityError('NOT_FOUND',404);return view;})}),
    readScenario: tool({
      strict: false,
      description: 'Read the exact source revision bound to this run, its official calculation, available catalogue and required conditions. No arbitrary IDs or owner are accepted. Existing source decisions are not locks unless conditions or user intent pin them.',
      inputSchema: empty,
      execute: input => perform('readScenario', input, async () => {
        const source = await loadSource(run);
        return { scenarioId: run.scenarioId, revisionId: run.inputRevisionId, decisions: source.revision.decisions,
          constraints: intentConstraints(source.revision.constraints, run.objective), evaluation: compactEvaluation(source.evaluation.result, source.evaluation.id),
          dataset: { version: AKIM_DATASET.version, sourceHash: AKIM_DATASET.sourceHash, rulesVersion: AKIM_DATASET.rulesVersion, evaluatorVersion: AKIM_DATASET.evaluatorVersion,
            budget: 100, horizon: 8, measures: catalogueForModel, synergies: AKIM_DATASET.synergies, exclusions: AKIM_DATASET.exclusions },
        };
      }),
    }),
    readEvidence: tool({
      strict: false,
      description: 'Read at most twenty exact numeric evidence nodes from the source evaluation or an alternative saved by this run. IDs come from actual tool results. Unknown/cross-owner or unrelated evaluation IDs fail. Returned numbers supply references for analysis, never prose calculations.',
      inputSchema: z.object({ evaluationId: z.string().min(1).max(160), refs: z.array(z.string().max(300)).min(1).max(20) }).strict(),
      execute: input => perform('readEvidence', input, async () => {
        const evaluation = await loadEvaluation(run, input.evaluationId);
        try { return { evaluationId: evaluation.id, evidence: readEvidence(evaluation.result, input.refs) }; }
        catch { throw new CityError('UNKNOWN_EVIDENCE'); }
      }),
    }),
    validatePlan: tool({
      strict: false,
      description: 'Validate an exact proposed selection under source rules; returns reasons, cost and completeness. Drafts are permitted but have no official Score. Does not save or replace the user plan.',
      inputSchema: decisionsInput,
      execute: input => perform('validatePlan', input, async () => { await loadSource(run); return validateDecisions(AKIM_DATASET, input.decisions,(await stressForRun(run))?.assumption); }),
    }),
    simulatePlan: tool({
      strict: false,
      description: 'Calculate a legal complete five-measure proposal without persisting it. Returns compact outcomes. Ephemeral evidence has no evaluationId and cannot be cited in saved analysis; use a saved search candidate and saveAlternative for durable evidence.',
      inputSchema: decisionsInput,
      execute: input => perform('simulatePlan', input, async () => {
        await loadSource(run); const result = evaluate(AKIM_DATASET, input.decisions,(await stressForRun(run))?.assumption);
        if (!result.valid || !result.complete) throw new CityError('INVALID_PLAN', 400, result.issues);
        return compactEvaluation(result);
      }),
    }),
    searchPlans: tool({
      strict: false,
      description: 'Run actual exhaustive constrained enumeration and save its certificate or incomplete status. Preserve every required source condition and user lock (ID AND target); additional restrictions are allowed. A complete empty result proves infeasibility only for returned exact conditions. At most three searches per run. Incomplete results do not prove optimality.',
      inputSchema: z.object({ constraints: constraintsSchema, limit: z.number().int().min(1).max(3).default(3) }).strict(),
      execute: input => perform('searchPlans', input, async () => {
        const source = await loadSource(run), required = intentConstraints(source.revision.constraints, run.objective);
        const issues = hardConditionIssues(required, input.constraints);
        if (issues.length) throw new CityError('RELAXED_HARD_CONDITION', 400, issues.map(code => ({ code, params: {} })));
        const stress=await stressForRun(run);
        const result = await exactSearch({ datasetVersion: AKIM_DATASET.version, constraints: input.constraints, assumptions:stress?.assumption,limit: input.limit,
          signal: execution.lease.signal, deadlineMs: Math.max(0, Math.min(15000, execution.lease.deadlineAt.getTime() - Date.now() - 1000)) });
        return { id: randomUUID(), result };
      }, async (tx, prepared) => {
        await tx.insert(citySearches).values({ id: prepared.id, ownerId: run.ownerId, scenarioId: run.scenarioId, inputRevisionId: run.inputRevisionId, runId: run.id, inputHash: prepared.result.inputHash, result: prepared.result });
        return { searchId: prepared.id, ...compactSearch(prepared.result) };
      }),
    }),
    saveAlternative: tool({
      strict: false,
      description: 'Persist one legal candidate from this run’s saved search as a branch, never replacing the active plan. Lock and source checks run again. Return actual revision/evaluation IDs, numeric evidence and before/after comparison. Repeated same search/index is idempotent.',
      inputSchema: z.object({ searchId: z.string().uuid(), candidateIndex: z.number().int().min(0).max(2), title: z.string().trim().min(1).max(120) }).strict(),
      execute: input => perform('saveAlternative', input, async () => {
        const source = await loadSource(run), search = await loadSearch(run, input.searchId);
        const candidate = search.result.candidates[input.candidateIndex];
        if (!candidate) throw new CityError('UNKNOWN_CANDIDATE');
        const required = intentConstraints(source.revision.constraints, run.objective);
        if (hardConditionIssues(required, search.result.constraints).length) throw new CityError('RELAXED_HARD_CONDITION');
        if (required.locked.some(l => !candidate.decisions.some(d => d.measureId === l.measureId && d.districtId === l.districtId))) throw new CityError('LOST_LOCK');
        const stress=await stressForRun(run);
        const checked = evaluate(AKIM_DATASET, candidate.decisions,stress?.assumption);
        if (!checked.valid || !checked.complete || checked.score !== candidate.evaluation.score || checked.sourceHash !== candidate.evaluation.sourceHash) throw new CityError('INVALID_PLAN');
        return { source, search, candidate };
      }, async (tx, prepared) => {
        const clientMutationId = `ai:${run.id}:${input.searchId}:${input.candidateIndex}`;
        const [existing] = await tx.select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityRevisions)
          .innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
          .where(and(eq(cityRevisions.scenarioId, run.scenarioId), eq(cityRevisions.clientMutationId, clientMutationId)));
        const saved = existing ?? await insertRevision(tx, { scenarioId: run.scenarioId, decisions: prepared.candidate.decisions,
          constraints: prepared.search.result.constraints, clientMutationId, cause: 'alternative', parentId: run.inputRevisionId,
          sourceRevisionId: run.inputRevisionId, title: input.title, intent: run.objective });
        const current = await freshRun(run, tx);
        await tx.update(cityRuns).set({ alternativeRevisionIds: [...new Set([...current.alternativeRevisionIds, saved.revision.id])], updatedAt: new Date() }).where(eq(cityRuns.id, run.id));
        const stress=await stressForRun(run,tx);
        if(stress)await tx.update(cityStressTests).set({repairRevisionIds:[...new Set([...stress.repairRevisionIds,saved.revision.id])]}).where(eq(cityStressTests.id,stress.id));
        const evaluated=await evaluationForRun(run,saved.evaluation,tx);
        const before = prepared.source.evaluation.result, after = evaluated.result;
        return { revisionId: saved.revision.id, searchId: input.searchId, evaluation: compactEvaluation(after, evaluated.id),
          sourceEvaluationId: prepared.source.evaluation.id,
          comparison: { scoreDelta: before.score === null || after.score === null ? null : after.score - before.score, costDelta: after.cost - before.cost,
            unchanged: after.decisions.filter(d => before.decisions.some(b => b.measureId === d.measureId && b.districtId === d.districtId)),
            added: after.decisions.filter(d => !before.decisions.some(b => b.measureId === d.measureId && b.districtId === d.districtId)),
            removed: before.decisions.filter(d => !after.decisions.some(a => a.measureId === d.measureId && a.districtId === d.districtId)),
            districts: after.districts.map(d => ({ districtId: d.districtId, scoreDelta: d.score - before.districts.find(b => b.districtId === d.districtId)!.score,
              indicators: d.indicators.map(i => ({ indicatorId: i.indicatorId, delta: i.after - before.districts.find(b => b.districtId === d.districtId)!.indicators.find(b => b.indicatorId === i.indicatorId)!.after, evidenceId: i.evidenceId })).filter(i => i.delta !== 0) })) },
        };
      }),
    }),
    saveAnalysis: tool({
      strict: false,
      description: 'Validate and persist the final explanation, with source-bound numeric evidence. No digits in prose: refs render numbers. Include model limitation and a checked benefit/tradeoff or noImprovement. Plans require a saved candidate, or exhaustive infeasibility plus explicit relaxation. False claims, stale refs and sign mismatches fail. One quality repair is allowed.',
      inputSchema: analysisToolSchema,
      execute: input => perform('saveAnalysis', input, async () => {
        const history = await observations(run);
        const failures = failedAnalysisAttempts(history);
        if (failures >= 2) throw new CityError('AI_QUALITY_FAILED');
        const context = await qualityContext(input), checked = checkAnalysis(input, context);
        return checked.ok ? { accepted: true as const, document: checked.document, id: randomUUID() } : { accepted: false as const, issues: checked.issues };
      }, async (tx, prepared) => {
        if (!prepared.accepted) return prepared;
        const current = await freshRun(run, tx);
        if (current.analysisId) return { accepted: true, analysisId: current.analysisId };
        await tx.insert(cityAnalyses).values({ id: prepared.id, runId: run.id, ownerId: run.ownerId, sourceRevisionId: run.inputRevisionId, document: prepared.document });
        await tx.update(cityRuns).set({ analysisId: prepared.id, updatedAt: new Date() }).where(eq(cityRuns.id, run.id));
        return { accepted: true, analysisId: prepared.id };
      }),
    }),
    requestClarification: tool({
      strict: false,
      description: 'Persist one short necessary question when a material goal cannot be mapped to supported conditions. Releases the run to waiting_input. Never use for routine permissions, missing provider configuration or already explicit goals.',
      inputSchema: z.object({ question: z.string().trim().min(10).max(500) }).strict(),
      execute: input => perform('requestClarification', input, async () => { await loadSource(run); return input; }, async (tx, prepared) => {
        const current = await freshRun(run, tx);
        if (current.analysisId) throw new CityError('AI_ALREADY_COMPLETED');
        const question = current.question ?? prepared.question;
        await tx.update(cityRuns).set({ question, updatedAt: new Date() }).where(eq(cityRuns.id, run.id));
        return { waitingInput: true, question };
      }),
    }),
  };
}




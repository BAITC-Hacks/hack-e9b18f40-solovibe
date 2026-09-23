import { generateText, tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import { briefDraftSchema } from '@/features/city/brief/contracts';
import { getLanguageModel, openaiOptions } from '@/server/ai-core';
import type { ToolExecution } from '../job-contracts';
import type { Principal } from '../principal';
import { CityError } from '../errors';
import { briefEvaluations, checkBriefDrafts, commitGeneratedBrief, getBrief } from '../briefs';
import { freshRun, observations,catalogueForModel } from './context';
import { BRIEF_PROCEDURE } from './prompts/brief';

export async function runBrief(execution: ToolExecution): Promise<{ status: 'completed' }> {
  const run = execution.run;
  const { briefId, briefVersion, sectionIds } = run.context;
  if (!briefId || !briefVersion) throw new CityError('INVALID_REQUEST');
  const p: Principal = { ownerIds: [run.ownerId], primaryOwnerId: run.ownerId, userId: null, kind: 'guest' };
  async function scopedView() {
    const view = await getBrief(p, briefId!);
    if (view.brief.scenarioId !== run.scenarioId || view.brief.sourceRevisionId !== run.inputRevisionId) throw new CityError('STALE_EVIDENCE');
    return view;
  }
  const initial = await scopedView();
  if (initial.brief.lastRunId === run.id) return { status: 'completed' };
  if (initial.brief.version !== briefVersion) throw new CityError('STALE_BRIEF', 409);
  if (!process.env.OPENAI_API_KEY?.trim()) throw new CityError('AI_UNAVAILABLE', 503);
  const writeSchema = z.object({ briefId: z.string().uuid(), expectedVersion: z.number().int().positive(), sectionDrafts: z.array(briefDraftSchema).min(1).max(7) }).strict();
  const write = async (name: 'writeBrief' | 'updateBrief', input: z.infer<typeof writeSchema>) => execution.tool(name, input, async () => {
    if (input.briefId !== briefId || input.expectedVersion !== briefVersion) return { ok: false as const, issues: ['BRIEF_SCOPE_MISMATCH'] };
    const view = await scopedView();
    if (view.brief.version !== briefVersion) throw new CityError('STALE_BRIEF', 409);
    const issues = checkBriefDrafts(view, input.sectionDrafts, sectionIds);
    return issues.length ? { ok: false as const, issues } : { ok: true as const, drafts: input.sectionDrafts };
  }, async (tx, result) => {
    if (!result.ok) return result;
    return { ok: true as const, value: await commitGeneratedBrief(tx, p, briefId!, briefVersion!, result.drafts, sectionIds, run.id) };
  });
  const tools = {
    readBrief: tool({ strict: false, description: 'Read the run-scoped saved brief, protected user text and exact source evaluation refs. No other brief is accessible.', inputSchema: z.object({ briefId: z.string().uuid() }).strict(), execute: input => execution.tool('readBrief', input, async () => {
      if (input.briefId !== briefId) throw new CityError('NOT_FOUND', 404);
      const view = await scopedView();
      if (view.brief.version !== briefVersion) throw new CityError('STALE_BRIEF', 409);
      return { brief: view.brief, allowedSections: view.brief.sections.filter(s => sectionIds ? sectionIds.includes(s.id) : !s.userEdited).map(s => s.id), constraints: view.source.revision.constraints, decisions: view.source.revision.decisions, catalogue: catalogueForModel, sourceEvaluationId: view.source.evaluation.id, comparisons: view.comparisons.map(c => ({ revisionId: c.revision.id, evaluationId: c.evaluation.id, decisions: c.revision.decisions })), assumption: view.stress?.experiment.assumption ?? null,
        evaluations: [...briefEvaluations(view).values()].map(e => ({ id: e.id, revisionId: e.revisionId, kind: e.result.kind, cost: e.result.cost, score: e.result.score, directDistrictIds: e.result.directDistrictIds, weakestDistrictIds: e.result.weakestDistrictIds, criticalPairs: e.result.criticalPairs, districts: e.result.districts.map(d=>({districtId:d.districtId,score:d.score,indicators:d.indicators.filter(i=>i.delta!==0||i.after<42)})), evidence: e.result.evidence.filter(r => ['indicator', 'synergy', 'critical', 'district', 'total'].includes(r.kind)).map(r=>({id:r.id,kind:r.kind,value:r.value,districtId:r.districtId,indicatorId:r.indicatorId})) })) };
    }) }),
    writeBrief: tool({ strict: false, description: 'Validate and atomically save all authorized sections as a new immutable brief version. Never generate numerical prose; cite the saved refs.', inputSchema: writeSchema, execute: input => write('writeBrief', input) }),
    updateBrief: tool({ strict: false, description: 'Refine exactly the explicitly selected sections, preserving all others. Uses the same source and expected-version checks as writeBrief.', inputSchema: writeSchema, execute: input => write('updateBrief', input) }),
  };
  const savedObservations = await observations(run);
  const rejectedWrites = (history: typeof savedObservations) => history.filter(item => ['writeBrief', 'updateBrief'].includes(item.toolName) && item.output && typeof item.output === 'object' && 'ok' in item.output && item.output.ok === false).length;
  const messages: ModelMessage[] = [{ role: 'user', content: JSON.stringify({ objective: run.objective, locale: run.locale, briefId, expectedVersion: briefVersion, sectionIds: sectionIds ?? null, savedObservations, resumeInstruction: 'Reuse committed source observations. A rejected write was not persisted; correct its explicit issues once. Do not attribute these saved records to a model conversation.' }) }];
  let outputTokens = run.usage.outputTokens;
  const deadline = Math.min(execution.lease.deadlineAt.getTime(), Date.now() + 120000);
  for (let step = 0; step < 8; step++) {
    execution.lease.signal.throwIfAborted();
    const state = await freshRun(run);
    if (rejectedWrites(await observations(run)) >= 2) throw new CityError('AI_QUALITY_FAILED');
    if (state.toolCount >= 8 || outputTokens >= 4000) throw new CityError('AI_LIMIT_REACHED');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new CityError('PROVIDER_TIMEOUT', 504);
    const result = await generateText({ model: getLanguageModel(), providerOptions: { openai: { ...openaiOptions.openai, parallelToolCalls: false } }, system: BRIEF_PROCEDURE, messages, tools, toolChoice: 'required', maxRetries: 1, maxOutputTokens: Math.min(2800, 4000 - outputTokens), abortSignal: AbortSignal.any([execution.lease.signal, AbortSignal.timeout(Math.min(60000, remaining))]), onStepEnd: async event => {
      const output = event.usage.outputTokens ?? 0;
      outputTokens += output;
      await execution.updateUsage(event.usage.inputTokens ?? 0, output);
    } });
    messages.push(...result.response.messages);
    if ((await scopedView()).brief.lastRunId === run.id) return { status: 'completed' };
    if (!result.toolCalls.length) throw new CityError('AI_QUALITY_FAILED');
  }
  throw new CityError('AI_LIMIT_REACHED');
}

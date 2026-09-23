import { generateText, type ModelMessage } from 'ai';
import { and, eq } from 'drizzle-orm';
import { getLanguageModel, openaiOptions } from '@/server/ai-core';
import { getDb } from '@/server/db/core';
import { cityAnalyses } from '@/server/db/schema';
import type { ToolExecution } from '../job-contracts';
import { CityError } from '../errors';
import { AKIM_DATASET } from '@/features/city/data/akim-v1';
import { catalogueForModel, compactEvaluation, conversationContext, failedAnalysisAttempts, freshRun, intentConstraints, loadSource, observations } from './context';
import { createCityTools } from './tools';
import { COMMON_PROCEDURE } from './prompts/common';
import { PLAN_PROCEDURE } from './prompts/plan';
import { EXPLAIN_PROCEDURE } from './prompts/explain';

/** Each model call is one adaptive step. Only durable tool artifacts can complete a run. */
export async function runAnalysis(execution: ToolExecution): Promise<{ status: 'completed' | 'waiting_input'; question?: string }> {
  if (!process.env.OPENAI_API_KEY) throw new CityError('AI_UNAVAILABLE', 503);
  const run = execution.run;
  const source = await loadSource(run);
  const completed = async () => {
    const current = await freshRun(run);
    if (current.analysisId) {
      const [analysis] = await getDb().select().from(cityAnalyses).where(and(eq(cityAnalyses.id, current.analysisId), eq(cityAnalyses.runId, run.id), eq(cityAnalyses.ownerId, run.ownerId), eq(cityAnalyses.sourceRevisionId, run.inputRevisionId)));
      if (!analysis) throw new CityError('AI_QUALITY_FAILED');
      if (analysis.document.candidateRevisionId && !current.alternativeRevisionIds.includes(analysis.document.candidateRevisionId)) throw new CityError('AI_QUALITY_FAILED');
      return { status: 'completed' as const };
    }
    if (current.question) return { status: 'waiting_input' as const, question: current.question };
    return null;
  };
  const resumedResult = await completed();
  if (resumedResult) return resumedResult;
  const savedObservations = await observations(run);
  const previousTurns = await conversationContext(run);
  const messages: ModelMessage[] = [{ role: 'user', content: JSON.stringify({
    userRequest: run.objective, fallbackLocale: run.locale, procedure: run.procedure,
    source: { scenarioId: run.scenarioId, revisionId: source.revision.id, decisions: source.revision.decisions,
      requiredConstraints: intentConstraints(source.revision.constraints, run.objective), evaluation: compactEvaluation(source.evaluation.result, source.evaluation.id) },
    catalogue: catalogueForModel, synergies: AKIM_DATASET.synergies,
    savedObservationSummary: savedObservations,
    previousConversation: previousTurns,
    conversationRule: 'Interpret follow-up pronouns and priorities using these owned previous turns. The current source and current request take precedence. A previous proposal was not applied unless it matches the current source. Preserve explicit commitments when continuing a goal, and ask one question if the intended plan is ambiguous. Obtain fresh evidence IDs for this run; never cite historical IDs as current evidence.',
    resumeInstruction: 'These are committed prior observations, not messages attributed to a model. Continue from saved IDs without repeating mutations.',
  }) }];
  const tools = createCityTools(execution);
  let outputTokens = run.usage.outputTokens;
  for (let step = 0; step < 8; step++) {
    execution.lease.signal.throwIfAborted();
    const state = await freshRun(run);
    if (state.toolCount >= 8 || outputTokens >= 4000) throw new CityError('AI_LIMIT_REACHED');
    const remainingMs = execution.lease.deadlineAt.getTime() - Date.now();
    if (remainingMs <= 0) throw new CityError('PROVIDER_TIMEOUT', 504);
    const result = await generateText({
      model: getLanguageModel(), providerOptions: { openai: { ...openaiOptions.openai, parallelToolCalls: false } },
      system: `${COMMON_PROCEDURE}\n${run.procedure === 'plan' ? PLAN_PROCEDURE : EXPLAIN_PROCEDURE}`,
      messages, tools, toolChoice: 'required', maxRetries: 1,
      maxOutputTokens: Math.min(1800, 4000 - outputTokens),
      abortSignal: AbortSignal.any([execution.lease.signal, AbortSignal.timeout(Math.min(60000, remainingMs))]),
      onStepEnd: async event => {
        const input = event.usage.inputTokens ?? 0, output = event.usage.outputTokens ?? 0;
        outputTokens += output;
        await execution.updateUsage(input, output);
      },
    });
    messages.push(...result.response.messages);
    const saved = await completed();
    if (saved) return saved;
    const history = await observations(run);
    const qualityFailures = failedAnalysisAttempts(history);
    if (qualityFailures >= 2) throw new CityError('AI_QUALITY_FAILED');
    if (!result.toolCalls.length) throw new CityError('AI_QUALITY_FAILED');
  }
  throw new CityError('AI_LIMIT_REACHED');
}



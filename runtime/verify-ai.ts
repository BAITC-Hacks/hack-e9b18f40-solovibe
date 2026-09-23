import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { RunView } from '../src/features/city/ai-contracts';
import type { ScenarioView } from '../src/features/city/records';
import type { SearchResult } from '../src/features/city/contracts';
import { DIRECTIONS } from '../src/features/city/contracts';
import { DEFAULT_CONSTRAINTS } from '../src/features/city/data/akim-v1';
import { getSql } from '../src/server/db/core';
import { checkAnalysis } from '../src/server/city/ai/quality';
import { intentConstraints } from '../src/server/city/ai/context';

const base = new URL(process.env.CITY_TEST_URL ?? 'http://localhost:3000');
const sql = getSql();
const cookies = new Map<string, string>();
const scenarios = new Set<string>(), runs = new Set<string>(), owners = new Set<string>();
const testId = randomUUID();
const started = Date.now();
async function request<T>(method: string, path: string, body?: unknown, statuses = [200]): Promise<T> {
  const response = await fetch(new URL(path, base), { method, signal: AbortSignal.timeout(30000),
    headers: { Origin: base.origin, 'Content-Type': 'application/json', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0], at = pair.indexOf('=');
    if (at > 0) cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  const text = await response.text();
  assert.ok(statuses.includes(response.status), `${method} ${path}: HTTP ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}
async function example(suffix: string) {
  const view = await request<ScenarioView>('POST', '/api/city/scenarios', { source: 'example', title: `verify-ai-${testId}-${suffix}`, clientMutationId: randomUUID() }, [200, 201]);
  scenarios.add(view.scenario.id);
  const [row] = await sql<{ owner_id: string }[]>`select owner_id from city_scenarios where id=${view.scenario.id}`;
  assert.ok(row); owners.add(row.owner_id);
  return view;
}
async function launch(source: ScenarioView, objective: string) {
  const view = await request<RunView>('POST', '/api/city/runs', { scenarioId: source.scenario.id, inputRevisionId: source.revision.id, procedure: 'plan', objective, locale: 'ru', clientRequestId: randomUUID() }, [202]);
  runs.add(view.run.id);
  return view;
}
async function waitForRun(initial: RunView) {
  const deadline = Date.now() + 130000;
  let current = initial, previous = '';
  while (Date.now() < deadline) {
    const state = `${current.run.status}:${current.events.at(-1)?.toolName ?? ''}`;
    if (state !== previous) { console.log(JSON.stringify({ runId: current.run.id, status: current.run.status, tool: current.events.at(-1)?.toolName ?? null })); previous = state; }
    if (['completed', 'failed', 'cancelled', 'waiting_input'].includes(current.run.status)) {
      assert.equal(current.run.status, 'completed', `run ${current.run.id}: ${current.run.status}/${current.run.errorCode}`);
      return current;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
    current = await request<RunView>('GET', `/api/city/runs/${current.run.id}`);
  }
  throw new Error(`Run deadline exceeded: ${initial.run.id}`);
}
async function searchFor(view: RunView) {
  assert.ok(view.analysis?.document.searchId);
  const [search] = await sql<{ id: string; result: SearchResult; run_id: string; input_revision_id: string }[]>`select id,result,run_id,input_revision_id from city_searches where id=${view.analysis.document.searchId}`;
  assert.ok(search); assert.equal(search.run_id, view.run.id); assert.equal(search.input_revision_id, view.run.inputRevisionId);
  return search;
}
async function assertQuality(view: RunView, source: ScenarioView) {
  assert.ok(view.analysis);
  const search = await searchFor(view);
  const candidate = view.alternatives.find(a => a.revision.id === view.analysis!.document.candidateRevisionId);
  const context = { procedure: 'plan' as const, source, candidate, search,
    requiredConstraints: intentConstraints(source.revision.constraints, view.run.objective),
    evaluations: new Map([[source.evaluation.id, source.evaluation], ...view.alternatives.map(a => [a.evaluation.id, a.evaluation] as const)]),
  };
  const result = checkAnalysis(view.analysis.document, context);
  assert.equal(result.ok, true, result.ok ? '' : result.issues.join(','));
  const receipts = await sql<{ tool_name: string; status: string }[]>`select tool_name,status from city_tool_receipts where run_id=${view.run.id}`;
  assert.ok(receipts.some(r => r.tool_name === 'searchPlans' && r.status === 'completed'));
  assert.ok(receipts.some(r => r.tool_name === 'saveAnalysis' && r.status === 'completed'));
  assert.ok(receipts.length <= 8);
  return { search, candidate, receiptCount: receipts.length };
}
async function verify() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), 'OPENAI_API_KEY is required for the deliberate live verification');
  const selectedCase = (process.env.CITY_VERIFY_CASE ?? 'both').toLowerCase();
  assert.ok(['both', 'v3', 'v4'].includes(selectedCase), 'CITY_VERIFY_CASE must be both, V3 or V4');
  if (selectedCase !== 'v4') {
  const firstStarted = Date.now();
  const source = await example('preserve-school');
  const initial = await launch(source, 'Сохрани школу в Нуре, улучши результат');
  const result = await waitForRun(initial);
  const { search, candidate, receiptCount } = await assertQuality(result, source);
  assert.ok(candidate); assert.ok(candidate.evaluation.result.valid && candidate.evaluation.result.complete);
  assert.equal(candidate.revision.decisions.length, 5);
  assert.ok(candidate.revision.decisions.some(d => d.measureId === 'M7' && d.districtId === 'nura'));
  assert.ok(search.result.constraints.locked.some(d => d.measureId === 'M7' && d.districtId === 'nura'));
  assert.ok(candidate.evaluation.result.score! > source.evaluation.result.score!);
  const unchanged = await request<ScenarioView>('GET', `/api/city/scenarios/${source.scenario.id}`);
  assert.equal(unchanged.revision.id, source.revision.id);
  const reopened = await request<RunView>('GET', `/api/city/runs/${result.run.id}`);
  assert.equal(reopened.analysis?.id, result.analysis?.id);
  assert.equal(reopened.alternatives.find(a => a.revision.id === candidate.revision.id)?.evaluation.id, candidate.evaluation.id);
  const applied = await request<ScenarioView>('POST', `/api/city/scenarios/${source.scenario.id}/apply`, { revisionId: candidate.revision.id, expectedRevisionId: source.revision.id, clientMutationId: randomUUID() });
  assert.deepEqual(applied.revision.decisions, candidate.revision.decisions);
  assert.equal(applied.revision.sourceRevisionId, candidate.revision.id);
  assert.equal(applied.revision.cause, 'apply');
  assert.equal(applied.evaluation.result.score, candidate.evaluation.result.score);
  assert.ok(Date.now() - firstStarted < 300000);
  console.log(JSON.stringify({ verification: 'V3', model: process.env.OPENAI_MODEL ?? 'configured-default', runId: result.run.id, analysisId: result.analysis!.id, candidateRevisionId: candidate.revision.id, score: candidate.evaluation.result.score, tools: receiptCount, durationMs: Date.now() - firstStarted }));

  }
  if (selectedCase !== 'v3') {
  let impossibleSource = await example('infeasible');
  impossibleSource = await request<ScenarioView>('POST', `/api/city/scenarios/${impossibleSource.scenario.id}/revisions`, { expectedRevisionId: impossibleSource.revision.id, decisions: impossibleSource.revision.decisions,
    constraints: { ...DEFAULT_CONSTRAINTS, requiredDirections: [...DIRECTIONS], maxCriticalPairs: 0 }, clientMutationId: randomUUID() });
  const impossible = await waitForRun(await launch(impossibleSource, 'Найди план по всем пяти направлениям без критических показателей'));
  const checked = await assertQuality(impossible, impossibleSource);
  assert.equal(checked.search.result.status, 'complete'); assert.equal(checked.search.result.feasibleCount, 0);
  assert.equal(checked.search.result.certificate?.exhaustive, true);
  assert.equal(impossible.alternatives.length, 0); assert.equal(impossible.analysis!.document.candidateRevisionId, undefined);
  assert.ok(impossible.analysis!.document.blocks.some(b => b.kind === 'infeasible')); assert.ok(impossible.analysis!.document.relaxation);
  const impossibleReload = await request<ScenarioView>('GET', `/api/city/scenarios/${impossibleSource.scenario.id}`);
  assert.equal(impossibleReload.revision.id, impossibleSource.revision.id);
  console.log(JSON.stringify({ verification: 'V4', runId: impossible.run.id, analysisId: impossible.analysis!.id, searchId: checked.search.id, evaluated: checked.search.result.evaluatedCount, feasible: 0, relaxation: impossible.analysis!.document.relaxation }));
  }
  console.log(JSON.stringify({ verification: 'live-ai-complete', durationMs: Date.now() - started, model: process.env.OPENAI_MODEL ?? 'configured-default' }));
}
async function cleanup() {
  for (const id of runs) {
    try { await request('POST', `/api/city/runs/${id}/cancel`, {}); } catch { /* Scoped SQL cleanup below also fences the removed job. */ }
  }
  await sql.begin(async tx => {
    if (runs.size) await tx`delete from city_runs where id in ${tx([...runs])}`;
    if (scenarios.size) {
      await tx`update city_revisions set parent_id=null,source_revision_id=null where scenario_id in ${tx([...scenarios])}`;
      await tx`delete from city_scenarios where id in ${tx([...scenarios])}`;
    }
    if (owners.size) await tx`delete from city_owners where id in ${tx([...owners])} and not exists(select 1 from city_scenarios where owner_id=city_owners.id)`;
  });
}
let successful = false;
try { await verify(); successful = true; }
catch (error) {
  if (runs.size) {
    const receipts = await sql<{ run_id: string; tool_name: string; status: string; output: { ok?: boolean; code?: string; issues?: unknown; value?: { accepted?: boolean; issues?: unknown } } | null }[]>`select run_id,tool_name,status,output from city_tool_receipts where run_id in ${sql([...runs])} order by created_at`;
    console.error(JSON.stringify({ verification: 'failed-artifacts-retained', scenarios: [...scenarios], runs: [...runs], owners: [...owners], receipts: receipts.map(r => ({ runId: r.run_id, tool: r.tool_name, status: r.status, ok: r.output?.ok, code: r.output?.code, issues: r.output?.issues ?? r.output?.value?.issues, accepted: r.output?.value?.accepted })) }));
  }
  throw error;
} finally {
  try { if (successful || process.env.CITY_VERIFY_CLEANUP_ON_FAILURE === 'true') await cleanup(); }
  finally { await sql.end({ timeout: 5 }); }
}




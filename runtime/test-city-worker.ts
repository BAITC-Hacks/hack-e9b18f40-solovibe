import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { AKIM_DATASET, DEFAULT_CONSTRAINTS, EXAMPLE_DECISIONS } from '../src/features/city/data/akim-v1';
import { getDb } from '../src/server/db/core';
import { cityAnalyses, cityDatasets, cityJobs, cityOwners, cityRuns } from '../src/server/db/schema';
import { claimJob, createExecution, LeaseLostError, renewLease, withLease } from '../src/server/city/jobs';
import { cancelRun, createRun, getRun } from '../src/server/city/runs';
import { createScenario, getScenario, insertRevision, saveRevision } from '../src/server/city/scenarios';
import { conversationContext, loadEvaluation, loadSource } from '../src/server/city/ai/context';
import type { JobLease } from '../src/server/city/job-contracts';
import type { Principal } from '../src/server/city/principal';
import { CityError } from '../src/server/city/errors';

assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
const admin = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const schema = `city_worker_test_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^city_worker_test_[a-f0-9]{32}$/);
let created = false;
let isolated: ReturnType<typeof postgres> | undefined;
let passed = 0;
const globalDb = globalThis as unknown as { citySql?: ReturnType<typeof postgres> };
assert.equal(globalDb.citySql, undefined, 'Run this test as its own process; do not replace an existing pool');
const check = (name: string) => { passed++; console.log(`PASS ${name}`); };
const nowPlus = (ms: number) => new Date(Date.now() + ms);

async function owner() {
  const id = randomUUID();
  await getDb().insert(cityOwners).values({ id, guestTokenHash: randomUUID(), expiresAt: nowPlus(3600000) });
  const principal: Principal = { ownerIds: [id], primaryOwnerId: id, userId: null, kind: 'guest' };
  const scenario = await createScenario(principal, { source: 'example', clientMutationId: randomUUID(), title: 'Isolated worker fixture' });
  return { id, principal, scenario };
}
type Owner = Awaited<ReturnType<typeof owner>>;
async function queued(scope: Owner, options: { deadlineAt?: Date; status?: 'queued' | 'running'; attempts?: number } = {}) {
  const runId = randomUUID(), jobId = randomUUID();
  const deadlineAt = options.deadlineAt ?? nowPlus(120000), status = options.status ?? 'queued';
  await getDb().insert(cityRuns).values({ id: runId, ownerId: scope.id, quotaKey: `guest:${scope.id}`, scenarioId: scope.scenario.scenario.id,
    inputRevisionId: scope.scenario.revision.id, procedure: 'plan', objective: 'Deterministic worker fixture', locale: 'ru', inputHash: randomUUID(), clientRequestId: randomUUID(), status, deadlineAt });
  await getDb().insert(cityJobs).values({ id: jobId, kind: 'analysis', runId, ownerId: scope.id, quotaKey: `guest:${scope.id}`, status,
    attempts: options.attempts ?? (status === 'running' ? 1 : 0), leaseToken: status === 'running' ? 1 : 0, workerId: status === 'running' ? 'fixture' : null,
    leaseUntil: status === 'running' ? nowPlus(30000) : null, deadlineAt });
  return { runId, jobId, deadlineAt };
}
function lease(scope: Owner, job: { runId: string; jobId: string; deadlineAt: Date }, token = 1): JobLease {
  return { id: job.jobId, runId: job.runId, ownerId: scope.id, token, workerId: 'fixture', deadlineAt: job.deadlineAt, signal: new AbortController().signal };
}
async function missingKey() {
  const scope = await owner(), original = process.env.OPENAI_API_KEY;
  const input = { scenarioId: scope.scenario.scenario.id, inputRevisionId: scope.scenario.revision.id, procedure: 'plan' as const, objective: 'Keep the school in Nura', locale: 'en' as const, clientRequestId: randomUUID() };
  try {
    delete process.env.OPENAI_API_KEY;
    const result = await createRun(scope.principal, input, `isolated-${schema}`);
    assert.equal(result.run.status, 'failed'); assert.equal(result.run.errorCode, 'AI_UNAVAILABLE'); assert.equal(result.run.objective, input.objective);
    const again = await createRun(scope.principal, input, `isolated-${schema}`);
    assert.equal(again.run.id, result.run.id);
    const jobs = await getDb().select().from(cityJobs).where(eq(cityJobs.runId, result.run.id)); assert.equal(jobs.length, 0);
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
  check('missing key persists one failed request, idempotent retry creates no job');
}
async function cancellation() {
  const scope = await owner(), job = await queued(scope, { status: 'running' }), active = lease(scope, job);
  const execution = await createExecution(active); let committed = false;
  await assert.rejects(execution.tool('saveAlternative', { fixture: 'cancel-during-prepare' }, async () => {
    await cancelRun(scope.principal, job.runId); return 'prepared';
  }, async () => { committed = true; return 'incorrect'; }), LeaseLostError);
  assert.equal(committed, false);
  const [row] = await isolated!<{ status: string }[]>`select status from city_tool_receipts where run_id=${job.runId}`;
  assert.equal(row.status, 'started');
  await assert.rejects(withLease(active, async () => 'incorrect'), LeaseLostError);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(createExecution({ ...active, signal: aborted.signal }));
  check('cancellation during prepare prevents commit; aborted/fenced leases cannot execute');
}
async function receiptsAndStaleSource() {
  const scope = await owner(), outsider = await owner(), job = await queued(scope, { status: 'running' }), active = lease(scope, job);
  const first = await createExecution(active);
  const args = { searchId: 'deterministic-failure-injection', candidateIndex: 0 };
  const save = () => first.tool('saveAlternative', args, async () => EXAMPLE_DECISIONS, async (tx, decisions) => {
    const saved = await insertRevision(tx, { scenarioId: scope.scenario.scenario.id, decisions, constraints: DEFAULT_CONSTRAINTS, clientMutationId: `fixture:${job.runId}`, cause: 'alternative', sourceRevisionId: scope.scenario.revision.id });
    await tx.update(cityRuns).set({ alternativeRevisionIds: [saved.revision.id] }).where(eq(cityRuns.id, job.runId));
    return { revisionId: saved.revision.id, evaluationId: saved.evaluation.id };
  });
  const saved = await save();
  const resumed = await createExecution(active);
  const recovered = await resumed.tool('saveAlternative', args, async () => { throw new Error('A committed preparation must not repeat'); }, async () => { throw new Error('A committed mutation must not repeat'); });
  assert.deepEqual(recovered, saved);
  const [count] = await isolated!<{ count: number }[]>`select count(*)::int as count from city_revisions where scenario_id=${scope.scenario.scenario.id} and cause='alternative'`;
  assert.equal(count.count, 1);
  const current = await saveRevision(scope.principal, scope.scenario.scenario.id, { expectedRevisionId: scope.scenario.revision.id,
    decisions: EXAMPLE_DECISIONS.map(d => d.measureId === 'M5' ? { ...d, districtId: 'almaty' } : d), constraints: DEFAULT_CONSTRAINTS, clientMutationId: randomUUID() });
  await resumed.tool('saveAlternative', { ...args, candidateIndex: 1 }, async () => EXAMPLE_DECISIONS, async (tx, decisions) => {
    const branch = await insertRevision(tx, { scenarioId: scope.scenario.scenario.id, decisions, constraints: DEFAULT_CONSTRAINTS, clientMutationId: `fixture:${job.runId}:second`, cause: 'alternative', sourceRevisionId: scope.scenario.revision.id });
    return { revisionId: branch.revision.id };
  });
  assert.equal((await getScenario(scope.principal, scope.scenario.scenario.id)).revision.id, current.revision.id);
  assert.equal((await getRun(scope.principal, job.runId)).stale, true);
  await assert.rejects(getRun(outsider.principal, job.runId), (error: unknown) => error instanceof CityError && error.code === 'NOT_FOUND');
  await assert.rejects(loadEvaluation(first.run, outsider.scenario.evaluation.id), (error: unknown) => error instanceof CityError && error.code === 'UNKNOWN_EVIDENCE');
  await assert.rejects(withLease({ ...active, ownerId: outsider.id }, async () => 'incorrect'), LeaseLostError);
  await cancelRun(scope.principal, job.runId);
  check('restart reuses committed receipt; source edit stays active; foreign run/evidence scope denied');
}
async function queueLimits() {
  const a = await owner(), b = await owner(), c = await owner();
  const fixtures = [await queued(a), await queued(a), await queued(b), await queued(c)];
  const claims = await Promise.all(Array.from({ length: 4 }, (_, i) => claimJob(`fixture-${i}`)));
  const claimed = claims.filter(c => c !== null);
  assert.equal(claimed.length, 2); assert.equal(new Set(claimed.map(c => c.quotaKey)).size, 2);
  assert.equal(await claimJob('at-capacity'), null);
  for (const job of fixtures) {
    const scope = job === fixtures[0] || job === fixtures[1] ? a : job === fixtures[2] ? b : c;
    await cancelRun(scope.principal, job.runId);
  }
  check('concurrent real claims enforce global two slots and one per quota');
}
async function reclaimAndDeadline() {
  const scope = await owner(), fixture = await queued(scope);
  const first = await claimJob('before-restart'); assert.equal(first?.id, fixture.jobId);
  const oldLease = lease(scope, fixture, first!.leaseToken);
  assert.equal(await renewLease(fixture.jobId, first!.leaseToken), true);
  await getDb().update(cityJobs).set({ leaseUntil: nowPlus(-1000) }).where(eq(cityJobs.id, fixture.jobId));
  const second = await claimJob('after-restart'); assert.equal(second?.id, fixture.jobId); assert.equal(second!.attempts, 2); assert.ok(second!.leaseToken > first!.leaseToken);
  await assert.rejects(withLease(oldLease, async () => 'incorrect'), LeaseLostError);
  assert.equal(await renewLease(fixture.jobId, first!.leaseToken), false);
  await withLease(lease(scope, fixture, second!.leaseToken), async () => 'new fence accepted');
  await getDb().update(cityJobs).set({ leaseUntil: nowPlus(-1000) }).where(eq(cityJobs.id, fixture.jobId));
  assert.equal(await claimJob('attempt-limit'), null);
  const failed = await getRun(scope.principal, fixture.runId); assert.equal(failed.run.status, 'failed');
  const deadline = await queued(scope, { deadlineAt: nowPlus(-1000) });
  assert.equal(await claimJob('past-deadline'), null);
  assert.equal((await getRun(scope.principal, deadline.runId)).run.status, 'failed');
  check('expired lease reclaims once with new fence; second expiry and total deadline fail');
}
async function durableConversation() {
  const scope = await owner(), outsider = await owner();
  async function turn(objective: string, parentRunId: string | null, overrides: { ownerId?: string; scenarioId?: string; inputRevisionId?: string } = {}) {
    const [row] = await getDb().insert(cityRuns).values({ id: randomUUID(), ownerId: overrides.ownerId ?? scope.id, quotaKey: `guest:${scope.id}`,
      scenarioId: overrides.scenarioId ?? scope.scenario.scenario.id, inputRevisionId: overrides.inputRevisionId ?? scope.scenario.revision.id,
      parentRunId, procedure: 'plan', objective, locale: 'ru', inputHash: randomUUID(), clientRequestId: randomUUID(), status: 'completed', deadlineAt: nowPlus(120000) }).returning();
    return row;
  }
  const first = await turn('Initial owned request', null);
  const proposed = await getDb().transaction(tx => insertRevision(tx, { scenarioId: scope.scenario.scenario.id, decisions: EXAMPLE_DECISIONS,
    constraints: DEFAULT_CONSTRAINTS, clientMutationId: randomUUID(), cause: 'alternative', sourceRevisionId: scope.scenario.revision.id }));
  await getDb().update(cityRuns).set({ alternativeRevisionIds: [proposed.revision.id], question: 'Which district should receive the next investment?' }).where(eq(cityRuns.id, first.id));
  await getDb().insert(cityAnalyses).values({ id: randomUUID(), runId: first.id, ownerId: scope.id, sourceRevisionId: scope.scenario.revision.id,
    document: { candidateRevisionId: proposed.revision.id, claims: [], blocks: [
      { kind: 'benefit', text: 'Saved fixture explanation of the proposed school.', refs: [] },
      { kind: 'limitation', text: 'Fixture uses the synthetic city model.', refs: [] },
    ] } });
  const edited = await saveRevision(scope.principal, scope.scenario.scenario.id, { expectedRevisionId: scope.scenario.revision.id,
    decisions: EXAMPLE_DECISIONS.map(d => d.measureId === 'M5' ? { ...d, districtId: 'almaty' } : d), constraints: DEFAULT_CONSTRAINTS, clientMutationId: randomUUID() });
  const child = await turn('Continue from the currently selected plan', first.id, { inputRevisionId: edited.revision.id });
  const context = await conversationContext(child);
  assert.equal(context.length, 1); assert.equal(context[0].request, first.objective);
  assert.equal(context[0].question, 'Which district should receive the next investment?');
  assert.deepEqual(context[0].explanation, ['Saved fixture explanation of the proposed school.', 'Fixture uses the synthetic city model.']);
  assert.deepEqual(context[0].proposedDecisions, proposed.revision.decisions);
  assert.equal(context[0].sourceRevisionId, scope.scenario.revision.id);
  assert.equal((await loadSource(child)).revision.id, edited.revision.id);
  // Removing the parent's artifact authorization must remove its proposed decisions.
  await getDb().update(cityRuns).set({ alternativeRevisionIds: [] }).where(eq(cityRuns.id, first.id));
  assert.equal((await conversationContext(child))[0].proposedDecisions, null);

  const foreignOwner = await turn('Foreign-owner secret', null, { ownerId: outsider.id });
  assert.deepEqual(await conversationContext({ ...child, parentRunId: foreignOwner.id }), []);
  const secondScenario = await createScenario(scope.principal, { source: 'example', title: 'Other isolated conversation', clientMutationId: randomUUID() });
  const foreignScenario = await turn('Other-scenario secret', null, { scenarioId: secondScenario.scenario.id, inputRevisionId: secondScenario.revision.id });
  assert.deepEqual(await conversationContext({ ...child, parentRunId: foreignScenario.id }), []);

  const chain = [await turn('turn-zero', null)];
  for (let index = 1; index < 6; index++) chain.push(await turn(`turn-${index}`, chain[index - 1].id));
  const newest = await turn('Current request', chain[5].id);
  assert.deepEqual((await conversationContext(newest)).map(t => t.request), ['turn-2', 'turn-3', 'turn-4', 'turn-5']);
  await getDb().update(cityRuns).set({ parentRunId: chain[1].id }).where(eq(cityRuns.id, chain[0].id));
  assert.deepEqual((await conversationContext({ ...newest, parentRunId: chain[1].id })).map(t => t.request), ['turn-zero', 'turn-1']);
  assert.deepEqual(await conversationContext({ ...newest, parentRunId: newest.id }), []);
  check('durable conversation includes owned saved context, keeps current source, rejects foreign parents and bounds chains/cycles');
}
async function boundedTools() {
  const scope = await owner(), fixture = await queued(scope, { status: 'running' });
  const execution = await createExecution(lease(scope, fixture));
  for (let attempt = 0; attempt < 3; attempt++) await execution.tool('searchPlans', { attempt }, async () => ({ fixture: true }));
  await assert.rejects(execution.tool('searchPlans', { attempt: 3 }, async () => ({})), CityError);
  for (let attempt = 0; attempt < 5; attempt++) await execution.tool('validatePlan', { attempt }, async () => ({ fixture: true }));
  await assert.rejects(execution.tool('validatePlan', { attempt: 5 }, async () => ({})), CityError);
  await execution.updateUsage(10, 3999); await assert.rejects(execution.updateUsage(10, 2), CityError);
  await cancelRun(scope.principal, fixture.runId);
  check('actual receipt counters cap three searches, eight tools and output token budget');
}
try {
  await admin`create schema ${admin(schema)}`; created = true;
  const tables = await admin<{ tablename: string }[]>`select tablename from pg_tables where schemaname='public' and (tablename like 'city_%' or tablename in ('user','session','account','verification'))`;
  assert.ok(tables.length >= 17, 'Apply current migrations before the worker test');
  for (const { tablename } of tables) await admin`create table ${admin(`${schema}.${tablename}`)} (like ${admin(`public.${tablename}`)} including all)`;
  isolated = postgres(process.env.DATABASE_URL, { max: 8, connection: { search_path: schema } });
  globalDb.citySql = isolated;
  const [setting] = await isolated<{ search_path: string }[]>`show search_path`; assert.equal(setting.search_path, schema);
  await getDb().insert(cityDatasets).values({ id: AKIM_DATASET.version, sourceHash: AKIM_DATASET.sourceHash, rulesVersion: AKIM_DATASET.rulesVersion, evaluatorVersion: AKIM_DATASET.evaluatorVersion, payload: AKIM_DATASET });
  await missingKey(); await cancellation(); await receiptsAndStaleSource(); await queueLimits(); await reclaimAndDeadline(); await boundedTools(); await durableConversation();
  console.log(`Worker deterministic database checks: ${passed} groups passed; no provider calls.`);
} finally {
  if (isolated) await isolated.end({ timeout: 5 });
  delete globalDb.citySql;
  try {
    if (created) { assert.match(schema, /^city_worker_test_[a-f0-9]{32}$/); await admin`drop schema ${admin(schema)} cascade`; }
  } finally { await admin.end({ timeout: 5 }); }
}




import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getSql } from '../src/server/db/core';
import { DEFAULT_CONSTRAINTS, EXAMPLE_DECISIONS } from '../src/features/city/data/akim-v1';
import type { Decision } from '../src/features/city/contracts';
import type { ApiProblem, ScenarioList, ScenarioView } from '../src/features/city/records';

const base = new URL(process.env.CITY_TEST_URL ?? 'http://localhost:3000');
const runId = randomUUID();
const title = `integration-${runId}`;
const email = `city-${runId}@example.invalid`;
const password = `City-test-${randomUUID()}!`;
const scenarioIds = new Set<string>();
const ownerIds = new Set<string>();
const mutationIds = new Set<string>();
const sql = getSql();
let accountId: string | undefined;
let passed = 0;

function mutationId() { const id = randomUUID(); mutationIds.add(id); return id; }
function check(name: string) { passed++; console.log(`PASS ${name}`); }
function close(actual: number | null, expected: number) {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}
class Client {
  readonly cookies = new Map<string, string>();
  clone() { const copy = new Client(); for (const [key, value] of this.cookies) copy.cookies.set(key, value); return copy; }
  async request<T>(method: string, path: string, body?: unknown, expected: number | number[] = 200): Promise<T> {
    const response = await fetch(new URL(path, base), {
      method, redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: { Origin: base.origin, 'Content-Type': 'application/json', Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';', 1)[0]; const separator = pair.indexOf('=');
      const key = pair.slice(0, separator), value = pair.slice(separator + 1);
      if (/max-age=0(?:;|$)/i.test(header) || value === '') this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
    const text = await response.text();
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${method} ${path}: expected ${expected}, got ${response.status}: ${text.slice(0, 700)}`);
    if (!text) return undefined as T;
    const result = JSON.parse(text) as T;
    if (response.status >= 400) {
      const problem = result as ApiProblem;
      assert.equal(typeof problem.code, 'string'); assert.equal(typeof problem.messageKey, 'string'); assert.equal(typeof problem.requestId, 'string');
    }
    return result;
  }
}
async function track(view: ScenarioView) {
  scenarioIds.add(view.scenario.id);
  const rows = await sql<{ owner_id: string }[]>`select owner_id from city_scenarios where id=${view.scenario.id}`;
  assert.equal(rows.length, 1); ownerIds.add(rows[0].owner_id);
  return view;
}
async function unchanged(client: Client, id: string, revisionId: string) {
  const current = await client.request<ScenarioView>('GET', `/api/city/scenarios/${id}`);
  assert.equal(current.revision.id, revisionId);
}
async function run() {
  const a = new Client(), b = new Client();
  const createId = mutationId();
  const example = await track(await a.request<ScenarioView>('POST', '/api/city/scenarios', { source: 'example', clientMutationId: createId, title }, [200, 201]));
  const id = example.scenario.id, path = `/api/city/scenarios/${id}`;
  assert.equal(example.principalKind, 'guest'); assert.equal(example.evaluation.result.cost, 95); close(example.evaluation.result.score, 56.543070);
  assert.equal(example.evaluation.result.criticalPairs.length, 0);
  const reopened = await a.request<ScenarioView>('GET', path);
  assert.equal(reopened.evaluation.id, example.evaluation.id); assert.deepEqual(reopened.evaluation.result, example.evaluation.result);
  check('source example is calculated, saved in PostgreSQL and reopened');

  const duplicate = await a.request<ScenarioView>('POST', '/api/city/scenarios', { source: 'example', clientMutationId: createId, title }, [200, 201]);
  assert.equal(duplicate.scenario.id, id);
  const count = await sql<{ count: number }[]>`select count(*)::int as count from city_scenarios where client_mutation_id=${createId}`;
  assert.equal(count[0].count, 1);
  check('duplicate create returns the same persisted scenario');

  const blank = await track(await b.request<ScenarioView>('POST', '/api/city/scenarios', { source: 'blank', clientMutationId: mutationId(), title: `${title}-blank` }, [200, 201]));
  assert.equal(blank.evaluation.result.score, null); assert.equal(blank.revision.decisions.length, 0);
  for (const [attacker, victim] of [[b, id], [a, blank.scenario.id]] as const) {
    const victimPath = `/api/city/scenarios/${victim}`;
    await attacker.request('GET', victimPath, undefined, 404);
    await attacker.request('PATCH', victimPath, { title: 'forbidden' }, 404);
    await attacker.request('DELETE', victimPath, {}, 404);
    await attacker.request('POST', `${victimPath}/revisions`, { expectedRevisionId: example.revision.id, decisions: EXAMPLE_DECISIONS, constraints: DEFAULT_CONSTRAINTS, clientMutationId: mutationId() }, 404);
    await attacker.request('POST', `${victimPath}/forks`, { clientMutationId: mutationId() }, 404);
  }
  await unchanged(a, id, example.revision.id);
  check('two independent guests cannot read, modify, fork or delete each other; blank has no official score');

  const decisions: Decision[] = EXAMPLE_DECISIONS.map(d => d.measureId === 'M5' ? { ...d, districtId: 'almaty' } : { ...d });
  const revisionBody = { expectedRevisionId: example.revision.id, decisions, constraints: DEFAULT_CONSTRAINTS, clientMutationId: mutationId() };
  const changed = await a.request<ScenarioView>('POST', `${path}/revisions`, revisionBody, [200, 201]);
  assert.notEqual(changed.revision.id, example.revision.id); assert.notEqual(changed.evaluation.result.score, example.evaluation.result.score);
  assert.equal(changed.revision.parentId, example.revision.id);
  const changedReload = await a.request<ScenarioView>('GET', path);
  assert.deepEqual(changedReload.evaluation.result, changed.evaluation.result);
  const retried = await a.request<ScenarioView>('POST', `${path}/revisions`, revisionBody, [200, 201]);
  assert.equal(retried.revision.id, changed.revision.id);
  const revisions = await sql<{ count: number }[]>`select count(*)::int as count from city_revisions where scenario_id=${id} and client_mutation_id=${revisionBody.clientMutationId}`;
  assert.equal(revisions[0].count, 1);
  await a.request('POST', `${path}/revisions`, { ...revisionBody, clientMutationId: mutationId() }, 409);
  await unchanged(a, id, changed.revision.id);
  check('revision changes outcome durably; idempotent retry succeeds; stale CAS returns 409');

  const overBudget: Decision[] = [{ measureId: 'M3', districtId: 'nura' }, { measureId: 'M5', districtId: 'saryarka' }, { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' }, { measureId: 'M14', districtId: null }];
  const conflicting: Decision[] = [{ measureId: 'M1', districtId: 'nura' }, { measureId: 'M3', districtId: 'yesil' }, { measureId: 'M9', districtId: 'nura' }, { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12', districtId: null }];
  for (const invalid of [overBudget, conflicting]) {
    await a.request('POST', `${path}/revisions`, { expectedRevisionId: changed.revision.id, decisions: invalid, constraints: DEFAULT_CONSTRAINTS, clientMutationId: mutationId() }, [400, 422]);
    await unchanged(a, id, changed.revision.id);
  }
  check('direct overbudget and conflicting requests cannot mutate current revision');

  const fork = await track(await a.request<ScenarioView>('POST', `${path}/forks`, { clientMutationId: mutationId() }, [200, 201]));
  assert.notEqual(fork.scenario.id, id); assert.deepEqual(fork.revision.decisions, changed.revision.decisions); close(fork.evaluation.result.score, changed.evaluation.result.score!);
  const renamed = `${title}-renamed`;
  await a.request('PATCH', path, { title: renamed });
  const list = await a.request<ScenarioList>('GET', `/api/city/scenarios?q=${encodeURIComponent(renamed)}`);
  assert.ok(list.items.some(s => s.id === id && s.title === renamed)); assert.ok(list.items.every(s => s.title.includes(renamed)));
  check('fork is distinct and calculated; renamed scenario is found through title search');

  const oldGuest = a.clone();
  const signedUp = await a.request<{ user: { id: string } }>('POST', '/api/auth/sign-up/email', { email, password, name: title }, [200, 201]);
  accountId = signedUp.user.id;
  await a.request('POST', '/api/city/owners/claim', {});
  const claimed = await track(await a.request<ScenarioView>('GET', path));
  assert.equal(claimed.principalKind, 'account'); assert.equal(claimed.revision.id, changed.revision.id);
  await oldGuest.request('GET', path, undefined, 404);
  await oldGuest.request('POST', `${path}/revisions`, { expectedRevisionId: changed.revision.id, decisions, constraints: DEFAULT_CONSTRAINTS, clientMutationId: mutationId() }, 404);
  const signedIn = new Client();
  await signedIn.request('POST', '/api/auth/sign-in/email', { email, password });
  const accountReload = await signedIn.request<ScenarioView>('GET', path);
  assert.equal(accountReload.revision.id, changed.revision.id); assert.equal(accountReload.principalKind, 'account');
  check('sign-up and explicit claim preserve guest work; revoked guest cookie loses access; independent sign-in restores work');

  await signedIn.request('DELETE', path, {}, [200, 204]);
  await signedIn.request('GET', path, undefined, 404);
  await signedIn.request('PATCH', path, { title: 'resurrection' }, 404);
  await signedIn.request('POST', `${path}/forks`, { clientMutationId: mutationId() }, 404);
  const deleted = await sql<{ deleted_at: Date | null }[]>`select deleted_at from city_scenarios where id=${id}`;
  assert.ok(deleted[0].deleted_at);
  const finalList = await signedIn.request<ScenarioList>('GET', '/api/city/scenarios');
  assert.ok(!finalList.items.some(s => s.id === id));
  check('soft deletion persists and revokes read/write/fork/list access');
}
async function cleanup() {
  // Every scope is an exact identifier generated or returned during this run.
  // Recover rows from mutation IDs even if an HTTP assertion failed before track().
  const created = mutationIds.size ? await sql<{ id: string; owner_id: string }[]>`select id, owner_id from city_scenarios where client_mutation_id in ${sql([...mutationIds])}` : [];
  for (const row of created) { scenarioIds.add(row.id); ownerIds.add(row.owner_id); }
  const users = await sql<{ id: string }[]>`select id from "user" where email=${email}`;
  if (users[0]) accountId = users[0].id;
  if (accountId) {
    const accountOwners = await sql<{ id: string }[]>`select id from city_owners where user_id=${accountId}`;
    for (const row of accountOwners) ownerIds.add(row.id);
  }
  await sql.begin(async tx => {
    if (scenarioIds.size) {
      const ids = [...scenarioIds];
      // Fork and parent links are intentionally restrictive; sever only test links.
      await tx`update city_revisions set parent_id=null, source_revision_id=null where scenario_id in ${tx(ids)}`;
      await tx`delete from city_scenarios where id in ${tx(ids)}`;
    }
    if (ownerIds.size) await tx`delete from city_owners where id in ${tx([...ownerIds])} and not exists (select 1 from city_scenarios where owner_id=city_owners.id)`;
    if (accountId) await tx`delete from "user" where id=${accountId} and email=${email}`;
  });
}
try {
  await run();
  console.log(`City integration: ${passed} behavioral groups passed (${base.origin}).`);
} finally {
  try { await cleanup(); } finally { await sql.end({ timeout: 5 }); }
}


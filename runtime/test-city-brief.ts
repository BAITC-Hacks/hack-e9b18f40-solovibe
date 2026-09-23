import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/server/db/core';
import { cityDatasets, cityOwners, cityRuns, cityJobs, cityBriefVersions } from '../src/server/db/schema';
import { AKIM_DATASET } from '../src/features/city/data/akim-v1';
import { createScenario, saveRevision } from '../src/server/city/scenarios';
import { createBrief, getBrief, editBrief, refreshBrief, checkBriefDrafts, commitGeneratedBrief } from '../src/server/city/briefs';
import { claimJob, createExecution, finishRun, renewLease } from '../src/server/city/jobs';
import { runBrief } from '../src/server/city/ai/brief-runner';
import type { Principal } from '../src/server/city/principal';
import type { BriefSection } from '../src/features/city/brief/contracts';

const admin = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const schema = `city_brief_test_${randomUUID().replaceAll('-', '')}`;
const globalDb = globalThis as unknown as { citySql?: ReturnType<typeof postgres> };
assert.equal(globalDb.citySql, undefined);
let isolated: ReturnType<typeof postgres> | undefined;
async function principal(): Promise<Principal> { const id = randomUUID(); await getDb().insert(cityOwners).values({ id, guestTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) }); return { ownerIds: [id], primaryOwnerId: id, userId: null, kind: 'guest' }; }
try {
  await admin`create schema ${admin(schema)}`;
  const tables = await admin<{ tablename: string }[]>`select tablename from pg_tables where schemaname='public' and (tablename like 'city_%' or tablename in ('user','session','account','verification'))`;
  for (const { tablename } of tables) await admin`create table ${admin(`${schema}.${tablename}`)} (like ${admin(`public.${tablename}`)} including all)`;
  isolated = postgres(process.env.DATABASE_URL!, { max: 8, connection: { search_path: schema } }); globalDb.citySql = isolated;
  await getDb().insert(cityDatasets).values({ id: AKIM_DATASET.version, sourceHash: AKIM_DATASET.sourceHash, rulesVersion: AKIM_DATASET.rulesVersion, evaluatorVersion: AKIM_DATASET.evaluatorVersion, payload: AKIM_DATASET });
  const p = await principal(), other = await principal();
  const source = await createScenario(p, { source: 'proof', proofVariant: 'two-districts', clientMutationId: randomUUID() });
  const input = { sourceRevisionId: source.revision.id, comparisonRevisionIds: [], locale: 'en' as const, clientMutationId: randomUUID() };
  const created = await createBrief(p, input), id = created.brief.id;
  assert.equal(created.brief.status, 'pending'); assert.equal(created.brief.sections.length, 7); assert.ok(created.brief.sections.every(s => !s.text));
  assert.equal((await createBrief(p, input)).brief.id, id);
  await assert.rejects(getBrief(other, id), { code: 'NOT_FOUND' });
  await assert.rejects(createBrief(other, { ...input, clientMutationId: randomUUID() }), { code: 'NOT_FOUND' });
  const benefit = created.source.evaluation.result.evidence.find(e => e.kind === 'effect' && e.value > 0)!;
  const concession = created.source.evaluation.result.evidence.find(e => e.kind === 'effect' && e.value < 0)!;
  const risk = created.source.evaluation.result.evidence.find(e => e.kind === 'indicator')!;
  const drafts = created.brief.sections.map(section => ({ id: section.id, text: section.id === 'limits' ? 'These model results do not prove real-world causal effects.' : section.id === 'tradeoffs' ? 'The safety measure worsens the modelled congestion indicator.' : 'The selected district benefits from the supported model measures.', refs: ['benefits', 'risks', 'tradeoffs'].includes(section.id) ? [{ evaluationId: created.source.evaluation.id, evidenceId: section.id === 'benefits' ? benefit.id : section.id === 'tradeoffs' ? concession.id : risk.id }] : [] }));
  assert.deepEqual(checkBriefDrafts(created, drafts), []);
  assert.ok(checkBriefDrafts(created, drafts.map(d => d.id === 'benefits' ? { ...d, text: 'An invented benefit of 999 residents.' } : d)).includes('NUMERIC_PROSE_OR_URL'));
  assert.ok(checkBriefDrafts(created, drafts.map(d => d.id === 'benefits' ? { ...d, refs: [{ evaluationId: 'foreign', evidenceId: benefit.id }] } : d)).includes('UNKNOWN_EVIDENCE'));
  await getDb().transaction(tx => commitGeneratedBrief(tx, p, id, 1, drafts, undefined, randomUUID()));
  const generated = await getBrief(p, id); assert.equal(generated.brief.status, 'ready'); assert.equal(generated.brief.version, 2);
  await assert.rejects(getDb().transaction(tx => commitGeneratedBrief(tx, other, id, 2, drafts, undefined, randomUUID())), { code: 'NOT_FOUND' });
  const edited = await editBrief(p, id, { expectedVersion: 2, sectionEdits: [{ id: 'rationale', text: 'My own rationale and stakeholder concern.' }] });
  assert.equal(edited.brief.version, 3); assert.equal(edited.brief.sections.find(s => s.id === 'rationale')?.userEdited, true);
  await assert.rejects(editBrief(p, id, { expectedVersion: 2, sectionEdits: [] }), { code: 'STALE_BRIEF' });
  const next = await saveRevision(p, source.scenario.id, { expectedRevisionId: source.revision.id, decisions: source.revision.decisions, constraints: { ...source.revision.constraints, minDirectDistricts: 2 }, clientMutationId: randomUUID() });
  const request = { expectedVersion: 3, targetRevisionId: next.revision.id, clientRequestId: randomUUID() };
  const refreshed = await refreshBrief(p, id, request);
  assert.equal((await refreshBrief(p, id, request)).brief.version, 4);
  const note = refreshed.brief.sections.find(s => s.id === 'rationale')!;
  assert.equal(note.text, 'My own rationale and stakeholder concern.'); assert.equal(note.stale, true);
  assert.ok(refreshed.brief.sections.filter(s => !s.userEdited).every(s => !s.text));
  assert.equal((await getBrief(p, id, 2)).brief.status, 'ready'); assert.equal((await getBrief(p, id, 2)).source.revision.id, source.revision.id);
  assert.ok((await getBrief(p, id, 2)).stale);
  const generatedDrafts = drafts.map(d => ({ ...d, refs: d.refs.map(ref => ({ ...ref, evaluationId: next.evaluation.id })) }));
  assert.ok(checkBriefDrafts(refreshed, generatedDrafts).includes('SECTION_SCOPE_MISMATCH'));
  const preserved = generatedDrafts.filter(d => d.id !== 'rationale');
  await getDb().transaction(tx => commitGeneratedBrief(tx, p, id, 4, preserved, undefined, randomUUID()));
  const current = await getBrief(p, id); assert.equal(current.brief.status, 'needs_review'); assert.equal(current.brief.sections.find(s => s.id === 'rationale')?.text, note.text);
  const selected = [{ id: 'rationale' as BriefSection['id'], text: 'The revised rationale follows the selected conditions.', refs: [] }];
  await getDb().transaction(tx => commitGeneratedBrief(tx, p, id, 5, selected, ['rationale'], randomUUID()));
  assert.equal((await getBrief(p, id)).brief.status, 'ready');
  const history = await getDb().select().from(cityBriefVersions).where(eq(cityBriefVersions.briefId, id)); assert.equal(history.length, 6);
  if (process.env.CITY_BRIEF_LIVE === '1') {
    const live = await createBrief(p, { ...input, sourceRevisionId: next.revision.id, clientMutationId: randomUUID() });
    const runId = randomUUID(), deadlineAt = new Date(Date.now() + 120000), quotaKey = `guest:${p.primaryOwnerId}`;
    await getDb().insert(cityRuns).values({ id: runId, ownerId: p.primaryOwnerId!, quotaKey, scenarioId: source.scenario.id, inputRevisionId: next.revision.id, procedure: 'brief', context: { briefId: live.brief.id, briefVersion: 1 }, objective: 'Create a concise decision brief explaining the selected portfolio and its limitations.', locale: 'en', inputHash: randomUUID(), clientRequestId: randomUUID(), status: 'queued', deadlineAt });
    await getDb().insert(cityJobs).values({ id: randomUUID(), runId, ownerId: p.primaryOwnerId!, quotaKey, kind: 'analysis', deadlineAt });
    const job = await claimJob('brief-live-test'); assert.ok(job);
    const lease = { id: job.id, runId, ownerId: p.primaryOwnerId!, token: job.leaseToken, workerId: 'brief-live-test', deadlineAt, signal: new AbortController().signal };
    const renewal = setInterval(() => { void renewLease(job.id, job.leaseToken); }, 10000);
    try { await finishRun(lease, await runBrief(await createExecution(lease))); } finally { clearInterval(renewal); }
    const saved = await getBrief(p, live.brief.id); assert.equal(saved.brief.lastRunId, runId); assert.equal(saved.brief.status, 'ready');
    console.log('LIVE BRIEF', JSON.stringify({ version: saved.brief.version, sections: saved.brief.sections }));
  }
  console.log('PASS brief: owned source, immediate pending tables, immutable snapshots, version CAS, manual preservation, targeted replacement, refresh idempotency, quality/ref gates.');
} finally {
  if (isolated) await isolated.end({ timeout: 5 }); delete globalDb.citySql;
  assert.match(schema, /^city_brief_test_[a-f0-9]{32}$/); await admin`drop schema if exists ${admin(schema)} cascade`; await admin.end({ timeout: 5 });
}

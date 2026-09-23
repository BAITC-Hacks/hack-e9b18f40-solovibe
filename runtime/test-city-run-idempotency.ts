import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getDb } from '../src/server/db/core';
import { cityDatasets, cityOwners } from '../src/server/db/schema';
import { AKIM_DATASET } from '../src/features/city/data/akim-v1';
import { createScenario, deleteScenario } from '../src/server/city/scenarios';
import { createBrief, editBrief } from '../src/server/city/briefs';
import { createRun, getRun } from '../src/server/city/runs';
import type { Principal } from '../src/server/city/principal';
const admin = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => { } }), schema = `city_run_idempotency_${randomUUID().replaceAll('-', '')}`;
const globalDb = globalThis as unknown as {
    citySql?: ReturnType<typeof postgres>;
};
assert.equal(globalDb.citySql, undefined);
let isolated: ReturnType<typeof postgres> | undefined;
try {
    await admin `create schema ${admin(schema)}`;
    const tables = await admin<{
        tablename: string;
    }[]> `select tablename from pg_tables where schemaname='public' and (tablename like 'city_%' or tablename in ('user','session','account','verification'))`;
    for (const { tablename } of tables)
        await admin `create table ${admin(`${schema}.${tablename}`)} (like ${admin(`public.${tablename}`)} including all)`;
    isolated = postgres(process.env.DATABASE_URL!, { max: 8, connection: { search_path: schema } });
    globalDb.citySql = isolated;
    await getDb().insert(cityDatasets).values({ id: AKIM_DATASET.version, sourceHash: AKIM_DATASET.sourceHash, rulesVersion: AKIM_DATASET.rulesVersion, evaluatorVersion: AKIM_DATASET.evaluatorVersion, payload: AKIM_DATASET });
    const owner = randomUUID();
    await getDb().insert(cityOwners).values({ id: owner, guestTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) });
    const p: Principal = { ownerIds: [owner], primaryOwnerId: owner, kind: 'guest', userId: null };
    const source = await createScenario(p, { source: 'proof', clientMutationId: randomUUID() });
    const brief = await createBrief(p, { sourceRevisionId: source.revision.id, comparisonRevisionIds: [], locale: 'ru', clientMutationId: randomUUID() });
    delete process.env.OPENAI_API_KEY;
    const input = { scenarioId: source.scenario.id, inputRevisionId: source.revision.id, procedure: 'brief' as const, objective: 'Write source-bound brief', locale: 'ru' as const, clientRequestId: randomUUID(), context: { briefId: brief.brief.id, briefVersion: brief.brief.version } };
    const first = await createRun(p, input, 'fixture');
    assert.equal(first.run.status, 'failed');
    assert.equal(first.run.errorCode, 'AI_UNAVAILABLE');
    const changed = await editBrief(p, brief.brief.id, { expectedVersion: brief.brief.version, title: 'Manual update after first request', sectionEdits: [] });
    assert.equal(changed.brief.version, 2);
    assert.equal((await getRun(p, first.run.id)).run.id, first.run.id);
    const retried = await createRun(p, input, 'fixture');
    assert.equal(retried.run.id, first.run.id);
    assert.equal(retried.run.status, 'failed');
    assert.equal(retried.run.errorCode, 'AI_UNAVAILABLE');
    await assert.rejects(createRun(p, { ...input, clientRequestId: randomUUID() }, 'fixture'), { code: 'STALE_BRIEF' });
    const otherOwner = randomUUID();
    await getDb().insert(cityOwners).values({ id: otherOwner, guestTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000) });
    const other: Principal = { ownerIds: [otherOwner], primaryOwnerId: otherOwner, kind: 'guest', userId: null };
    await assert.rejects(createRun(other, input, 'fixture'), { code: 'NOT_FOUND' });
    await deleteScenario(p, source.scenario.id);
    await assert.rejects(createRun(p, input, 'fixture'), { code: 'NOT_FOUND' });
    console.log('PASS run idempotency: same request returns original durable run after manual brief version advance; fresh stale request, other owner and deleted scenario denied. No provider call.');
}
finally {
    if (isolated)
        await isolated.end({ timeout: 5 });
    delete globalDb.citySql;
    assert.match(schema, /^city_run_idempotency_[a-f0-9]{32}$/);
    await admin `drop schema if exists ${admin(schema)} cascade`;
    await admin.end({ timeout: 5 });
}

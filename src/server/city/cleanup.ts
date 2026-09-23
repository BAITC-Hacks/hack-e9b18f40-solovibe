import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb, type CityDb, type CityTx } from '@/server/db/core';
import { cityArtifacts, cityOwners, cityScenarios } from '@/server/db/schema';
import { deleteStoredObject } from '@/server/storage-core';
import { artifactRecord, ownedArtifact, requireArtifactBackend } from './artifact-access';
import type { Principal } from './principal';
type Executor = CityDb | CityTx;
export async function deleteArtifact(p: Principal, id: string) { await ownedArtifact(p, id); const [row] = await getDb().update(cityArtifacts).set({ state: 'deleting', retryAt: new Date(), updatedAt: new Date() }).where(and(eq(cityArtifacts.id, id), inArray(cityArtifacts.ownerId, p.ownerIds), inArray(cityArtifacts.state, ['ready', 'pending', 'failed']))).returning(); return row ? artifactRecord(row) : artifactRecord(await ownedArtifact(p, id)); }
export async function revokeScenarioArtifacts(scenarioId: string, db: Executor = getDb()) { await db.update(cityArtifacts).set({ state: 'deleting', retryAt: new Date(), updatedAt: new Date() }).where(and(eq(cityArtifacts.scenarioId, scenarioId), inArray(cityArtifacts.state, ['ready', 'pending', 'failed']))); }
export async function revokeOwnerArtifacts(ownerId: string, db: Executor = getDb()) { await db.update(cityArtifacts).set({ state: 'deleting', retryAt: new Date(), updatedAt: new Date() }).where(and(eq(cityArtifacts.ownerId, ownerId), inArray(cityArtifacts.state, ['ready', 'pending', 'failed']))); }
/** Call in the owner deletion transaction with that owner locked. False means retain the owner. */
export async function purgeDeletedOwnerArtifacts(ownerId: string, db: Executor = getDb()) { const [remaining] = await db.select({ id: cityArtifacts.id }).from(cityArtifacts).where(and(eq(cityArtifacts.ownerId, ownerId), sql `${cityArtifacts.state} <> 'deleted'`)).limit(1); if (remaining)
    return false; await db.delete(cityArtifacts).where(and(eq(cityArtifacts.ownerId, ownerId), eq(cityArtifacts.state, 'deleted'))); return true; }
/** Bounded periodic maintenance; keys never come from callers or object-store enumeration. */
export async function cleanupArtifacts(limit = 20) {
    const db = getDb(), now = new Date();
    // Catch parent revocations and expired guests even if the request died before scheduling cleanup.
    const abandoned = await db.select({ id: cityArtifacts.id }).from(cityArtifacts).innerJoin(cityScenarios, eq(cityScenarios.id, cityArtifacts.scenarioId)).innerJoin(cityOwners, eq(cityOwners.id, cityArtifacts.ownerId)).where(and(inArray(cityArtifacts.state, ['pending', 'failed', 'ready']), or(sql `${cityScenarios.deletedAt} is not null`, and(isNull(cityOwners.userId), lt(cityOwners.expiresAt, now)), and(inArray(cityArtifacts.state, ['pending', 'failed']), lt(cityArtifacts.updatedAt, new Date(Date.now() - 86400000)))))).limit(limit);
    if (abandoned.length)
        await db.update(cityArtifacts).set({ state: 'deleting', retryAt: now, updatedAt: now }).where(and(inArray(cityArtifacts.id, abandoned.map(r => r.id)), inArray(cityArtifacts.state, ['pending', 'failed', 'ready'])));
    const rows = await db.select({ id: cityArtifacts.id }).from(cityArtifacts).where(and(eq(cityArtifacts.state, 'deleting'), or(isNull(cityArtifacts.retryAt), lt(cityArtifacts.retryAt, now)))).limit(Math.min(100, Math.max(1, limit)));
    let deleted = 0, failed = 0;
    for (const row of rows)
        await db.transaction(async (tx) => {
            const [current] = await tx.select().from(cityArtifacts).where(and(eq(cityArtifacts.id, row.id), eq(cityArtifacts.state, 'deleting'))).for('update', { skipLocked: true });
            if (!current)
                return;
            try {
                requireArtifactBackend(current);
                await deleteStoredObject(current.key);
                await tx.update(cityArtifacts).set({ state: 'deleted', errorCode: null, retryAt: null, updatedAt: new Date() }).where(eq(cityArtifacts.id, current.id));
                deleted++;
            }
            catch {
                await tx.update(cityArtifacts).set({ errorCode: 'STORAGE_UNAVAILABLE', attempts: current.attempts + 1, retryAt: new Date(Date.now() + Math.min(3600000, 5000 * 2 ** Math.min(current.attempts, 10))), updatedAt: new Date() }).where(eq(cityArtifacts.id, current.id));
                failed++;
            }
        });
    return { deleted, failed };
}

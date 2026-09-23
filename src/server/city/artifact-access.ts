import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { ArtifactRecord } from '@/features/city/artifact-contracts';
import { getDb } from '@/server/db/core';
import { cityArtifacts, cityScenarios } from '@/server/db/schema';
import { getStorageBackend, headStoredObject, readStoredObject } from '@/server/storage-core';
import { CityError } from './errors';
import type { Principal } from './principal';
import { requireScenario } from './scenarios';
export type ArtifactRow = typeof cityArtifacts.$inferSelect;
export const ARTIFACT_MAX_BYTES = 10 * 1024 * 1024;
export const artifactChecksum = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function artifactRecord(r: ArtifactRow): ArtifactRecord { return { id: r.id, scenarioId: r.scenarioId, revisionId: r.revisionId, briefId: r.briefId, briefVersion: r.briefVersion, kind: r.kind, locale: r.locale, mime: r.mime, size: r.size, sha256: r.sha256, state: r.state, errorCode: r.errorCode, createdAt: r.createdAt.toISOString() }; }
export function requireArtifactBackend(row: Pick<ArtifactRow, 'backend'>) { try {
    if (row.backend !== getStorageBackend())
        throw new Error('backend mismatch');
}
catch {
    throw new CityError('STORAGE_UNAVAILABLE', 503);
} }
export async function ownedArtifact(p: Principal, id: string) { const [r] = await getDb().select({ artifact: cityArtifacts }).from(cityArtifacts).innerJoin(cityScenarios, eq(cityScenarios.id, cityArtifacts.scenarioId)).where(and(eq(cityArtifacts.id, id), inArray(cityArtifacts.ownerId, p.ownerIds), inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt))); if (!r)
    throw new CityError('NOT_FOUND', 404); return r.artifact; }
export async function getArtifact(p: Principal, id: string) { return artifactRecord(await ownedArtifact(p, id)); }
export async function listArtifacts(p: Principal, scenarioId: string) { await requireScenario(p, scenarioId); return { items: (await getDb().select().from(cityArtifacts).where(and(eq(cityArtifacts.scenarioId, scenarioId), inArray(cityArtifacts.ownerId, p.ownerIds))).orderBy(desc(cityArtifacts.createdAt)).limit(100)).map(artifactRecord) }; }
async function bytesForArtifact(row: ArtifactRow) {
    if (row.state !== 'ready')
        throw new CityError(row.state === 'deleted' || row.state === 'deleting' ? 'NOT_FOUND' : 'ARTIFACT_NOT_READY', row.state === 'deleted' || row.state === 'deleting' ? 404 : 409);
    requireArtifactBackend(row);
    try {
        const head = await headStoredObject(row.key);
        if (!head || head.size !== row.size || head.size > ARTIFACT_MAX_BYTES || head.contentType !== row.mime)
            throw new Error('metadata mismatch');
        const object = await readStoredObject(row.key);
        if (!object || object.size !== row.size || artifactChecksum(object.bytes) !== row.sha256)
            throw new Error('checksum mismatch');
        return object.bytes;
    }
    catch {
        throw new CityError('STORAGE_UNAVAILABLE', 503);
    }
}
export async function readArtifact(p: Principal, id: string) { const row = await ownedArtifact(p, id); const bytes = await bytesForArtifact(row); const fresh = await ownedArtifact(p, id); if (fresh.state !== 'ready')
    throw new CityError('NOT_FOUND', 404); return { record: artifactRecord(row), bytes }; }
/** Internal only: caller must first validate the share token and its artifact allowlist. */
export async function readArtifactForSnapshot(id: string, scenarioId: string, revisionId: string) { const [r] = await getDb().select({ artifact: cityArtifacts }).from(cityArtifacts).innerJoin(cityScenarios, eq(cityScenarios.id, cityArtifacts.scenarioId)).where(and(eq(cityArtifacts.id, id), eq(cityArtifacts.scenarioId, scenarioId), eq(cityArtifacts.revisionId, revisionId), isNull(cityScenarios.deletedAt))); if (!r)
    throw new CityError('NOT_FOUND', 404); const bytes = await bytesForArtifact(r.artifact); const [fresh] = await getDb().select({ state: cityArtifacts.state, deletedAt: cityScenarios.deletedAt }).from(cityArtifacts).innerJoin(cityScenarios, eq(cityScenarios.id, cityArtifacts.scenarioId)).where(eq(cityArtifacts.id, id)); if (!fresh || fresh.state !== 'ready' || fresh.deletedAt)
    throw new CityError('NOT_FOUND', 404); return { record: artifactRecord(r.artifact), bytes }; }
export function artifactDownloadResponse(value: {
    record: ArtifactRecord;
    bytes: Uint8Array;
}) { return new Response(new Uint8Array(value.bytes), { headers: { 'Content-Type': value.record.mime, 'Content-Length': String(value.bytes.byteLength), 'Content-Disposition': `attachment; filename="CityBalance-${value.record.id}.${value.record.kind}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'", 'Referrer-Policy': 'no-referrer' } }); }

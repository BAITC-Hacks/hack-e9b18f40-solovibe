import { randomUUID, createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createArtifactSchema } from '@/features/city/artifact-contracts';
import { renderBriefHtml, renderScenarioCsv, csvCell } from '@/features/city/brief/render';
import { getDb } from '@/server/db/core';
import { cityArtifacts } from '@/server/db/schema';
import { getStorageBackend, putStoredObject, headStoredObject, readStoredObject } from '@/server/storage-core';
import { getBrief } from './briefs';
import { getRevision, requireScenario } from './scenarios';
import { requireOwnedRevision } from './stress';
import { CityError } from './errors';
import type { Principal } from './principal';
import { consumeRate } from './limits';
import { ARTIFACT_MAX_BYTES, artifactChecksum, artifactRecord, requireArtifactBackend } from './artifact-access';
const MIME = { html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8', csv: 'text/csv; charset=utf-8' };
export async function createArtifact(p: Principal, input: z.infer<typeof createArtifactSchema>) {
    const source = await requireOwnedRevision(p, input.revisionId), snapshot = await getRevision(p, source.scenario.id, input.revisionId);
    if (!snapshot.evaluation.result.valid || !snapshot.evaluation.result.complete || snapshot.evaluation.result.score === null)
        throw new CityError('INVALID_PLAN');
    const brief = input.briefId ? await getBrief(p, input.briefId, input.briefVersion) : null;
    if (input.briefVersion && !brief)
        throw new CityError('INVALID_REQUEST');
    if (brief && brief.brief.sourceRevisionId !== input.revisionId)
        throw new CityError('STALE_REVISION', 409);
    if (input.kind === 'html' && (!brief || brief.brief.status === 'pending'))
        throw new CityError('ARTIFACT_NOT_READY', 409);
    const cacheKey = createHash('sha256').update(JSON.stringify(['public-safe-v2', input.revisionId, brief?.brief.id ?? null, brief?.brief.version ?? null, input.locale, input.kind])).digest('hex');
    let [row] = await getDb().select().from(cityArtifacts).where(and(eq(cityArtifacts.ownerId, source.scenario.ownerId), eq(cityArtifacts.cacheKey, cacheKey)));
    if (row && row.state === 'ready')
        return artifactRecord(row);
    // The experiment's repair list grows independently of a saved brief version.
    // Export only immutable experiment data and sensitivity of this exact selected revision.
    const experiment = brief?.stress?.experiment;
    const exportedStress = experiment ? {
        id: experiment.id, scenarioId: experiment.scenarioId, sourceRevisionId: experiment.sourceRevisionId,
        assumption: experiment.assumption, baseline: experiment.baseline, stressed: experiment.stressed,
        createdAt: experiment.createdAt,
        selectedRevisionId: brief!.stress!.selectedRevisionId ?? snapshot.revision.id,
        selectedEvaluation: brief!.stress!.selectedEvaluation ?? null,
    } : null;
    const stressRows: unknown[][] = exportedStress ? [
        ['stress.id', exportedStress.id], ['stress.sourceRevisionId', exportedStress.sourceRevisionId],
        ['stress.selectedRevisionId', exportedStress.selectedRevisionId],
        ...Object.entries(exportedStress.assumption).map(([key, value]) => [`stress.assumption.${key}`, value]),
        ...(['baseline', 'stressed', 'selectedEvaluation'] as const).flatMap(kind => {
            const result = exportedStress[kind];
            return result ? [['stress.result', kind], ['kind', result.kind], ['Score', result.score],
                ['cost', result.cost], ['minimumDistrictScore', result.minimumDistrictScore],
                ['criticalPairs', result.criticalPairs.length], ['sourceHash', result.sourceHash],
                ['rulesVersion', result.rulesVersion], ['evaluatorVersion', result.evaluatorVersion]] : [];
        }),
    ] : [];
    // Render only from persisted immutable data. JSON excludes owner/session and mutation metadata.
    const document = { format: 'CityBalance.scenario.v1', revision: { id: snapshot.revision.id, scenarioId: snapshot.revision.scenarioId, sourceRevisionId: snapshot.revision.sourceRevisionId, decisions: snapshot.revision.decisions, constraints: snapshot.revision.constraints, createdAt: snapshot.revision.createdAt }, evaluation: snapshot.evaluation, brief: brief ? { id: brief.brief.id, version: brief.brief.version, title: brief.brief.title, locale: brief.brief.locale, sourceRevisionId: brief.brief.sourceRevisionId, sourceHash: brief.brief.sourceHash, status: brief.brief.status, sections: brief.brief.sections.map(s => ({ id: s.id, text: s.text, refs: s.refs, userEdited: s.userEdited, stale: s.stale })) } : null, stress: exportedStress, comparisons: brief?.comparisons.map(s => ({ revisionId: s.revision.id, decisions: s.revision.decisions, evaluation: s.evaluation })) ?? [] };
    const bytes = Buffer.from(input.kind === 'html' ? renderBriefHtml(brief!, input.locale) : input.kind === 'csv' ? renderScenarioCsv(snapshot, input.locale) + (brief ? '\r\n' + [['briefId', brief.brief.id], ['briefVersion', brief.brief.version], ...stressRows].map(row => row.map(csvCell).join(',')).join('\r\n') : '') : JSON.stringify(document, null, 2), 'utf8');
    if (bytes.length > ARTIFACT_MAX_BYTES)
        throw new CityError('BODY_TOO_LARGE', 413);
    const sha256 = artifactChecksum(bytes);
    if (!row || row.state === 'deleted' || row.state === 'deleting') {
        row = await getDb().transaction(async (tx) => {
            // Serialize identity allocation with other exports and parent deletion.
            await requireScenario(p, source.scenario.id, tx, true);
            const [existing] = await tx.select().from(cityArtifacts)
                .where(and(eq(cityArtifacts.ownerId, source.scenario.ownerId), eq(cityArtifacts.cacheKey, cacheKey)))
                .for('update');
            if (existing && existing.state !== 'deleted' && existing.state !== 'deleting')
                return existing;
            if (existing) {
                // Release only the cache slot. The revoked identity, exact object key,
                // backend and deletion state remain intact for retryable cleanup.
                await tx.update(cityArtifacts).set({ cacheKey: `revoked:${existing.id}` })
                    .where(eq(cityArtifacts.id, existing.id));
            }
            await consumeRate(tx, `export:${source.scenario.ownerId}`, 60);
            let backend;
            try {
                backend = getStorageBackend();
            }
            catch {
                throw new CityError('STORAGE_UNAVAILABLE', 503);
            }
            const id = randomUUID();
            const [inserted] = await tx.insert(cityArtifacts).values({
                id, ownerId: source.scenario.ownerId, scenarioId: source.scenario.id,
                revisionId: input.revisionId, briefId: brief?.brief.id, briefVersion: brief?.brief.version,
                kind: input.kind, locale: input.locale, backend,
                key: `owners/${source.scenario.ownerId}/scenarios/${source.scenario.id}/revisions/${input.revisionId}/exports/${id}.${input.kind}`,
                mime: MIME[input.kind], size: bytes.length, sha256, state: 'pending', cacheKey,
                clientMutationId: input.clientMutationId,
            }).returning();
            return inserted;
        });
    }
    try {
        return await getDb().transaction(async (tx) => {
            const [current] = await tx.select().from(cityArtifacts).where(and(eq(cityArtifacts.id, row.id), inArray(cityArtifacts.ownerId, p.ownerIds))).for('update');
            if (!current)
                throw new CityError('NOT_FOUND', 404);
            await requireScenario(p, current.scenarioId, tx);
            if (current.state === 'ready' || current.state === 'deleted' || current.state === 'deleting')
                return artifactRecord(current);
            requireArtifactBackend(current);
            if (current.size !== bytes.length || current.sha256 !== sha256)
                throw new CityError('STALE_REVISION', 409);
            if (current.retryAt && current.retryAt.getTime() > Date.now())
                return artifactRecord(current);
            const head = await headStoredObject(current.key);
            const previous = head && head.size === bytes.length && head.contentType === current.mime ? await readStoredObject(current.key) : null;
            if (!previous || artifactChecksum(previous.bytes) !== sha256)
                await putStoredObject(current.key, bytes, current.mime);
            const verifiedHead = await headStoredObject(current.key);
            if (!verifiedHead || verifiedHead.size !== bytes.length || verifiedHead.contentType !== current.mime)
                throw new Error('metadata mismatch');
            const verified = await readStoredObject(current.key);
            if (!verified || artifactChecksum(verified.bytes) !== sha256)
                throw new Error('checksum mismatch');
            const [ready] = await tx.update(cityArtifacts).set({ state: 'ready', errorCode: null, retryAt: null, attempts: current.attempts + 1, updatedAt: new Date() }).where(eq(cityArtifacts.id, current.id)).returning();
            return artifactRecord(ready);
        });
    }
    catch (error) {
        // Even a failed commit leaves the original tracked key/checksum available to retry or cleanup.
        await getDb().update(cityArtifacts).set({ state: 'failed', errorCode: 'STORAGE_UNAVAILABLE', attempts: sql `${cityArtifacts.attempts}+1`, retryAt: new Date(Date.now() + 5000), updatedAt: new Date() }).where(and(eq(cityArtifacts.id, row.id), inArray(cityArtifacts.state, ['pending', 'failed']))).catch(() => { });
        throw error instanceof CityError ? error : new CityError('STORAGE_UNAVAILABLE', 503);
    }
}

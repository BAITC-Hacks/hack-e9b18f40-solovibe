import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { createShareSchema, type PublicSnapshot, type ShareRecord, type SharedComparison } from '@/features/city/sharing-contracts';
import { stableJson } from '@/features/city/search';
import { getDb, type CityDb, type CityTx } from '@/server/db/core';
import { cityArtifacts, cityOwners, cityScenarios, cityShares } from '@/server/db/schema';
import type { Principal } from './principal';
import { CityError, problemResponse } from './errors';
import { createScenario, getRevision, requireScenario } from './scenarios';
import { requireOwnedRevision } from './stress';
import { getBrief } from './briefs';
import { artifactRecord, readArtifactForSnapshot, artifactDownloadResponse } from './artifact-access';

type Reader = CityDb | CityTx;
type ShareRow = typeof cityShares.$inferSelect;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const sharedComparisonSchema = z.object({ shareTokens: z.array(z.string().min(1).max(2048)).min(1).max(3) }).strict();
export const forkShareSchema = z.object({ clientMutationId: z.string().uuid(), title: z.string().trim().min(1).max(120).optional() }).strict();
export function parseShareToken(input: string): string {
  if (TOKEN.test(input)) return input;
  try {
    const url = new URL(input), app = new URL(process.env.APP_URL || 'http://localhost:3000');
    const match = url.pathname.match(/^\/(?:ru|kk|en)\/share\/([A-Za-z0-9_-]{43})\/?$/);
    if (url.origin === app.origin && !url.username && !url.password && !url.search && !url.hash && match) return match[1];
  } catch { /* A token is opaque; never resolve or fetch a supplied URL. */ }
  throw new CityError('INVALID_REQUEST');
}
function record(row: ShareRow): ShareRecord {
  return { id: row.id, scenarioId: row.scenarioId, revisionId: row.revisionId, briefId: row.briefId, briefVersion: row.briefVersion, artifactIds: row.artifactIds, teamName: row.teamName, expiresAt: row.expiresAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() };
}
async function liveShare(token: string, db: Reader = getDb()) {
  if (!TOKEN.test(token)) throw new CityError('NOT_FOUND', 404);
  const now = new Date();
  const [row] = await db.select({ share: cityShares }).from(cityShares)
    .innerJoin(cityScenarios, and(eq(cityScenarios.id, cityShares.scenarioId), eq(cityScenarios.ownerId, cityShares.ownerId)))
    .innerJoin(cityOwners, eq(cityOwners.id, cityShares.ownerId))
    .where(and(eq(cityShares.tokenHash, tokenHash(token)), isNull(cityShares.revokedAt), gt(cityShares.expiresAt, now), isNull(cityScenarios.deletedAt), or(isNull(cityOwners.expiresAt), gt(cityOwners.expiresAt, now))));
  if (!row) throw new CityError('NOT_FOUND', 404);
  return row.share;
}
export async function createShare(p: Principal, input: z.infer<typeof createShareSchema>): Promise<{ share: ShareRecord; token: string | null }> {
  return getDb().transaction(async tx => {
    const owned = await requireOwnedRevision(p, input.revisionId, tx);
    const scenario = await requireScenario(p, owned.scenario.id, tx, true);
    const [duplicate] = await tx.select().from(cityShares).where(and(eq(cityShares.ownerId, scenario.ownerId), eq(cityShares.clientMutationId, input.clientMutationId)));
    if (duplicate) return { share: record(duplicate), token: null };
    const source = await getRevision(p, scenario.id, input.revisionId, tx);
    if (!source.evaluation.result.valid || !source.evaluation.result.complete || source.evaluation.result.score === null) throw new CityError('INVALID_PLAN');
    if (input.briefVersion !== undefined && !input.briefId) throw new CityError('INVALID_REQUEST');
    const brief = input.briefId ? await getBrief(p, input.briefId, input.briefVersion, tx) : null;
    if (brief && (brief.brief.sourceRevisionId !== source.revision.id || brief.brief.scenarioId !== scenario.id)) throw new CityError('STALE_REVISION', 409);
    if (brief?.brief.status === 'pending') throw new CityError('ARTIFACT_NOT_READY', 409);
    const artifactIds = [...new Set(input.artifactIds)];
    const artifacts = artifactIds.length ? await tx.select().from(cityArtifacts).where(and(inArray(cityArtifacts.id, artifactIds), eq(cityArtifacts.ownerId, scenario.ownerId), eq(cityArtifacts.scenarioId, scenario.id), eq(cityArtifacts.revisionId, input.revisionId))) : [];
    if (artifacts.length !== artifactIds.length) throw new CityError('NOT_FOUND', 404);
    if (artifacts.some(a => a.state !== 'ready')) throw new CityError('ARTIFACT_NOT_READY', 409);
    if (artifacts.some(a => a.briefId && (!brief || a.briefId !== brief.brief.id || a.briefVersion !== brief.brief.version))) throw new CityError('STALE_REVISION', 409);
    const token = randomBytes(32).toString('base64url'), expiresAt = new Date(Date.now() + 30 * 86400000);
    const allowedEvaluations = new Set([source.evaluation.id, ...(brief?.stress ? [`stress:${brief.stress.experiment.id}:baseline`, `stress:${brief.stress.experiment.id}:stressed`,`stress:${brief.stress.experiment.id}:selected`] : [])]);
    const snapshot: PublicSnapshot = {
      title: scenario.title, teamName: input.teamName, revisionId: source.revision.id, decisions: source.revision.decisions, constraints: source.revision.constraints,
      evaluation: brief?.stress?.selectedEvaluation??brief?.stress?.experiment.stressed ?? source.evaluation.result,
      stress: brief?.stress ? { assumption: brief.stress.experiment.assumption, stressed: brief.stress.selectedEvaluation??brief.stress.experiment.stressed } : null,
      brief: brief ? { title: brief.brief.title, locale: brief.brief.locale, version: brief.brief.version, sourceHash: brief.brief.sourceHash, status: brief.brief.status,
        sections: brief.brief.sections.map(s => ({ id: s.id, text: s.text, userEdited: s.userEdited, stale: s.stale, generatedText: null, refs: s.refs.filter(ref => allowedEvaluations.has(ref.evaluationId) && (!ref.compareToEvaluationId || allowedEvaluations.has(ref.compareToEvaluationId))) })) } : null,
      artifacts: artifacts.map(artifactRecord), expiresAt: expiresAt.toISOString(),
    };
    const [row] = await tx.insert(cityShares).values({ id: randomUUID(), ownerId: scenario.ownerId, scenarioId: scenario.id, revisionId: source.revision.id, briefId: brief?.brief.id, briefVersion: brief?.brief.version, artifactIds, teamName: input.teamName, tokenHash: tokenHash(token), snapshot, clientMutationId: input.clientMutationId, expiresAt }).returning();
    return { share: record(row), token };
  });
}
export async function listShares(p: Principal, scenarioId: string) {
  await requireScenario(p, scenarioId);
  const rows = await getDb().select().from(cityShares).where(and(eq(cityShares.scenarioId, scenarioId), inArray(cityShares.ownerId, p.ownerIds))).orderBy(desc(cityShares.createdAt));
  return { items: rows.map(record) };
}
export async function revokeShare(p: Principal, id: string) {
  const [row] = await getDb().select().from(cityShares).where(and(eq(cityShares.id, id), inArray(cityShares.ownerId, p.ownerIds)));
  if (!row) throw new CityError('NOT_FOUND', 404);
  await requireScenario(p, row.scenarioId);
  const [revoked] = await getDb().update(cityShares).set({ revokedAt: row.revokedAt ?? new Date() }).where(and(eq(cityShares.id, id), inArray(cityShares.ownerId, p.ownerIds))).returning();
  return { share: record(revoked) };
}
export async function getPublicSnapshot(token: string): Promise<PublicSnapshot> {
  const share=await liveShare(token);
  const ready=share.artifactIds.length?await getDb().select({id:cityArtifacts.id}).from(cityArtifacts).where(and(inArray(cityArtifacts.id,share.artifactIds),eq(cityArtifacts.state,'ready'),eq(cityArtifacts.scenarioId,share.scenarioId))):[];
  return {...share.snapshot,artifacts:share.snapshot.artifacts.filter(a=>ready.some(r=>r.id===a.id))};
}
export async function readSharedArtifact(token: string, artifactId: string) {
  const share = await liveShare(token);
  if (!share.artifactIds.includes(artifactId)) throw new CityError('NOT_FOUND', 404);
  const artifact = await readArtifactForSnapshot(artifactId, share.scenarioId, share.revisionId);
  // Recheck after storage I/O: a revocation during the read must deny the response.
  const fresh = await liveShare(token);
  if (!fresh.artifactIds.includes(artifactId)) throw new CityError('NOT_FOUND', 404);
  return artifact;
}
export async function compareSharedPlans(inputs: readonly string[]): Promise<SharedComparison> {
  if (inputs.length < 1 || inputs.length > 3) throw new CityError('INVALID_REQUEST');
  const tokens = inputs.map(parseShareToken), snapshots = await Promise.all(tokens.map(getPublicSnapshot));
  const first = snapshots[0];
  for (const snapshot of snapshots) {
    const a = first.evaluation, b = snapshot.evaluation;
    if (!b.valid || !b.complete || b.score === null || a.datasetVersion !== b.datasetVersion || a.sourceHash !== b.sourceHash || a.rulesVersion !== b.rulesVersion || a.evaluatorVersion !== b.evaluatorVersion || a.kind !== b.kind || !!first.stress !== !!snapshot.stress || (first.stress && stableJson(first.stress.assumption) !== stableJson(snapshot.stress?.assumption))) throw new CityError('INCOMPATIBLE_COMPARISON');
  }
  // Each request checks every token again after collection, including mid-read revocation.
  await Promise.all(tokens.map(token => liveShare(token)));
  return { snapshots };
}
export async function forkSharedScenario(p: Principal, token: string, input: z.infer<typeof forkShareSchema>) {
  const share = await liveShare(token);
  return createScenario(p, { source: 'blank', title: input.title ?? share.snapshot.title, clientMutationId: input.clientMutationId }, {
    decisions: share.snapshot.decisions, constraints: share.snapshot.constraints, sourceRevisionId: share.revisionId,
    intent: `Shared snapshot: ${share.snapshot.teamName || share.snapshot.title}`,
  });
}
export async function publicShareRoute(handler: () => Promise<unknown | Response>, status = 200): Promise<Response> {
  let response: Response;
  try { const result = await handler(); response = result instanceof Response ? result : Response.json(result, { status }); }
  catch (error) { response = problemResponse(error); }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
export async function sharedArtifactResponse(token: string, artifactId: string) { return artifactDownloadResponse(await readSharedArtifact(token, artifactId)); }

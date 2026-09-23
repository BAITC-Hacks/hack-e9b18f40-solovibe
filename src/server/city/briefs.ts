import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { briefDraftSchema, briefSectionKinds, createBriefSchema, editBriefSchema, refreshBriefSchema, type BriefRecord, type BriefSection, type BriefView } from '@/features/city/brief/contracts';
import type { EvaluationRecord } from '@/features/city/records';
import { stableJson } from '@/features/city/search';
import { getDb, type CityDb, type CityTx } from '@/server/db/core';
import { cityBriefs, cityBriefVersions, cityEvaluations, cityRevisions, cityScenarios } from '@/server/db/schema';
import type { Principal } from './principal';
import { CityError } from './errors';
import { getRevision, requireScenario, revisionRecord } from './scenarios';
import { getStress } from './stress';
import {evaluate} from '@/features/city/engine';
import {AKIM_DATASET} from '@/features/city/data/akim-v1';

type Reader = CityDb | CityTx;
type Draft = z.infer<typeof briefDraftSchema>;
export async function ownedBrief(p: Principal, id: string, db: Reader = getDb(), lock = false) {
  const query = db.select({ brief: cityBriefs }).from(cityBriefs).innerJoin(cityScenarios, eq(cityScenarios.id, cityBriefs.scenarioId))
    .where(and(eq(cityBriefs.id, id), inArray(cityBriefs.ownerId, p.ownerIds), inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt)));
  const [row] = await (lock ? query.for('update', { of: cityBriefs }) : query);
  if (!row) throw new CityError('NOT_FOUND', 404);
  return row.brief;
}
async function snapshot(p: Principal, revisionId: string, db: Reader = getDb()) {
  const [row] = await db.select({ revision: cityRevisions, evaluation: cityEvaluations }).from(cityRevisions)
    .innerJoin(cityScenarios, eq(cityScenarios.id, cityRevisions.scenarioId)).innerJoin(cityEvaluations, eq(cityEvaluations.revisionId, cityRevisions.id))
    .where(and(eq(cityRevisions.id, revisionId), inArray(cityScenarios.ownerId, p.ownerIds), isNull(cityScenarios.deletedAt)));
  if (!row) throw new CityError('NOT_FOUND', 404);
  return { revision: revisionRecord(row.revision), evaluation: { id: row.evaluation.id, revisionId, result: row.evaluation.result } };
}
const pendingSections = (): BriefSection[] => briefSectionKinds.map(id => ({ id, text: '', refs: [], userEdited: false, stale: false, generatedText: null }));
function sourceHash(view: Pick<BriefView, 'source' | 'stress' | 'comparisons'>) {
  return createHash('sha256').update(stableJson({ source: {id:view.source.revision.id,evaluation:view.source.evaluation}, stress: view.stress?{id:view.stress.experiment.id,assumption:view.stress.experiment.assumption,selected:view.stress.selectedEvaluation}:null, comparisons: view.comparisons.map(c=>({id:c.revision.id,evaluation:c.evaluation})) })).digest('hex');
}
async function sources(p: Principal, record: Pick<BriefRecord, 'scenarioId' | 'sourceRevisionId' | 'stressId' | 'comparisonRevisionIds'>, db: Reader = getDb()) {
  const source = await getRevision(p, record.scenarioId, record.sourceRevisionId, db);
  if (!source.evaluation.result.valid || !source.evaluation.result.complete || source.evaluation.result.score === null) throw new CityError('INVALID_PLAN');
  const stress = record.stressId ? await getStress(p, record.stressId, db) : null;
  if (stress && stress.experiment.scenarioId !== record.scenarioId) throw new CityError('STALE_EVIDENCE');
  if(stress){stress.selectedEvaluation=evaluate(AKIM_DATASET,source.revision.decisions,stress.experiment.assumption);stress.selectedRevisionId=source.revision.id;}
  const comparisons = await Promise.all(record.comparisonRevisionIds.map(id => snapshot(p, id, db)));
  for (const item of comparisons) {
    const a = source.evaluation.result, b = item.evaluation.result;
    if (!b.valid || !b.complete || b.score === null || a.sourceHash !== b.sourceHash || a.rulesVersion !== b.rulesVersion || a.evaluatorVersion !== b.evaluatorVersion || a.kind !== b.kind) throw new CityError('INCOMPATIBLE_COMPARISON');
  }
  return { source, stress, comparisons };
}
export async function getBrief(p: Principal, id: string, version?: number, db: Reader = getDb()): Promise<BriefView> {
  const row = await ownedBrief(p, id, db);
  let brief = row.content;
  if (version !== undefined && version !== row.version) {
    const [historical] = await db.select().from(cityBriefVersions).where(and(eq(cityBriefVersions.briefId, id), eq(cityBriefVersions.version, version)));
    if (!historical) throw new CityError('NOT_FOUND', 404);
    brief = historical.content;
  }
  const loaded = await sources(p, brief, db);
  const scenario = await requireScenario(p, row.scenarioId, db);
  const versions = await db.select({ version: cityBriefVersions.version }).from(cityBriefVersions).where(eq(cityBriefVersions.briefId, id)).orderBy(desc(cityBriefVersions.version));
  return { brief, ...loaded, stale: scenario.currentRevisionId !== brief.sourceRevisionId || brief.version !== row.version, versions: versions.map(v => v.version) };
}
export async function listBriefs(p: Principal, scenarioId: string) {
  await requireScenario(p, scenarioId);
  const rows = await getDb().select().from(cityBriefs).where(and(eq(cityBriefs.scenarioId, scenarioId), inArray(cityBriefs.ownerId, p.ownerIds))).orderBy(desc(cityBriefs.updatedAt));
  return { items: rows.map(r => r.content) };
}
async function saveVersion(tx: CityTx, content: BriefRecord, snapshotId: string = randomUUID()) {
  await tx.update(cityBriefs).set({ content, version: content.version, sourceRevisionId: content.sourceRevisionId, updatedAt: new Date(content.updatedAt) }).where(eq(cityBriefs.id, content.id));
  await tx.insert(cityBriefVersions).values({ id: snapshotId, briefId: content.id, version: content.version, content });
}
export async function createBrief(p: Principal, input: z.infer<typeof createBriefSchema>): Promise<BriefView> {
  const id = await getDb().transaction(async tx => {
    const source = await snapshot(p, input.sourceRevisionId, tx);
    const scenario = await requireScenario(p, source.revision.scenarioId, tx, true);
    const [existing] = await tx.select().from(cityBriefs).where(and(eq(cityBriefs.ownerId, scenario.ownerId), eq(cityBriefs.clientMutationId, input.clientMutationId)));
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const brief: BriefRecord = { id: randomUUID(), scenarioId: scenario.id, sourceRevisionId: source.revision.id, stressId: input.stressId ?? null, comparisonRevisionIds: [...new Set(input.comparisonRevisionIds)].filter(id => id !== source.revision.id), version: 1, title: scenario.title, locale: input.locale, sections: pendingSections(), sourceHash: '', status: 'pending', lastRunId: null, createdAt: now, updatedAt: now };
    brief.sourceHash = sourceHash(await sources(p, brief, tx));
    await tx.insert(cityBriefs).values({ id: brief.id, ownerId: scenario.ownerId, scenarioId: scenario.id, sourceRevisionId: brief.sourceRevisionId, version: 1, content: brief, clientMutationId: input.clientMutationId });
    await tx.insert(cityBriefVersions).values({ id: randomUUID(), briefId: brief.id, version: 1, content: brief });
    return brief.id;
  });
  return getBrief(p, id);
}
const statusFor = (sections: BriefSection[]): BriefRecord['status'] => sections.some(s=>!s.text.trim())?'pending':sections.some(s => s.stale) ? 'needs_review' : 'ready';
export async function editBrief(p: Principal, id: string, input: z.infer<typeof editBriefSchema>) {
  await getDb().transaction(async tx => {
    const row = await ownedBrief(p, id, tx, true);
    if (row.version !== input.expectedVersion) throw new CityError('STALE_BRIEF', 409);
    if (new Set(input.sectionEdits.map(s => s.id)).size !== input.sectionEdits.length) throw new CityError('INVALID_REQUEST');
    const sections = row.content.sections.map(section => {
      const edit = input.sectionEdits.find(e => e.id === section.id);
      if (!edit) return section;
      if (edit.acceptGenerated && section.generatedText !== edit.text) throw new CityError('INVALID_REQUEST');
      return { ...section, text: edit.text, userEdited: !edit.acceptGenerated, stale: false };
    });
    const content = { ...row.content, title: input.title ?? row.content.title, sections, version: row.version + 1, updatedAt: new Date().toISOString(), status: statusFor(sections) };
    await saveVersion(tx, content);
  });
  return getBrief(p, id);
}
export async function refreshBrief(p: Principal, id: string, input: z.infer<typeof refreshBriefSchema>) {
  await getDb().transaction(async tx => {
    const row = await ownedBrief(p, id, tx, true);
    const receiptId = `${id}:refresh:${input.clientRequestId}`;
    const [duplicate] = await tx.select({ id: cityBriefVersions.id }).from(cityBriefVersions).where(eq(cityBriefVersions.id, receiptId));
    if (duplicate) return;
    if (row.version !== input.expectedVersion) throw new CityError('STALE_BRIEF', 409);
    const changed = row.sourceRevisionId !== input.targetRevisionId;
    const content: BriefRecord = { ...row.content, sourceRevisionId: input.targetRevisionId, version: row.version + 1, updatedAt: new Date().toISOString(), lastRunId: null };
    const loaded = await sources(p, content, tx);
    content.sourceHash = sourceHash(loaded);
    content.sections = row.content.sections.map(s => s.userEdited ? { ...s, stale: s.stale || changed, refs: changed ? [] : s.refs, generatedText: changed ? null : s.generatedText } : changed || !input.sectionIds || input.sectionIds.includes(s.id) ? { ...s, text: '', generatedText: null, refs: [], stale: false } : s);
    content.status = statusFor(content.sections);
    await saveVersion(tx, content, receiptId);
  });
  return getBrief(p, id);
}

/** Saved source records only; synthetic stress identifiers explicitly distinguish sensitivity. */
export function briefEvaluations(view: BriefView): Map<string, EvaluationRecord> {
  const values = [view.source.evaluation, ...view.comparisons.map(c => c.evaluation)];
  if (view.stress) values.push({ id: `stress:${view.stress.experiment.id}:baseline`, revisionId: view.brief.sourceRevisionId, result: view.stress.experiment.baseline }, { id: `stress:${view.stress.experiment.id}:stressed`, revisionId: view.brief.sourceRevisionId, result: view.stress.experiment.stressed });
  if(view.stress?.selectedEvaluation)values.push({id:`stress:${view.stress.experiment.id}:selected`,revisionId:view.brief.sourceRevisionId,result:view.stress.selectedEvaluation});
  return new Map(values.map(v => [v.id, v]));
}
export function checkBriefDrafts(view: BriefView, drafts: Draft[], sectionIds?: readonly string[]) {
  const issues: string[] = [], records = briefEvaluations(view);
  if (new Set(drafts.map(d => d.id)).size !== drafts.length) issues.push('DUPLICATE_SECTION');
  const allowed = view.brief.sections.filter(s => sectionIds ? sectionIds.includes(s.id) : !s.userEdited).map(s => s.id);
  if (drafts.some(d => !allowed.includes(d.id)) || allowed.some(id => !drafts.some(d => d.id === id))) issues.push('SECTION_SCOPE_MISMATCH');
  for (const draft of drafts) {
    if (/\p{N}|https?:\/\//u.test(draft.text)) issues.push('NUMERIC_PROSE_OR_URL');
    if (/гарантир|сэконом.*тенге|guaranteed|actual savings|нақты үнем|глобальн.*оптим|global.*optim|ең үздік|globally best/iu.test(draft.text)) issues.push('UNSUPPORTED_REAL_WORLD_CLAIM');
    if (draft.id === 'limits' && (!/модел|model|үлгі/iu.test(draft.text) || !/нақты|реаль|real|болжам|прогноз|forecast|себеп|caus/iu.test(draft.text))) issues.push('MODEL_LIMITATION_REQUIRED');
    if (['benefits', 'risks'].includes(draft.id) && !draft.refs.length) issues.push('EVIDENCE_REQUIRED');
    const deltas: number[] = [];
    for (const link of draft.refs) {
      const record = records.get(link.evaluationId), ref = record?.result.evidence.find(e => e.id === link.evidenceId);
      const compared = link.compareToEvaluationId ? records.get(link.compareToEvaluationId) : undefined;
      if (!record || !ref || (link.compareToEvaluationId && !compared)) { issues.push('UNKNOWN_EVIDENCE'); continue; }
      if (record.result.sourceHash !== view.source.evaluation.result.sourceHash || record.result.evaluatorVersion !== view.source.evaluation.result.evaluatorVersion) issues.push('STALE_EVIDENCE');
      if (compared) {
        const before = compared.result.evidence.find(e => e.id === link.evidenceId);
        if (!before) issues.push('COMPARISON_EVIDENCE_MISMATCH');
        else deltas.push(ref.value - before.value);
      } else if (['effect', 'synergy', 'clipping'].includes(ref.kind)) deltas.push(ref.value);
      else if (ref.kind === 'indicator') deltas.push(record.result.districts.find(d => d.districtId === ref.districtId)!.indicators.find(i => i.indicatorId === ref.indicatorId)!.delta);
    }
    if (draft.id === 'benefits' && (!deltas.some(v => v > 0) || deltas.some(v => v < 0))) issues.push('BENEFIT_DIRECTION_MISMATCH');
    if (draft.id === 'tradeoffs' && draft.refs.length && !deltas.some(v => v < 0)) issues.push('TRADEOFF_DIRECTION_MISMATCH');
    if (draft.id === 'tradeoffs' && !draft.refs.length && (view.source.evaluation.result.districts.some(d => d.indicators.some(i => i.delta < 0)) || view.comparisons.some(c => c.evaluation.result.districts.some(d => d.indicators.some(i => i.after > view.source.evaluation.result.districts.find(x => x.districtId === d.districtId)!.indicators.find(x => x.indicatorId === i.indicatorId)!.after))))) issues.push('CONCESSION_EVIDENCE_REQUIRED');
  }
  return [...new Set(issues)];
}
export async function commitGeneratedBrief(tx: CityTx, p: Principal, id: string, expectedVersion: number, drafts: Draft[], sectionIds: readonly string[] | undefined, runId: string) {
  const row = await ownedBrief(p, id, tx, true);
  if (row.version !== expectedVersion) throw new CityError('STALE_BRIEF', 409);
  const view = await getBrief(p, id, undefined, tx);
  const issues = checkBriefDrafts(view, drafts, sectionIds);
  if (issues.length) throw new CityError('AI_QUALITY_FAILED', 400, issues.map(code => ({ code, params: {} })));
  const sections = row.content.sections.map(s => { const draft = drafts.find(d => d.id === s.id); return draft ? { ...draft, generatedText: draft.text, userEdited: false, stale: false } : s; });
  const content: BriefRecord = { ...row.content, sections, version: row.version + 1, lastRunId: runId, updatedAt: new Date().toISOString(), status: statusFor(sections) };
  await saveVersion(tx, content);
  return { briefId: id, version: content.version, status: content.status };
}

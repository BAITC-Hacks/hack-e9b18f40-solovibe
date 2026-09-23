import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '@/server/db/core';
import { cityEvaluations, cityRevisions, cityScenarios } from '@/server/db/schema';
import { compareSnapshots } from '@/features/city/comparison';
import type { Principal } from './principal';
import { revisionRecord } from './scenarios';
import { CityError } from './errors';
export const comparisonSchema = z.object({revisionIds:z.array(z.string().uuid()).min(1).max(3)}).strict();
export async function comparePlans(p:Principal, revisionIds:string[]) {
  const rows = await getDb().select({revision:cityRevisions,evaluation:cityEvaluations}).from(cityRevisions)
    .innerJoin(cityScenarios,eq(cityRevisions.scenarioId,cityScenarios.id)).innerJoin(cityEvaluations,eq(cityEvaluations.revisionId,cityRevisions.id))
    .where(and(inArray(cityScenarios.ownerId,p.ownerIds),isNull(cityScenarios.deletedAt),inArray(cityRevisions.id,revisionIds)));
  const snapshots = revisionIds.map(id => { const row=rows.find(r=>r.revision.id===id); if(!row) throw new CityError('NOT_FOUND',404); return {revision:revisionRecord(row.revision),evaluation:row.evaluation}; });
  try { return compareSnapshots(snapshots); } catch { throw new CityError('INCOMPATIBLE_COMPARISON',400); }
}

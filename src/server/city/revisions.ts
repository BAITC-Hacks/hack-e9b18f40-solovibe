import { and, desc, eq, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db/core';
import { cityEvaluations, cityRevisions } from '@/server/db/schema';
import type { Principal } from './principal';
import { getRevision, requireScenario, revisionRecord } from './scenarios';
import { CityError } from './errors';
export async function listRevisions(p:Principal,scenarioId:string,cursor?:string|null) {
  await requireScenario(p,scenarioId);
  let before:{time:string;id:string}|undefined;
  if(cursor) { try { before=z.object({time:z.iso.datetime(),id:z.string().uuid()}).parse(JSON.parse(Buffer.from(cursor,'base64url').toString())); } catch { throw new CityError('INVALID_REQUEST'); } }
  const rows=await getDb().select({revision:cityRevisions,evaluation:cityEvaluations}).from(cityRevisions)
    .innerJoin(cityEvaluations,eq(cityEvaluations.revisionId,cityRevisions.id)).where(and(eq(cityRevisions.scenarioId,scenarioId),before?or(lt(cityRevisions.createdAt,new Date(before.time)),and(eq(cityRevisions.createdAt,new Date(before.time)),lt(cityRevisions.id,before.id))):undefined))
    .orderBy(desc(cityRevisions.createdAt),desc(cityRevisions.id)).limit(21);
  const items=rows.slice(0,20).map(r=>({revision:revisionRecord(r.revision),evaluation:r.evaluation})),last=items.at(-1);
  return {items,nextCursor:rows.length>20&&last?Buffer.from(JSON.stringify({time:last.revision.createdAt,id:last.revision.id})).toString('base64url'):null};
}
export async function renameRevision(p:Principal,scenarioId:string,revisionId:string,title:string) {
  return getDb().transaction(async tx=>{ await requireScenario(p,scenarioId,tx,true); await getRevision(p,scenarioId,revisionId,tx);
    await tx.update(cityRevisions).set({title}).where(and(eq(cityRevisions.id,revisionId),eq(cityRevisions.scenarioId,scenarioId)));
    return getRevision(p,scenarioId,revisionId,tx);
  });
}

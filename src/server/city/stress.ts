import {randomUUID} from 'node:crypto';
import {and,desc,eq,inArray,isNull} from 'drizzle-orm';
import {z} from 'zod';
import {getDb,type CityTx} from '@/server/db/core';
import {cityRevisions,cityScenarios,cityStressTests} from '@/server/db/schema';
import {stressAssumptionSchema} from '@/features/city/contracts';
import {AKIM_DATASET} from '@/features/city/data/akim-v1';
import {evaluate} from '@/features/city/engine';
import type {StressRecord,StressView} from '@/features/city/workshop-contracts';
import type {Principal} from './principal';
import {getRevision,requireScenario} from './scenarios';
import {CityError} from './errors';
export const createStressSchema=stressAssumptionSchema.extend({sourceRevisionId:z.string().uuid(),clientMutationId:z.string().uuid()}).strict();
export async function requireOwnedRevision(p:Principal,id:string,db:ReturnType<typeof getDb>|CityTx=getDb()){
 const [row]=await db.select({revision:cityRevisions,scenario:cityScenarios}).from(cityRevisions).innerJoin(cityScenarios,eq(cityScenarios.id,cityRevisions.scenarioId)).where(and(eq(cityRevisions.id,id),inArray(cityScenarios.ownerId,p.ownerIds),isNull(cityScenarios.deletedAt)));
 if(!row)throw new CityError('NOT_FOUND',404);return row;
}
function record(row:typeof cityStressTests.$inferSelect):StressRecord {return {id:row.id,scenarioId:row.scenarioId,sourceRevisionId:row.sourceRevisionId,assumption:row.assumption,baseline:row.baseline,stressed:row.stressed,repairRevisionIds:row.repairRevisionIds,createdAt:row.createdAt.toISOString()};}
export async function createStress(p:Principal,input:z.infer<typeof createStressSchema>,db:ReturnType<typeof getDb>|CityTx=getDb()){
 const source=await requireOwnedRevision(p,input.sourceRevisionId,db);
 const baseline=evaluate(AKIM_DATASET,source.revision.decisions);
 if(!baseline.complete||!baseline.valid||!source.revision.decisions.some(d=>d.measureId===input.measureId))throw new CityError('INVALID_PLAN');
 const assumption=stressAssumptionSchema.parse({measureId:input.measureId,costIncreasePct:input.costIncreasePct,extraLagQuarters:input.extraLagQuarters});
 const [existing]=await db.select().from(cityStressTests).where(and(eq(cityStressTests.ownerId,source.scenario.ownerId),eq(cityStressTests.clientMutationId,input.clientMutationId)));
 if(existing)return record(existing);
 const [row]=await db.insert(cityStressTests).values({id:randomUUID(),ownerId:source.scenario.ownerId,scenarioId:source.scenario.id,sourceRevisionId:source.revision.id,assumption,baseline,stressed:evaluate(AKIM_DATASET,source.revision.decisions,assumption),clientMutationId:input.clientMutationId}).onConflictDoNothing().returning();
 if(row)return record(row);
 const [duplicate]=await db.select().from(cityStressTests).where(and(eq(cityStressTests.ownerId,source.scenario.ownerId),eq(cityStressTests.clientMutationId,input.clientMutationId)));return record(duplicate);
}
export async function getStress(p:Principal,id:string,db:ReturnType<typeof getDb>|CityTx=getDb()):Promise<StressView>{
 const [row]=await db.select().from(cityStressTests).where(and(eq(cityStressTests.id,id),inArray(cityStressTests.ownerId,p.ownerIds)));if(!row)throw new CityError('NOT_FOUND',404);
 const scenario=await requireScenario(p,row.scenarioId,db);
 const repairs=await Promise.all(row.repairRevisionIds.map(async revisionId=>{const saved=await getRevision(p,row.scenarioId,revisionId,db);return {...saved,sensitivity:evaluate(AKIM_DATASET,saved.revision.decisions,row.assumption)};}));
 return {experiment:record(row),stale:scenario.currentRevisionId!==row.sourceRevisionId,repairs};
}
export async function listStress(p:Principal,scenarioId:string){await requireScenario(p,scenarioId);const rows=await getDb().select().from(cityStressTests).where(and(eq(cityStressTests.scenarioId,scenarioId),inArray(cityStressTests.ownerId,p.ownerIds))).orderBy(desc(cityStressTests.createdAt)).limit(50);return {items:rows.map(record)};}

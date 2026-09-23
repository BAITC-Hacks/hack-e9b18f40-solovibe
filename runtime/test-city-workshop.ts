import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {getDb} from '../src/server/db/core';
import {cityDatasets,cityOwners} from '../src/server/db/schema';
import {AKIM_DATASET,DEFAULT_CONSTRAINTS} from '../src/features/city/data/akim-v1';
import {createScenario,applyRevision,getScenario,forkScenario,saveRevision} from '../src/server/city/scenarios';
import {createSearch,getSearch,processSearchJob,cancelSearch} from '../src/server/city/searches';
import {comparePlans} from '../src/server/city/comparisons';
import {listRevisions,renameRevision} from '../src/server/city/revisions';
import {claimJob} from '../src/server/city/jobs';
import type {Principal} from '../src/server/city/principal';
import {publicProof} from '../src/server/city/public-proof';

const admin=postgres(process.env.DATABASE_URL!,{max:1,onnotice:()=>{}});
const schema=`city_workshop_test_${randomUUID().replaceAll('-','')}`;
const globalDb=globalThis as unknown as {citySql?:ReturnType<typeof postgres>};
assert.equal(globalDb.citySql,undefined);
let isolated:ReturnType<typeof postgres>|undefined;
async function principal():Promise<Principal>{const id=randomUUID();await getDb().insert(cityOwners).values({id,guestTokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000)});return {ownerIds:[id],primaryOwnerId:id,userId:null,kind:'guest'};}
try {
 await admin`create schema ${admin(schema)}`;
 const tables=await admin<{tablename:string}[]>`select tablename from pg_tables where schemaname='public' and (tablename like 'city_%' or tablename in ('user','session','account','verification'))`;
 for(const {tablename} of tables)await admin`create table ${admin(`${schema}.${tablename}`)} (like ${admin(`public.${tablename}`)} including all)`;
 isolated=postgres(process.env.DATABASE_URL!,{max:8,connection:{search_path:schema}});globalDb.citySql=isolated;
 await getDb().insert(cityDatasets).values({id:AKIM_DATASET.version,sourceHash:AKIM_DATASET.sourceHash,rulesVersion:AKIM_DATASET.rulesVersion,evaluatorVersion:AKIM_DATASET.evaluatorVersion,payload:AKIM_DATASET});
 const p=await principal(),other=await principal();
 const source=await createScenario(p,{source:'proof',proofVariant:'two-districts',clientMutationId:randomUUID()});
 assert.deepEqual(source.revision.decisions,publicProof().twoDistricts.decisions);assert.equal(source.evaluation.result.cost,100);
 const request={scenarioId:source.scenario.id,inputRevisionId:source.revision.id,constraints:{...DEFAULT_CONSTRAINTS,minDirectDistricts:2},priceCondition:'minDirectDistricts' as const,limit:3,clientRequestId:randomUUID()};
 const queued=await createSearch(p,request);assert.equal((await createSearch(p,request)).id,queued.id);
 const job=await claimJob('workshop-test');assert.equal(job?.id,queued.id);await processSearchJob(job!,new AbortController().signal);
 const result=await getSearch(p,queued.id);assert.equal(result.status,'completed');assert.equal(result.alternatives.length,3);
 assert.equal(result.baseline?.certificate?.exhaustive,true);assert.equal(result.result?.certificate?.exhaustive,true);
 assert.ok(Math.abs(result.baseline!.candidates[0].evaluation.score!-result.result!.candidates[0].evaluation.score!-.239035)<1e-7);
 assert.equal((await getScenario(p,source.scenario.id)).revision.id,source.revision.id);
 const ids=result.alternatives.map(x=>x.revision.id);const comparison=await comparePlans(p,[source.revision.id,...ids.slice(0,2)]);assert.equal(comparison.snapshots.length,3);
 await assert.rejects(comparePlans(other,ids),{code:'NOT_FOUND'});await assert.rejects(getSearch(other,queued.id),{code:'NOT_FOUND'});
 const applied=await applyRevision(p,source.scenario.id,{revisionId:ids[0],expectedRevisionId:source.revision.id,clientMutationId:randomUUID()});assert.notEqual(applied.revision.id,source.revision.id);
 await assert.rejects(applyRevision(p,source.scenario.id,{revisionId:ids[1],expectedRevisionId:source.revision.id,clientMutationId:randomUUID()}),{code:'STALE_REVISION'});
 const restored=await applyRevision(p,source.scenario.id,{revisionId:source.revision.id,expectedRevisionId:applied.revision.id,clientMutationId:randomUUID()});assert.equal(restored.revision.sourceRevisionId,source.revision.id);
 await renameRevision(p,source.scenario.id,ids[0],'Chosen alternative');assert.ok((await listRevisions(p,source.scenario.id)).items.some(x=>x.revision.title==='Chosen alternative'));
 const fork=await forkScenario(p,source.scenario.id,{revisionId:ids[1],clientMutationId:randomUUID()});assert.equal(fork.revision.sourceRevisionId,ids[1]);
 const locked=await saveRevision(p,source.scenario.id,{expectedRevisionId:restored.revision.id,decisions:restored.revision.decisions,constraints:{...request.constraints,locked:[{measureId:'M7',districtId:'nura'}]},clientMutationId:randomUUID()});
 const q2=await createSearch(p,{...request,inputRevisionId:locked.revision.id,constraints:locked.revision.constraints,clientRequestId:randomUUID()});await cancelSearch(p,q2.id);assert.equal((await getSearch(p,q2.id)).status,'cancelled');assert.equal(await claimJob('workshop-test'),null);
 console.log('PASS workshop: exact condition price, owned saved branches, compare/privacy, apply/restore CAS, history/rename/fork, queue cancellation, identical proof entry. No provider calls.');
}finally{if(isolated)await isolated.end({timeout:5});delete globalDb.citySql;assert.match(schema,/^city_workshop_test_[a-f0-9]{32}$/);await admin`drop schema if exists ${admin(schema)} cascade`;await admin.end({timeout:5});}

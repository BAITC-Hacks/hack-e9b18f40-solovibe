import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {mkdir,writeFile} from 'node:fs/promises';
import {getDb} from '../src/server/db/core';
import {cityDatasets,cityOwners,cityToolReceipts,cityRuns} from '../src/server/db/schema';
import {AKIM_DATASET} from '../src/features/city/data/akim-v1';
import {createScenario,saveRevision,applyRevision,getScenario} from '../src/server/city/scenarios';
import {createStress,getStress} from '../src/server/city/stress';
import {createSearch,processSearchJob,getSearch} from '../src/server/city/searches';
import {claimJob,createExecution,finishRun,renewLease} from '../src/server/city/jobs';
import {createRun,getRun} from '../src/server/city/runs';
import {runAnalysis} from '../src/server/city/ai/runner';
import {createBrief,editBrief,getBrief,refreshBrief} from '../src/server/city/briefs';
import {createArtifact} from '../src/server/city/exports';
import {readArtifactForSnapshot} from '../src/server/city/artifact-access';
import {createShare,getPublicSnapshot,revokeShare,compareSharedPlans,readSharedArtifact} from '../src/server/city/shares';
import {cleanupArtifacts,revokeOwnerArtifacts,purgeDeletedOwnerArtifacts} from '../src/server/city/cleanup';
import {getStorageBackend} from '../src/server/storage-core';
import type {Principal} from '../src/server/city/principal';
const live=process.env.CITY_DELIVERY_LIVE==='1';
const admin=postgres(process.env.DATABASE_URL!,{max:1,onnotice:()=>{}}),schema=`city_delivery_test_${randomUUID().replaceAll('-','')}`;
const g=globalThis as unknown as {citySql?:ReturnType<typeof postgres>};assert.equal(g.citySql,undefined);let isolated:ReturnType<typeof postgres>|undefined;
const owners:string[]=[];const started=Date.now();
async function owner():Promise<Principal>{const id=randomUUID();owners.push(id);await getDb().insert(cityOwners).values({id,guestTokenHash:randomUUID(),expiresAt:new Date(Date.now()+3600000)});return {ownerIds:[id],primaryOwnerId:id,userId:null,kind:'guest'};}
async function execute(){const job=await claimJob('delivery-check');assert.ok(job);const abort=new AbortController();const renewal=setInterval(()=>void renewLease(job.id,job.leaseToken),10000);try{if(job.kind==='search'){await processSearchJob(job,abort.signal);return;}const lease={id:job.id,runId:job.runId!,ownerId:job.ownerId!,token:job.leaseToken,workerId:'delivery-check',deadlineAt:job.deadlineAt,signal:abort.signal};try{const result=await runAnalysis(await createExecution(lease));await finishRun(lease,result);}catch(e){await writeFile('.checks/delivery-failure.json',JSON.stringify({runs:await getDb().select().from(cityRuns),receipts:await getDb().select().from(cityToolReceipts)},null,2));throw e;}}finally{clearInterval(renewal);}}
try{
 await admin`create schema ${admin(schema)}`;const tables=await admin<{tablename:string}[]>`select tablename from pg_tables where schemaname='public' and (tablename like 'city_%' or tablename in ('user','session','account','verification'))`;
 for(const {tablename} of tables)await admin`create table ${admin(`${schema}.${tablename}`)} (like ${admin(`public.${tablename}`)} including all)`;
 isolated=postgres(process.env.DATABASE_URL!,{max:8,connection:{search_path:schema}});g.citySql=isolated;
 await getDb().insert(cityDatasets).values({id:AKIM_DATASET.version,sourceHash:AKIM_DATASET.sourceHash,rulesVersion:AKIM_DATASET.rulesVersion,evaluatorVersion:AKIM_DATASET.evaluatorVersion,payload:AKIM_DATASET});
 const p=await owner(),other=await owner();let source=await createScenario(p,{source:'proof',proofVariant:'two-districts',clientMutationId:randomUUID(),title:'Вложения в два района'});
 source=await saveRevision(p,source.scenario.id,{expectedRevisionId:source.revision.id,decisions:source.revision.decisions,constraints:{...source.revision.constraints,locked:[{measureId:'M7',districtId:'nura'}]},clientMutationId:randomUUID()});
 const experiment=await createStress(p,{sourceRevisionId:source.revision.id,measureId:'M3',costIncreasePct:20,extraLagQuarters:0,clientMutationId:randomUUID()});assert.equal(experiment.stressed.cost,106);assert.equal(experiment.stressed.score,null);assert.equal(experiment.baseline.cost,100);
 await assert.rejects(getStress(other,experiment.id),{code:'NOT_FOUND'});
 const delay=await createStress(p,{sourceRevisionId:source.revision.id,measureId:'M3',costIncreasePct:0,extraLagQuarters:1,clientMutationId:randomUUID()});assert.notEqual(delay.stressed.score,delay.baseline.score);
 const job=await createSearch(p,{scenarioId:source.scenario.id,inputRevisionId:source.revision.id,constraints:source.revision.constraints,assumptions:experiment.assumption,stressId:experiment.id,limit:3,clientRequestId:randomUUID()});await execute();const result=await getSearch(p,job.id);assert.equal(result.status,'completed');assert.ok(result.alternatives.length);
 let repaired=(await getStress(p,experiment.id)).repairs[0];assert.equal(repaired.sensitivity.valid,true);assert.ok(repaired.sensitivity.cost<=100);assert.ok(repaired.revision.decisions.some(d=>d.measureId==='M7'&&d.districtId==='nura'));
 if(live&&process.env.CITY_DELIVERY_CASE!=='brief'){
  assert.ok(process.env.OPENAI_API_KEY,'Configured provider required');
  const run=await createRun(p,{scenarioId:source.scenario.id,inputRevisionId:source.revision.id,procedure:'plan',context:{stressId:experiment.id},objective:'Исправь сценарий при удорожании выбранной меры. Сохрани закреплённую школу в Нуре и прямые вложения хотя бы в два района. Сохрани допустимый вариант и объясни конкретный компромисс, учитывая то же удорожание.',locale:'ru',clientRequestId:randomUUID()},'delivery-check');
  await execute();const checked=await getRun(p,run.run.id);assert.equal(checked.run.status,'completed');assert.ok(checked.analysis);assert.ok(checked.alternatives.length);assert.ok(checked.alternatives.every(a=>a.evaluation.result.kind==='sensitivity'&&a.evaluation.result.valid));
  repaired=(await getStress(p,experiment.id)).repairs.find(r=>r.revision.id===checked.alternatives[0].revision.id)!;
  console.log('PASS live stress repair',JSON.stringify({runId:run.run.id,tools:checked.events.filter(e=>e.kind==='tool'&&e.status==='completed').map(e=>e.toolName),cost:repaired.sensitivity.cost,score:repaired.sensitivity.score,elapsedMs:Date.now()-started}));
 }
 const brief=await createBrief(p,{sourceRevisionId:source.revision.id,stressId:experiment.id,comparisonRevisionIds:[repaired.revision.id],locale:'ru',clientMutationId:randomUUID()});
 if(live){const run=await createRun(p,{scenarioId:source.scenario.id,inputRevisionId:source.revision.id,procedure:'brief',objective:'Подготовь краткое обоснование выбранного сценария для обсуждения. Покажи кому помогают решения, слабые стороны и результат заданного удорожания. Сопоставь с вариантом ремонта. Числа выводи через проверенные ссылки.',locale:'ru',context:{briefId:brief.brief.id,briefVersion:brief.brief.version},clientRequestId:randomUUID()},'delivery-check');await execute();const checked=await getRun(p,run.run.id);assert.equal(checked.run.status,'completed');console.log('PASS live brief',JSON.stringify({runId:run.run.id,elapsedMs:Date.now()-started}));}
 let current=await getBrief(p,brief.brief.id);if(live)await writeFile('.checks/verified-live-brief.json',JSON.stringify(current,null,2));const note='Сохраняем школу как согласованное обязательство команды.';
 current=await editBrief(p,current.brief.id,{expectedVersion:current.brief.version,sectionEdits:[{id:'rationale',text:note}]});assert.equal(current.brief.sections.find(s=>s.id==='rationale')?.text,note);
 const originalVersion=current.brief.version;
 const artifacts=[];for(const kind of (live?['json','csv','html']:['json','csv']) as ('json'|'csv'|'html')[]){const file=await createArtifact(p,{revisionId:source.revision.id,briefId:brief.brief.id,briefVersion:current.brief.version,kind,locale:'ru',clientMutationId:randomUUID()});assert.equal(file.state,'ready');const bytes=await readArtifactForSnapshot(file.id,source.scenario.id,source.revision.id);assert.equal(bytes.record.sha256,file.sha256);if(kind==='json')assert.equal(JSON.parse(Buffer.from(bytes.bytes).toString()).brief.sections.find((s:{id:string})=>s.id==='rationale').text,note);artifacts.push(file);}
 const shared=live?await createShare(p,{revisionId:source.revision.id,briefId:brief.brief.id,briefVersion:current.brief.version,artifactIds:artifacts.map(a=>a.id),teamName:'SoloVibe',clientMutationId:randomUUID()}):null;if(shared){assert.ok(shared.token);const snapshot=await getPublicSnapshot(shared.token!);assert.equal(snapshot.brief?.version,originalVersion);const downloaded=await readSharedArtifact(shared.token!,artifacts[0].id);assert.equal(downloaded.record.sha256,artifacts[0].sha256);}
 const applied=await applyRevision(p,source.scenario.id,{revisionId:repaired.revision.id,expectedRevisionId:source.revision.id,clientMutationId:randomUUID()});
 current=await refreshBrief(p,current.brief.id,{expectedVersion:current.brief.version,targetRevisionId:applied.revision.id,clientRequestId:randomUUID()});assert.equal(current.brief.sections.find(s=>s.id==='rationale')?.text,note);assert.equal(current.brief.sections.find(s=>s.id==='rationale')?.stale,true);assert.equal((await getBrief(p,current.brief.id,originalVersion)).brief.sourceRevisionId,source.revision.id);if(shared)assert.equal((await getPublicSnapshot(shared.token!)).revisionId,source.revision.id);
 const official=await createShare(p,{revisionId:applied.revision.id,artifactIds:[],teamName:'Repair',clientMutationId:randomUUID()});assert.equal((await compareSharedPlans([official.token!])).snapshots.length,1);if(shared)await assert.rejects(compareSharedPlans([shared.token!,official.token!]));
 if(shared){await revokeShare(p,shared.share.id);await assert.rejects(getPublicSnapshot(shared.token!),{code:'NOT_FOUND'});await assert.rejects(readSharedArtifact(shared.token!,artifacts[0].id),{code:'NOT_FOUND'});}
 assert.equal((await getScenario(p,source.scenario.id)).revision.id,applied.revision.id);
 if(live){await mkdir('.checks',{recursive:true});await writeFile('.checks/delivery-live.json',JSON.stringify({passed:true,provider:'configured',elapsedMs:Date.now()-started,stressCost:106,repairCost:repaired.sensitivity.cost,briefVersion:originalVersion,artifacts:artifacts.map(a=>({kind:a.kind,sha256:a.sha256,size:a.size})),backend:getStorageBackend()},null,2));}
 console.log(`PASS V5/V7 connected stress→repair→brief→edit→exports→snapshot→apply→refresh→revoke (${live?'live provider':'no provider'}), backend=${getStorageBackend()}`);
}finally{
 if(isolated){for(const id of owners){await revokeOwnerArtifacts(id);await cleanupArtifacts(100);await purgeDeletedOwnerArtifacts(id);}await isolated.end({timeout:5});}delete g.citySql;assert.match(schema,/^city_delivery_test_[a-f0-9]{32}$/);await admin`drop schema if exists ${admin(schema)} cascade`;await admin.end({timeout:5});
}

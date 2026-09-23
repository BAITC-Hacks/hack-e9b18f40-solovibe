import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {eq} from 'drizzle-orm';
import {getDb,getSql} from '../src/server/db/core';
import {cityOwners} from '../src/server/db/schema';
import {createScenario,getScenario} from '../src/server/city/scenarios';
import type {Principal} from '../src/server/city/principal';
const ids=[randomUUID(),randomUUID()];
const p=(id:string):Principal=>({ownerIds:[id],primaryOwnerId:id,userId:null,kind:'guest'});
try{
 for(const id of ids)await getDb().insert(cityOwners).values({id,guestTokenHash:randomUUID(),expiresAt:new Date(Date.now()+60000)});
 const source=await createScenario(p(ids[0]),{source:'example',clientMutationId:randomUUID(),title:'retention-owned-probe'});
 // Reproduce a snapshot fork created by the earlier release, with its cross-owner source pointer.
 const fork=await createScenario(p(ids[1]),{source:'blank',clientMutationId:randomUUID(),title:'retention-fork-probe'},{decisions:source.revision.decisions,constraints:source.revision.constraints,sourceRevisionId:source.revision.id,intent:'Published source attribution'});
 await getDb().delete(cityOwners).where(eq(cityOwners.id,ids[0]));
 const saved=await getScenario(p(ids[1]),fork.scenario.id);assert.equal(saved.revision.sourceRevisionId,null);assert.deepEqual(saved.revision.decisions,source.revision.decisions);assert.equal(saved.revision.intent,'Published source attribution');
 console.log('PASS actual foreign-key retention: deleting an expired source owner preserves an independently owned shared fork.');
}finally{for(const id of ids.toReversed())await getDb().delete(cityOwners).where(eq(cityOwners.id,id));await getSql().end();}

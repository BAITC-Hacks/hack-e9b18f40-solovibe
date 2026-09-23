import {z} from 'zod';
import {cityRoute,parseBody} from '@/server/city/http';
import {resolvePrincipal} from '@/server/city/owners';
import {getStress} from '@/server/city/stress';
import {getRevision} from '@/server/city/scenarios';
import {createSearch} from '@/server/city/searches';
export function POST(r:Request,{params}:{params:Promise<{id:string}>}){return cityRoute(async()=>{const input=await parseBody(r,z.object({clientRequestId:z.string().uuid()}).strict()),p=await resolvePrincipal({refresh:true}),s=await getStress(p,(await params).id),source=await getRevision(p,s.experiment.scenarioId,s.experiment.sourceRevisionId);return createSearch(p,{scenarioId:s.experiment.scenarioId,inputRevisionId:s.experiment.sourceRevisionId,constraints:source.revision.constraints,assumptions:s.experiment.assumption,stressId:s.experiment.id,limit:3,clientRequestId:input.clientRequestId});},202);}

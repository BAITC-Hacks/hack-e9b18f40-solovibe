import {cityRoute,parseBody} from '@/server/city/http';
import {resolvePrincipal} from '@/server/city/owners';
import {createStress,createStressSchema,getStress,listStress} from '@/server/city/stress';
export function POST(r:Request){return cityRoute(async()=>{const input=await parseBody(r,createStressSchema),p=await resolvePrincipal({refresh:true});return getStress(p,(await createStress(p,input)).id);});}
export function GET(r:Request){return cityRoute(async()=>listStress(await resolvePrincipal(),new URL(r.url).searchParams.get('scenarioId')??''));}

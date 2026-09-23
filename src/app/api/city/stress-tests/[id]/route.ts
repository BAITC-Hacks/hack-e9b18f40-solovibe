import {cityRoute} from '@/server/city/http';
import {resolvePrincipal} from '@/server/city/owners';
import {getStress} from '@/server/city/stress';
export function GET(_r:Request,{params}:{params:Promise<{id:string}>}){return cityRoute(async()=>getStress(await resolvePrincipal(),(await params).id));}

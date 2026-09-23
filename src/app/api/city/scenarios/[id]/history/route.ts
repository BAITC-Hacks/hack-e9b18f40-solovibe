import { cityRoute } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { listRevisions } from '@/server/city/revisions';
export function GET(r:Request,{params}:{params:Promise<{id:string}>}) {return cityRoute(async()=>listRevisions(await resolvePrincipal(),(await params).id,new URL(r.url).searchParams.get('cursor')));}

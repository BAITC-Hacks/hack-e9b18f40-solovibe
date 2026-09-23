import { z } from 'zod';
import { cityRoute,parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { cancelSearch } from '@/server/city/searches';
export function POST(r:Request,{params}:{params:Promise<{id:string}>}) {return cityRoute(async()=>{await parseBody(r,z.object({}).strict());return cancelSearch(await resolvePrincipal({refresh:true}),(await params).id);});}

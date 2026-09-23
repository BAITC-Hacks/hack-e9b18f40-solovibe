import { cityRoute,parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { renameRevision } from '@/server/city/revisions';
import { titleSchema } from '@/server/city/scenarios';
export function PATCH(r:Request,{params}:{params:Promise<{id:string;revisionId:string}>}) {return cityRoute(async()=>{const body=await parseBody(r,titleSchema),{id,revisionId}=await params;return renameRevision(await resolvePrincipal({refresh:true}),id,revisionId,body.title);});}

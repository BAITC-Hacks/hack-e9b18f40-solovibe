import {cityRoute,parseBody} from "@/server/city/http";
import {resolvePrincipal} from "@/server/city/owners";
import {forkSchema,forkScenario} from "@/server/city/scenarios";
export const runtime="nodejs";
export function POST(r:Request,c:{params:Promise<{id:string}>}) { return cityRoute(async()=> {const body=await parseBody(r,forkSchema);return forkScenario(await resolvePrincipal({refresh:true}),(await c.params).id,body);}); }

import {cityRoute} from "@/server/city/http";
import {resolvePrincipal} from "@/server/city/owners";
import {getRun} from "@/server/city/runs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(_:Request,c:{params:Promise<{id:string}>}) { return cityRoute(async()=>getRun(await resolvePrincipal(),(await c.params).id)); }

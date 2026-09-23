import {z} from "zod";
import {cityRoute,parseBody} from "@/server/city/http";
import {resolvePrincipal} from "@/server/city/owners";
import {cancelRun} from "@/server/city/runs";
export const runtime="nodejs";
export function POST(r:Request,c:{params:Promise<{id:string}>}) { return cityRoute(async()=>{await parseBody(r,z.object({}).strict());return cancelRun(await resolvePrincipal({refresh:true}),(await c.params).id);}); }

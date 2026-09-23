import { cityRoute, parseBody } from "@/server/city/http";
import { resolvePrincipal } from "@/server/city/owners";
import { getScenario, renameScenario, deleteScenario, titleSchema } from "@/server/city/scenarios";
import { z } from "zod";
type Context = {params:Promise<{id:string}>};
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(_:Request,c:Context) { return cityRoute(async () => getScenario(await resolvePrincipal({refresh:true}), (await c.params).id)); }
export function PATCH(r:Request,c:Context) { return cityRoute(async () => { const b=await parseBody(r,titleSchema); return renameScenario(await resolvePrincipal({refresh:true}),(await c.params).id,b.title); }); }
export function DELETE(r:Request,c:Context) { return cityRoute(async () => { await parseBody(r,z.object({}).strict()); return deleteScenario(await resolvePrincipal({refresh:true}),(await c.params).id); }); }

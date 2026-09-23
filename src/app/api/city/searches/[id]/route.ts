import { cityRoute } from "@/server/city/http";
import { resolvePrincipal } from "@/server/city/owners";
import { getSearch } from "@/server/city/searches";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(_:Request,c:{params:Promise<{id:string}>}) { return cityRoute(async()=>getSearch(await resolvePrincipal(),(await c.params).id)); }

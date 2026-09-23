import { cityRoute, parseBody } from "@/server/city/http";
import { resolvePrincipal } from "@/server/city/owners";
import { createSearchSchema } from "@/features/city/ai-contracts";
import { createSearch } from "@/server/city/searches";
export const runtime = "nodejs";
export function POST(r:Request) { return cityRoute(async()=>{const body=await parseBody(r,createSearchSchema);return createSearch(await resolvePrincipal({refresh:true}),body);},202); }

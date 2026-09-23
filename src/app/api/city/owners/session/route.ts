import { cityRoute } from "@/server/city/http";
import { resolvePrincipal } from "@/server/city/owners";
export const dynamic = "force-dynamic";
export function GET() { return cityRoute(async () => { const p=await resolvePrincipal({refresh:true}); return {kind:p.kind,hasSavedOwner:p.ownerIds.length>0}; }); }

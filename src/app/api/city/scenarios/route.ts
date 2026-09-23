import { cityRoute, parseBody } from "@/server/city/http";
import { resolvePrincipal } from "@/server/city/owners";
import { createScenario, createScenarioSchema, listScenarios } from "@/server/city/scenarios";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return cityRoute(async () => {
  const url = new URL(request.url);
  return listScenarios(await resolvePrincipal({refresh:true}), {cursor:url.searchParams.get("cursor") ?? undefined,q:url.searchParams.get("q") ?? undefined});
}); }
export function POST(request: Request) { return cityRoute(async () => {
  const body = await parseBody(request, createScenarioSchema);
  return createScenario(await resolvePrincipal({create:true,refresh:true}), body);
}); }

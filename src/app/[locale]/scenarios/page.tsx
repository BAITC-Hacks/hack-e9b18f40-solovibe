import { ScenarioLibrary } from "@/components/app/ScenarioLibrary";
import { resolvePrincipal } from "@/server/city/owners";
import { listScenarios } from "@/server/city/scenarios";
export const dynamic = "force-dynamic";
export default async function Page() {
  const principal = await resolvePrincipal();
  return <ScenarioLibrary key={`${principal.kind}:${principal.primaryOwnerId ?? "none"}`} initial={await listScenarios(principal, {})} />;
}

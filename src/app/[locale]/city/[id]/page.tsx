import { getTranslations } from "next-intl/server";
import { AppHeader } from "@/components/app/AppHeader";
import { Alert } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { resolvePrincipal } from "@/server/city/owners";
import { getScenario } from "@/server/city/scenarios";
import { CityError } from "@/server/city/errors";
import { ScenarioShell } from "@/features/city/components/ScenarioShell";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const t=await getTranslations();
  let view;
  try {view=await getScenario(await resolvePrincipal(),id);}
  catch(error) { const code=error instanceof CityError?error.code:"STORAGE_UNAVAILABLE";
    return <main className="page-shell"><AppHeader/><section className="surface mx-auto max-w-xl p-8"><h1 className="text-3xl">{t("app.notFoundTitle")}</h1><Alert tone="danger">{t(`errors.${code}`)}</Alert><Link href="/scenarios" className="mt-6 inline-block font-semibold text-accent">{t("app.goLibrary")}</Link></section></main>;
  }
  return <ScenarioShell key={`${view.principalKind}:${id}`} initial={view}/>;
}

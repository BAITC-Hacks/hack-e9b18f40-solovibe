import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/app/AppHeader";
import { StartActions } from "@/components/app/StartActions";
import { CitySculpture } from "@/components/brand";
import { AKIM_DATASET, EXAMPLE_DECISIONS } from "@/features/city/data/akim-v1";
import { evaluate, evaluateBaseline } from "@/features/city/engine";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; setRequestLocale(locale);
  const t = await getTranslations();
  const evaluation = evaluate(AKIM_DATASET, EXAMPLE_DECISIONS);
  const baseline = evaluateBaseline(AKIM_DATASET);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return <main className="page-shell"><AppHeader />
    <section className="grid items-center gap-8 py-8 lg:grid-cols-[1fr_1.05fr] lg:py-16">
      <div className="relative z-10 max-w-xl"><h1 className="mb-6 text-[clamp(38px,5vw,64px)]">{t("app.slogan")}</h1>
        <p className="mb-8 max-w-lg text-lg text-muted">{t("app.intro")}</p><StartActions />
        <p className="mt-5 text-sm text-muted">{t("app.modelNote")}</p>
      </div>
      <div className="relative min-w-0"><CitySculpture districtValues={evaluation.districts.map(d => d.score / 100)} selectedDistrictIndex={4} label={t("app.cityArtwork")} />
        <div className="surface relative mx-auto -mt-8 max-w-md p-6 sm:-mt-12">
          <h2 className="mb-4 text-xl">{t("app.exampleTitle")}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><span className="text-xs text-muted">{t("common.cost")}</span><strong className="number block text-2xl">{evaluation.cost}<span className="ml-1 text-sm font-normal">/100</span></strong></div>
            <div><span className="text-xs text-muted">{t("common.baseline")}</span><strong className="number block text-2xl text-muted">{number.format(baseline.score!)}</strong></div>
            <div><span className="text-xs text-muted">{t("common.after")}</span><strong className="number block text-2xl text-accent">{number.format(evaluation.score!)}</strong></div>
          </div><p className="mb-0 mt-4 text-sm text-muted">{t("app.exampleEffect")}</p>
        </div>
      </div>
    </section>
  </main>;
}

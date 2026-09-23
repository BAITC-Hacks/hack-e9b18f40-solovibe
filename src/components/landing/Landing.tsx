"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, FileText, Plus, RefreshCw } from "lucide-react";
import type { DistrictId, Evaluation } from "@/features/city/contracts";
import type { ScenarioView } from "@/features/city/records";
import { Link,useRouter } from "@/i18n/navigation";
import {AccountControl} from '@/components/app/AccountControl';
import { cityApi, errorCode } from "@/lib/city-api";
import { Alert, Button, LanguageSelector } from "@/components/ui";
import { Logo } from "@/components/brand";
import "./landing.css";

type ProofVariant = "best" | "two-districts";
type StartKind = ProofVariant | "example" | "blank";

export interface LandingProps {
  best: Evaluation;
  twoDistricts: Evaluation;
  deliveryProof?: ReactNode;
  demoVideo?:ReactNode;
  initialVariant?:ProofVariant;
}

const districtOrder: readonly DistrictId[] = ["yesil", "almaty", "saryarka", "baikonur", "nura"];

function decisionKey(decision: Evaluation["decisions"][number]) {
  return `${decision.measureId}:${decision.districtId ?? "city"}`;
}

function districtCounts(evaluation: Evaluation) {
  return Object.fromEntries(
    districtOrder.map((districtId) => [
      districtId,
      evaluation.decisions.filter((decision) => decision.districtId === districtId).length,
    ]),
  ) as Record<DistrictId, number>;
}

function CityTabletop({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations("landing");
  const tDistricts = useTranslations("districts");
  const counts = districtCounts(evaluation);
  const scores = Object.fromEntries(evaluation.districts.map((district) => [district.districtId, district.score])) as Record<
    DistrictId,
    number
  >;

  return (
    <div className="landing-tabletop-wrap">
      <svg
        className="landing-tabletop"
        viewBox="0 0 720 480"
        role="img"
        aria-label={t("tabletopLabel")}
      >
        <defs>
          <linearGradient id="landing-porcelain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".55" stopColor="#f5f8f6" />
            <stop offset="1" stopColor="#dce7e1" />
          </linearGradient>
          <linearGradient id="landing-enamel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2ba896" />
            <stop offset=".45" stopColor="#087f6f" />
            <stop offset="1" stopColor="#086054" />
          </linearGradient>
          <filter id="landing-shadow" x="-30%" y="-70%" width="160%" height="250%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
        </defs>
        <ellipse cx="364" cy="413" rx="294" ry="33" fill="#173e3924" filter="url(#landing-shadow)" />
        <path
          d="M72 282 438 166c18-6 36-4 51 4l166 92c13 7 12 18-4 23L263 427c-18 7-39 5-55-5L66 307c-11-8-8-19 6-25Z"
          fill="#b8cbc2"
        />
        <path
          d="M66 292v22c0 5 4 10 11 16l131 107c16 10 37 12 55 5l388-142c9-3 14-8 14-13v-18c-1 6-5 10-14 13L263 424c-18 7-39 5-55-5L66 307c-7-5-9-10-8-15Z"
          fill="#a6bdb3"
        />
        <path
          d="M72 269 438 153c18-6 36-4 51 4l166 92c13 7 12 18-4 23L263 414c-18 7-39 5-55-5L66 294c-11-8-8-19 6-25Z"
          fill="url(#landing-porcelain)"
          stroke="#fff"
          strokeWidth="3"
        />
        {districtOrder.map((districtId, index) => {
          const positions = [
            [160, 270],
            [281, 229],
            [395, 278],
            [475, 190],
            [560, 258],
          ] as const;
          const [x, y] = positions[index];
          const width = [102, 112, 96, 110, 90][index];
          const depth = 22;
          const active = counts[districtId] > 0;
          const height = 34 + Math.max(0, Math.min(100, scores[districtId] ?? 0)) * 0.72;
          const top = y - height;
          return (
            <g key={districtId} className={active ? "landing-district is-active" : "landing-district"}>
              <path
                d={`M${x},${top} ${x + depth},${top - 13} ${x + width + depth},${top - 13} ${x + width},${top}Z`}
                fill={active ? "#38aa99" : "#fff"}
                stroke={active ? "#087f6f" : "#cad9d2"}
                strokeWidth="2"
              />
              <path
                d={`M${x + width},${top} ${x + width + depth},${top - 13} ${x + width + depth},${y - 13} ${x + width},${y}Z`}
                fill={active ? "#075f54" : "#a9beb5"}
                stroke={active ? "#087f6f" : "#cad9d2"}
                strokeWidth="2"
              />
              <path
                d={`M${x},${top} ${x + width},${top} ${x + width},${y} ${x},${y}Z`}
                fill={active ? "url(#landing-enamel)" : "url(#landing-porcelain)"}
                stroke={active ? "#087f6f" : "#cad9d2"}
                strokeWidth="2"
              />
              <path d={`M${x + 10},${top + 11}V${y - 12}`} stroke="#ffffffa8" strokeWidth="4" strokeLinecap="round" />
              {active ? (
                <g transform={`translate(${x + width / 2},${top - 3})`}>
                  <circle r="18" fill="#fbfdfb" stroke="#087f6f" strokeWidth="2" />
                  <text y="5" textAnchor="middle" fill="#183c39" fontSize="15" fontWeight="650">
                    {counts[districtId]}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="landing-district-key" aria-label={t("allocationLabel")}>
        {districtOrder.map((districtId) => (
          <div key={districtId} className={counts[districtId] ? "landing-district-key__item is-active" : "landing-district-key__item"}>
            <span>{tDistricts(districtId)}</span>
            <strong>{t("directCount", { count: counts[districtId] })}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing({ best, twoDistricts, deliveryProof,demoVideo,initialVariant='two-districts' }: LandingProps) {
  const locale = useLocale();
  const t = useTranslations("landing");
  const tMeasures = useTranslations("measures");
  const tDistricts = useTranslations("districts");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [variant, setVariant] = useState<ProofVariant>(initialVariant);
  const [pending, setPending] = useState<StartKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedKind, setFailedKind] = useState<StartKind | null>(null);
  const attempts = useRef<Partial<Record<StartKind, string>>>({});
  const current = variant === "two-districts" ? twoDistricts : best;
  const format = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale],
  );
  const compactFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  const bestKeys = new Set(best.decisions.map(decisionKey));
  const currentKeys = new Set(current.decisions.map(decisionKey));
  const removed = best.decisions.filter((decision) => !currentKeys.has(decisionKey(decision)));
  const rows = current.decisions.map((decision) => ({
    decision,
    retained: bestKeys.has(decisionKey(decision)),
  }));
  const retainedCount = rows.filter((row) => row.retained).length;
  const changedCount = rows.length - retainedCount;
  let replacedIndex = 0;
  const scorePrice = Math.abs((best.score ?? 0) - (twoDistricts.score ?? 0));

  async function start(kind: StartKind) {
    if (pending) return;
    setPending(kind);
    setError(null);
    setFailedKind(null);
    attempts.current[kind] ??= crypto.randomUUID();
    try {
      const proof = kind === "best" || kind === "two-districts";
      const body = proof
        ? { source: "proof", proofVariant: kind, clientMutationId: attempts.current[kind] }
        : {
            source: kind,
            clientMutationId: attempts.current[kind],
            title: t(kind === "example" ? "exampleTitle" : "blankTitle"),
          };
      const view = await cityApi<ScenarioView>("/scenarios", { method: "POST", body });
      router.push(`/city/${view.scenario.id}`);
    } catch (cause) {
      setError(errorCode(cause));
      setFailedKind(kind);
      setPending(null);
    }
  }

  return (
    <main className="landing-root">
      <header className="landing-header">
        <Logo />
        <nav className="landing-navigation" aria-label={t('navigation')}><Link href="/scenarios">{t('myScenarios')}</Link><AccountControl returnTo={`/?variant=${variant}`}/><LanguageSelector label={tCommon("language")} /></nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <h1 id="landing-title">{t("title")}</h1>
          <p className="landing-hero__intro">{t("intro")}</p>
          <div className="landing-condition">
            <div>
              <strong>{t("conditionTitle")}</strong>
              <span>{variant === "two-districts" ? t("conditionOn") : t("conditionOff")}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={variant === "two-districts"}
              aria-label={t("conditionToggle")}
              className="landing-switch"
              onClick={() => {const next=variant==='best'?'two-districts':'best';setVariant(next);const url=new URL(window.location.href);url.searchParams.set('variant',next);window.history.replaceState(window.history.state,'',url);}}
            >
              <span />
            </button>
          </div>

          <div className="landing-proof-line" aria-live="polite">
            <div><span>{t("budget")}</span><p>{variant === "two-districts" ? <><s>{compactFormat.format(best.cost)}</s><ArrowRight aria-hidden="true" /></> : null}<strong>{compactFormat.format(current.cost)}</strong> <small>{tCommon("units")}</small></p></div>
            <div><span>{t("score")}</span><p>{variant === "two-districts" && best.score !== null ? <><s>{format.format(best.score)}</s><ArrowRight aria-hidden="true" /></> : null}<strong>{current.score === null ? t("notAvailable") : format.format(current.score)}</strong></p></div>
            <p className="landing-price">{variant === "two-districts" ? t("conditionPrice", { value: format.format(scorePrice) }) : t("conditionPriceOff")}</p>
          </div>
          <p className="landing-model-note">{t("modelNote")}</p>

          <div className="landing-actions">
            <Button
              onClick={() => start(variant)}
              loading={pending === variant}
              loadingLabel={t("starting")}
              disabled={pending !== null}
            >
              {t("primaryAction")} <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <details className="landing-other-starts"><summary>{t("otherStarts")}</summary><div className="landing-actions__secondary"><button type="button" onClick={() => start("example")} disabled={pending !== null}><FileText size={17} aria-hidden="true" /> {t("exampleAction")}</button><button type="button" onClick={() => start("blank")} disabled={pending !== null}><Plus size={17} aria-hidden="true" /> {t("blankAction")}</button></div></details>
          </div>
          {error ? (
            <Alert tone="danger" className="landing-error" title={t("startFailed")}>
              <p>{tErrors(error)}</p>
              <button type="button" onClick={() => start(failedKind ?? variant)}>
                <RefreshCw size={15} aria-hidden="true" /> {tCommon("retry")}
              </button>
            </Alert>
          ) : null}
        </div>

        <div className="landing-hero__proof">
          <CityTabletop evaluation={current} />
        </div>
      </section>

      <section className="landing-how" id="how-it-works" aria-labelledby="landing-comparison-title">
        <div><h2 id="landing-comparison-title">{t("comparisonTitle", { count: changedCount })}</h2><p>{t("comparisonIntro", { retained: retainedCount, changed: changedCount })}</p></div>
        <details className="landing-decision-details">
          <summary>{t("decisionDetails", { retained: retainedCount, changed: changedCount })}</summary>
          <div className="landing-decision-list">
            {rows.map(({ decision, retained }) => {
              const replaced = retained ? null : removed[replacedIndex++];
              return <article key={decisionKey(decision)} className={retained ? "landing-decision is-retained" : "landing-decision is-changed"}><span className="landing-decision__icon" aria-hidden="true">{retained ? <Check size={17} /> : <ArrowRight size={17} />}</span><div><strong>{tMeasures(decision.measureId)}</strong><span>{decision.districtId ? tDistricts(decision.districtId) : tCommon("city")}</span>{replaced ? <small>{t("insteadOf", { measure: tMeasures(replaced.measureId), district: replaced.districtId ? tDistricts(replaced.districtId) : tCommon("city") })}</small> : null}</div><em>{t(retained ? "retained" : "changed")}</em></article>;
            })}
          </div>
        </details>
      </section>

      <section className="landing-example" id="decision-example" aria-labelledby="landing-outcome-title">
        <div className="landing-example__copy"><h2 id="landing-outcome-title">{t("outcomeTitle")}</h2><p>{t("outcomeIntro")}</p><ol><li>{t("outcomeCompare")}</li><li>{t("outcomeEdit")}</li><li>{t("outcomeDeliver")}</li></ol></div>
        <div className="landing-brief">{deliveryProof ?? <><div className="landing-brief__header"><FileText size={21} aria-hidden="true" /><strong>{t("briefTitle")}</strong></div><p>{t("briefFinding", { districts: current.directDistrictIds.length })}</p><p><strong>{t("briefBudgetValue", { value: compactFormat.format(current.cost) })}</strong>, {current.score === null ? t("notAvailable") : format.format(current.score)}</p></>}</div>
      </section>
      {demoVideo}
    </main>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Columns3, List, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import type { BriefSection, BriefView } from "../contracts";
import { BriefStatus, DecisionTable, ResultSummary, SectionArticle, SourceStamp, sectionOrder } from "./BriefDocument";
import "../brief.css";

type Slide = { id: string; title: string; content: ReactNode };

export interface BriefPresentationProps {
  initial: BriefView;
}

function ComparisonPanel({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const source = view.source.evaluation.result;
  if (!view.comparisons.length) return <p className="cbb-empty-note">{t("noComparisons")}</p>;
  return (
    <div className="cbb-comparisons">
      <div className="is-selected">
        <span>{t("selectedPlan")}</span>
        <strong>{source.score === null ? t("notAvailable") : number.format(source.score)}</strong>
        <small>{t("budgetValue", { value: source.cost })}</small>
      </div>
      {view.comparisons.map((snapshot, index) => (
        <div key={snapshot.revision.id}>
          <span>{snapshot.revision.title || t("alternative", { number: index + 1 })}</span>
          <strong>{snapshot.evaluation.result.score === null ? t("notAvailable") : number.format(snapshot.evaluation.result.score)}</strong>
          <small>{t("budgetValue", { value: snapshot.evaluation.result.cost })}</small>
        </div>
      ))}
    </div>
  );
}

function StressPanel({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const tMeasures = useTranslations("measures");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!view.stress) return <p className="cbb-empty-note">{t("noStress")}</p>;
  const { assumption, baseline, stressed } = view.stress.experiment;
  return (
    <div className="cbb-stress-panel">
      <p>{t("stressAssumption", {
        measure: tMeasures(assumption.measureId),
        cost: assumption.costIncreasePct,
        lag: assumption.extraLagQuarters,
      })}</p>
      <dl>
        <div><dt>{t("beforeStress")}</dt><dd>{baseline.score === null ? t("notAvailable") : number.format(baseline.score)}</dd></div>
        <div><dt>{t("afterStress")}</dt><dd>{stressed.score === null ? t("notAvailable") : number.format(stressed.score)}</dd></div>
        <div><dt>{t("stressedCost")}</dt><dd>{t("unitsValue", { value: stressed.cost })}</dd></div>
        {view.stress.selectedEvaluation&&<div><dt>{t('selectedStress')}</dt><dd>{view.stress.selectedEvaluation.score===null?t('notAvailable'):number.format(view.stress.selectedEvaluation.score)} / {t('unitsValue',{value:view.stress.selectedEvaluation.cost})}</dd></div>}
      </dl>
    </div>
  );
}

function groupedSections(view: BriefView, ids: BriefSection["id"][]) {
  return ids.map((id) => view.brief.sections.find((section) => section.id === id)).filter((item): item is BriefSection => Boolean(item));
}

export function BriefPresentation({ initial }: BriefPresentationProps) {
  const t = useTranslations("brief");
  const [mode, setMode] = useState<"slides" | "all">("slides");
  const [index, setIndex] = useState(0);
  const sections = Object.fromEntries(initial.brief.sections.map((section) => [section.id, section])) as Partial<Record<BriefSection["id"], BriefSection>>;

  const slides: Slide[] = [
    {
      id: "opening",
      title: initial.brief.title,
      content: (
        <div className="cbb-opening-slide">
          {sections.goal ? <SectionArticle section={sections.goal} view={initial} /> : null}
          <ResultSummary view={initial} />
        </div>
      ),
    },
    { id: "decisions", title: t("slideDecisions"), content: <DecisionTable view={initial} /> },
    { id: "districts", title: t("slideDistricts"), content: <ResultSummary view={initial} /> },
    {
      id: "benefits",
      title: t("slideConsequences"),
      content: <div className="cbb-slide-sections">{groupedSections(initial, ["benefits", "tradeoffs", "risks"]).map((section) => <SectionArticle key={section.id} section={section} view={initial} />)}</div>,
    },
    {
      id: "sensitivity",
      title: t("slideSensitivity"),
      content: <div className="cbb-slide-sections"><StressPanel view={initial} />{sections.assumptions ? <SectionArticle section={sections.assumptions} view={initial} /> : null}</div>,
    },
    {
      id: "comparison",
      title: t("slideComparison"),
      content: <div className="cbb-slide-sections"><ComparisonPanel view={initial} />{sections.rationale ? <SectionArticle section={sections.rationale} view={initial} /> : null}</div>,
    },
    {
      id: "limits",
      title: t("slideLimits"),
      content: <div className="cbb-slide-sections">{sections.limits ? <SectionArticle section={sections.limits} view={initial} /> : null}<SourceStamp view={initial} /></div>,
    },
  ];

  useEffect(() => {
    if (mode !== "slides") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setIndex((current) => Math.min(slides.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(slides.length - 1);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, slides.length]);

  return (
    <main className={`cbb-presentation cbb-presentation--${mode}`}>
      <header className="cbb-presentation__toolbar">
        <div><BriefStatus view={initial} /><span>{t("presentationVersion", { version: initial.brief.version })}</span></div>
        <div>
          <Button variant={mode === "slides" ? "secondary" : "quiet"} size="compact" onClick={() => setMode("slides")}>
            <Columns3 size={17} aria-hidden="true" />{t("slidesMode")}
          </Button>
          <Button variant={mode === "all" ? "secondary" : "quiet"} size="compact" onClick={() => setMode("all")}>
            <List size={17} aria-hidden="true" />{t("allMode")}
          </Button>
          <Button variant="secondary" size="compact" onClick={() => window.print()}>
            <Printer size={17} aria-hidden="true" />{t("print")}
          </Button>
        </div>
      </header>

      {mode === "slides" ? (
        <section className="cbb-stage" aria-live="polite" aria-label={t("slidePosition", { current: index + 1, total: slides.length })}>
          <article className="cbb-slide" key={slides[index].id}>
            <header><span>{t("slidePosition", { current: index + 1, total: slides.length })}</span><h1>{slides[index].title}</h1></header>
            <div className="cbb-slide__content">{slides[index].content}</div>
          </article>
          <nav className="cbb-slide-nav" aria-label={t("slideNavigation")}>
            <Button variant="secondary" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>
              <ChevronLeft size={19} aria-hidden="true" />{t("previous")}
            </Button>
            <div>{slides.map((slide, slideIndex) => <button key={slide.id} type="button" className={slideIndex === index ? "is-current" : ""} onClick={() => setIndex(slideIndex)} aria-label={t("goToSlide", { number: slideIndex + 1 })} aria-current={slideIndex === index ? "step" : undefined} />)}</div>
            <Button onClick={() => setIndex((current) => Math.min(slides.length - 1, current + 1))} disabled={index === slides.length - 1}>
              {t("next")}<ChevronRight size={19} aria-hidden="true" />
            </Button>
          </nav>
        </section>
      ) : (
        <article className="cbb-readable-document">
          <header><h1>{initial.brief.title}</h1><SourceStamp view={initial} /></header>
          <ResultSummary view={initial} />
          <section><h2>{t("slideDecisions")}</h2><DecisionTable view={initial} /></section>
          {sectionOrder.map((id) => sections[id] ? <SectionArticle key={id} section={sections[id]!} view={initial} /> : null)}
          <section><h2>{t("slideSensitivity")}</h2><StressPanel view={initial} /></section>
          <section><h2>{t("slideComparison")}</h2><ComparisonPanel view={initial} /></section>
        </article>
      )}
    </main>
  );
}

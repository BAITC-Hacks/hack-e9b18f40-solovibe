"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, CircleUserRound, Database, Link2 } from "lucide-react";
import { AKIM_DATASET } from "../../data/akim-v1";
import type { EvidenceLink } from "../../ai-contracts";
import type { EvaluationRecord } from "../../records";
import type { BriefSection, BriefView } from "../contracts";

export const sectionOrder: readonly BriefSection["id"][] = [
  "goal",
  "benefits",
  "tradeoffs",
  "risks",
  "assumptions",
  "rationale",
  "limits",
];

export function shortId(value: string) {
  return value.slice(0, 8);
}

export function evaluationRecords(view: BriefView): EvaluationRecord[] {
  return [view.source.evaluation, ...view.comparisons.map((item) => item.evaluation),...(view.stress?[{id:`stress:${view.stress.experiment.id}:baseline`,revisionId:view.stress.experiment.sourceRevisionId,result:view.stress.experiment.baseline},{id:`stress:${view.stress.experiment.id}:stressed`,revisionId:view.stress.experiment.sourceRevisionId,result:view.stress.experiment.stressed},...(view.stress.selectedEvaluation?[{id:`stress:${view.stress.experiment.id}:selected`,revisionId:view.brief.sourceRevisionId,result:view.stress.selectedEvaluation}]:[])]:[])];
}

function resolveEvidence(view: BriefView, ref: EvidenceLink) {
  const evaluation = evaluationRecords(view).find((item) => item.id === ref.evaluationId);
  const evidence = evaluation?.result.evidence.find((item) => item.id === ref.evidenceId);
  return { evaluation, evidence };
}

export function BriefStatus({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const stale = view.stale || view.brief.status === "needs_review";
  return (
    <span className={`cbb-status cbb-status--${stale ? "review" : view.brief.status}`}>
      {stale ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      {t(stale ? "statusNeedsReview" : view.brief.status === "pending" ? "statusPending" : "statusReady")}
    </span>
  );
}

export function SourceStamp({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const locale = useLocale();
  return (
    <div className="cbb-source-stamp">
      <Database aria-hidden="true" />
      <div>
        <strong>{t("sourceVersion", { version: view.brief.version })}</strong>
        <span className="cbb-source-id">{t("sourceRevision", { id: view.brief.sourceRevisionId })}</span>
        <span className="cbb-source-id">{t("sourceHash", { id: view.brief.sourceHash })}</span>
        <span>{t("rulesEvaluator", {
          rules: view.source.evaluation.result.rulesVersion,
          evaluator: view.source.evaluation.result.evaluatorVersion,
        })}</span>
        <time dateTime={view.brief.updatedAt}>
          {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(view.brief.updatedAt))}
        </time>
      </div>
    </div>
  );
}

export function EvidenceRefs({ refs, view }: { refs: EvidenceLink[]; view: BriefView }) {
  const t = useTranslations("brief");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (!refs.length) return null;
  return (
    <details className="cbb-evidence">
      <summary>
        <Link2 aria-hidden="true" /> {t("evidence", { count: refs.length })}
      </summary>
      <ul>
        {refs.map((ref) => {
          const { evaluation, evidence } = resolveEvidence(view, ref);
          return (
            <li key={`${ref.evaluationId}:${ref.evidenceId}`}>
              <span>{evaluation ? t("evidenceResolved") : t("evidenceUnavailable")}</span>
              <code title={`${ref.evaluationId} / ${ref.evidenceId}`}>{shortId(ref.evaluationId)} / {shortId(ref.evidenceId)}</code>
              {evidence ? <strong>{number.format(evidence.value)}</strong> : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function DecisionTable({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const tMeasures = useTranslations("measures");
  const tDistricts = useTranslations("districts");
  const tCommon = useTranslations("common");
  const source = view.source.evaluation.result;
  return (
    <div className="cbb-table-wrap">
      <table className="cbb-decision-table">
        <thead>
          <tr>
            <th>{t("measure")}</th>
            <th>{t("target")}</th>
            <th>{t("cost")}</th>
            <th>{t("lag")}</th>
          </tr>
        </thead>
        <tbody>
          {source.decisions.map((decision) => {
            const measure = AKIM_DATASET.measures.find((item) => item.id === decision.measureId);
            return (
              <tr key={`${decision.measureId}:${decision.districtId ?? "city"}`}>
                <td>{tMeasures(decision.measureId)}</td>
                <td>{decision.districtId ? tDistricts(decision.districtId) : tCommon("city")}</td>
                <td className="cbb-number">{measure ? t("unitsValue", { value: measure.cost }) : t("notAvailable")}</td>
                <td className="cbb-number">{measure ? t("quartersValue", { value: measure.lag }) : t("notAvailable")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResultSummary({ view }: { view: BriefView }) {
  const t = useTranslations("brief");
  const tDistricts = useTranslations("districts");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const result = view.source.evaluation.result;
  return (
    <div className="cbb-results">
      <dl className="cbb-result-totals">
        <div><dt>{t("budgetUsed")}</dt><dd>{compact.format(result.cost)} / {AKIM_DATASET.budget}</dd></div>
        <div><dt>{t("cityScore")}</dt><dd>{result.score === null ? t("notAvailable") : number.format(result.score)}</dd></div>
        <div><dt>{t("criticalCount")}</dt><dd>{result.criticalPairs.length}</dd></div>
      </dl>
      <div className="cbb-district-results">
        {result.districts.map((district) => (
          <div key={district.districtId}>
            <span>{tDistricts(district.districtId)}</span>
            <strong>{number.format(district.score)}</strong>
            <small>{t("criticalInDistrict", { count: result.criticalPairs.filter((item) => item.districtId === district.districtId).length })}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionArticle({ section, view }: { section: BriefSection; view: BriefView }) {
  const t = useTranslations("brief");
  return (
    <article className={`cbb-section ${section.stale ? "is-stale" : ""}`} id={`brief-${section.id}`}>
      <header>
        <h2>{t(`section_${section.id}`)}</h2>
        <span className={section.userEdited ? "cbb-origin cbb-origin--user" : "cbb-origin"}>
          {section.userEdited ? <CircleUserRound aria-hidden="true" /> : <Database aria-hidden="true" />}
          {t(section.userEdited ? "userEdited" : "generated")}
        </span>
      </header>
      {section.stale ? <p className="cbb-stale-note"><AlertTriangle aria-hidden="true" />{t("stalePremise")}</p> : null}
      <p className="cbb-section__text">{section.text}</p>
      <EvidenceRefs refs={section.refs} view={view} />
    </article>
  );
}

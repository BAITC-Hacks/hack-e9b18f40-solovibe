"use client";

import { ArrowDownRight, ArrowUpRight, Check, MapPin, Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { RunView } from "../ai-contracts";
import type { Decision, Evaluation } from "../contracts";
import type { EvaluationRecord, RevisionRecord } from "../records";
import { Button, cn } from "@/components/ui";

function decisionKey(decision: Decision) {
  return `${decision.measureId}:${decision.districtId ?? "city"}`;
}

export interface AlternativeCardProps {
  source: RunView["source"];
  alternative: { revision: RevisionRecord; evaluation: EvaluationRecord };
  index: number;
  stale?: boolean;
  applying?: boolean;
  applied?: boolean;
  onApply: (revisionId: string) => void;
}

function MetricDelta({ value, source, neutral = false }: { value: number; source: number; neutral?: boolean }) {
  const locale = useLocale();
  const delta = value - source;
  if (Math.abs(delta) < 0.005) return <span className="cba-delta-neutral"><Minus aria-hidden="true" />0</span>;
  return (
    <span className={cn(neutral ? "cba-delta-neutral" : delta > 0 ? "cba-delta-positive" : "cba-delta-negative")}>
      {delta > 0 ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}
      {delta > 0 ? "+" : ""}{new Intl.NumberFormat(locale, {maximumFractionDigits:2}).format(delta)}
    </span>
  );
}

function DecisionList({ decisions, mode }: { decisions: Decision[]; mode: "added" | "removed" | "unchanged" }) {
  const tMeasures = useTranslations("measures");
  const tDistricts = useTranslations("districts");
  const tCommon = useTranslations("common");
  if (!decisions.length) return null;
  return (
    <ul className={`cba-decision-list cba-decision-${mode}`}>
      {decisions.map((decision) => (
        <li key={decisionKey(decision)}>
          {mode === "added" ? <Plus aria-hidden="true" /> : mode === "removed" ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
          <span>{tMeasures(decision.measureId)}</span>
          <small><MapPin aria-hidden="true" />{decision.districtId ? tDistricts(decision.districtId) : tCommon("city")}</small>
        </li>
      ))}
    </ul>
  );
}

export function AlternativeCard({ source, alternative, index, stale = false, applying = false, applied = false, onApply }: AlternativeCardProps) {
  const locale = useLocale();
  const t = useTranslations("assistant");
  const tCommon = useTranslations("common");
  const sourceKeys = new Set(source.revision.decisions.map(decisionKey));
  const alternativeKeys = new Set(alternative.revision.decisions.map(decisionKey));
  const added = alternative.revision.decisions.filter((decision) => !sourceKeys.has(decisionKey(decision)));
  const removed = source.revision.decisions.filter((decision) => !alternativeKeys.has(decisionKey(decision)));
  const unchanged = alternative.revision.decisions.filter((decision) => sourceKeys.has(decisionKey(decision)));
  const result = alternative.evaluation.result;
  const sourceResult: Evaluation = source.evaluation.result;

  return (
    <article className={cn("cba-alternative", applied && "cba-alternative-applied")} aria-label={`${t("alternative")} ${index + 1}`}>
      <div className="cba-alternative-heading">
        <div>
          <h4>{alternative.revision.title || t("alternative")}</h4>
        </div>
        {applied ? <span className="cba-applied-label"><Check aria-hidden="true" />{t("applied")}</span> : null}
      </div>

      <div className="cba-alternative-metrics">
        <div>
          <span>{t("score")}</span>
          <strong>{result.score === null ? t("notAvailable") : new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(result.score)}</strong>
          {result.score !== null && sourceResult.score !== null ? <MetricDelta value={result.score} source={sourceResult.score} /> : null}
        </div>
        <div>
          <span>{tCommon("cost")}</span>
          <strong>{result.cost} {tCommon("units")}</strong>
          <MetricDelta value={result.cost} source={sourceResult.cost} neutral />
        </div>
      </div>

      <div className="cba-change-group">
        {added.length || removed.length ? <h5>{t("changed")}</h5> : null}
        <DecisionList decisions={removed} mode="removed" />
        <DecisionList decisions={added} mode="added" />
        {unchanged.length ? <h5>{t("unchanged")}</h5> : null}
        <DecisionList decisions={unchanged} mode="unchanged" />
      </div>

      {stale ? <p className="cba-stale">{t("stale")}</p> : null}
      <Button className="cba-apply-button" onClick={() => onApply(alternative.revision.id)} loading={applying} loadingLabel={t("applying")} disabled={applied}>
        {applied ? t("applied") : t("apply")}
      </Button>
    </article>
  );
}

export default AlternativeCard;

"use client";

import { ArrowDownRight, ArrowUpRight, Building2, Plus, Replace } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Decision, DistrictId, DomainIssue, Measure } from "../contracts";
import { AKIM_DATASET } from "../data/akim-v1";
import { cn } from "@/components/ui";

export type ChooseResult = "accepted" | "invalid" | "need-replacement";

export interface CatalogueProps {
  decisions: readonly Decision[];
  replacementSlot: number | null;
  attemptIssues: readonly DomainIssue[];
  formatIssue: (issue: DomainIssue) => string;
  onChoose: (decision: Decision) => ChooseResult;
  onNeedReplacement: () => void;
}

function defaultTarget(measure: Measure): DistrictId | null {
  return measure.scope === "city" ? null : AKIM_DATASET.districts[0].id;
}

export function Catalogue({ decisions, replacementSlot, attemptIssues, formatIssue, onChoose, onNeedReplacement }: CatalogueProps) {
  const tMeasures = useTranslations("measures");
  const tDirections = useTranslations("directions");
  const tDistricts = useTranslations("districts");
  const tIndicators = useTranslations("indicators");
  const tCommon = useTranslations("common");
  const tBoard = useTranslations("board");
  const [targets, setTargets] = useState<Partial<Record<Measure["id"], DistrictId>>>({});
  const [direction, setDirection] = useState<Measure["direction"] | "all">("all");
  const [attemptedMeasureId, setAttemptedMeasureId] = useState<Measure["id"] | null>(null);
  const [attemptResult, setAttemptResult] = useState<ChooseResult | null>(null);
  const errorRefs = useRef(new Map<Measure["id"], HTMLDivElement>());
  const selectedIds = new Set(decisions.map((decision, index) => index === replacementSlot ? null : decision.measureId));
  const measures = direction === "all" ? AKIM_DATASET.measures : AKIM_DATASET.measures.filter((measure) => measure.direction === direction);

  function choose(measure: Measure) {
    if (decisions.length === 5 && replacementSlot === null) {
      onNeedReplacement();
      setAttemptedMeasureId(measure.id);
      setAttemptResult("need-replacement");
      return;
    }
    const result = onChoose({ measureId: measure.id, districtId: measure.scope === "city" ? null : (targets[measure.id] ?? defaultTarget(measure)) });
    setAttemptedMeasureId(result === "accepted" ? null : measure.id);
    setAttemptResult(result);
  }

  useEffect(() => {
    if (!attemptedMeasureId || attemptResult === "accepted") return;
    if (attemptResult === "invalid" && !attemptIssues.length) return;
    const frame = requestAnimationFrame(() => errorRefs.current.get(attemptedMeasureId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [attemptIssues, attemptResult, attemptedMeasureId]);

  const replacementDecision = replacementSlot === null ? null : decisions[replacementSlot];

  return (
    <section className="cb-panel cb-catalogue" aria-labelledby="catalogue-title">
      <div className="cb-section-heading">
        <div>
          <h2 id="catalogue-title" tabIndex={-1}>{tBoard("catalogue")}</h2>
          <p>{tBoard("catalogueDescription")}</p>
        </div>
      </div>

      <p className="cb-selection-guide">{tBoard("selectionGuide")}</p>
      {replacementDecision && replacementSlot !== null ? (
        <div className="cb-replacement-notice" role="status">
          <Replace className="size-4" aria-hidden="true" />
          {tBoard("replacementNotice", { slot: replacementSlot + 1, measure: tMeasures(replacementDecision.measureId) })}
        </div>
      ) : null}

      <div className="cb-direction-filters" role="group" aria-label={tCommon("directions")}>
        <button type="button" aria-pressed={direction === "all"} onClick={() => setDirection("all")}>{tCommon("directions")}</button>
        {(["transport", "ecology", "social", "safety", "services"] as const).map((item) => (
          <button key={item} type="button" aria-pressed={direction === item} onClick={() => setDirection(item)}>
            {tDirections(item)}
          </button>
        ))}
      </div>

      <div className="cb-catalogue-grid">
        {measures.map((measure) => {
          const alreadySelected = selectedIds.has(measure.id);
          const replacing = replacementSlot !== null;
          return (
            <article key={measure.id} className={cn("cb-measure-card", alreadySelected && "cb-measure-card-disabled")}>
              <div className="cb-measure-topline">
                <span className={`cb-direction cb-direction-${measure.direction}`}>{tDirections(measure.direction)}</span>
                <span>{measure.cost} {tCommon("units")}</span>
              </div>
              <h3>{tMeasures(measure.id)}</h3>
              <p className="cb-lag">{tCommon("lag")}: {measure.lag} {tCommon("quarters")}</p>

              {measure.scope === "district" ? (
                <label className="cb-target-select">
                  <span>{tCommon("district")}</span>
                  <select
                    value={targets[measure.id] ?? defaultTarget(measure) ?? ""}
                    onChange={(event) => setTargets((current) => ({ ...current, [measure.id]: event.target.value as DistrictId }))}
                    disabled={alreadySelected}
                  >
                    {AKIM_DATASET.districts.map((district) => (
                      <option key={district.id} value={district.id}>{tDistricts(district.id)}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="cb-city-scope"><Building2 className="size-4" aria-hidden="true" />{tBoard("appliesToCity")}</p>
              )}

              <div className="cb-effects" aria-label={tBoard("effects")}>
                {Object.entries(measure.effects).map(([indicatorId, amount]) => (
                  <span key={indicatorId} className={cn("cb-effect", Number(amount) < 0 && "cb-effect-negative")}>
                    {Number(amount) < 0 ? <ArrowDownRight aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                    {tIndicators(indicatorId)} {Number(amount) > 0 ? "+" : ""}{amount}
                  </span>
                ))}
              </div>

              <button type="button" className="cb-add-button" disabled={alreadySelected} onClick={() => choose(measure)}>
                {replacing ? <Replace className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {replacing ? tBoard("replace") : tBoard("add")}
              </button>
              {attemptedMeasureId === measure.id && attemptResult && attemptResult !== "accepted"
                && !(attemptResult === "need-replacement" && replacementSlot !== null) ? (
                <div
                  ref={(node) => {
                    if (node) errorRefs.current.set(measure.id, node);
                    else errorRefs.current.delete(measure.id);
                  }}
                  className="cb-card-error"
                  role="alert"
                  tabIndex={-1}
                >
                  <strong>{tBoard("attemptRejectedTitle")}</strong>
                  {attemptResult === "need-replacement" ? (
                    <p>{tBoard("selectReplacementFirst")}</p>
                  ) : (
                    <ul>{attemptIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{formatIssue(issue)}</li>)}</ul>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

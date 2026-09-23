"use client";

import { ArrowDownRight, ArrowUpRight, Building2, Plus, Replace } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Decision, DistrictId, Measure } from "../contracts";
import { AKIM_DATASET } from "../data/akim-v1";
import { cn } from "@/components/ui";

export interface CatalogueProps {
  decisions: readonly Decision[];
  replacementSlot: number | null;
  onChoose: (decision: Decision) => void;
  onNeedReplacement: () => void;
}

function defaultTarget(measure: Measure): DistrictId | null {
  return measure.scope === "city" ? null : AKIM_DATASET.districts[0].id;
}

export function Catalogue({ decisions, replacementSlot, onChoose, onNeedReplacement }: CatalogueProps) {
  const tMeasures = useTranslations("measures");
  const tDirections = useTranslations("directions");
  const tDistricts = useTranslations("districts");
  const tIndicators = useTranslations("indicators");
  const tCommon = useTranslations("common");
  const tBoard = useTranslations("board");
  const [targets, setTargets] = useState<Partial<Record<Measure["id"], DistrictId>>>({});
  const [direction, setDirection] = useState<Measure["direction"] | "all">("all");
  const selectedIds = new Set(decisions.map((decision, index) => index === replacementSlot ? null : decision.measureId));
  const measures = direction === "all" ? AKIM_DATASET.measures : AKIM_DATASET.measures.filter((measure) => measure.direction === direction);

  function choose(measure: Measure) {
    if (decisions.length === 5 && replacementSlot === null) {
      onNeedReplacement();
      return;
    }
    onChoose({ measureId: measure.id, districtId: measure.scope === "city" ? null : (targets[measure.id] ?? defaultTarget(measure)) });
  }

  return (
    <section className="cb-panel cb-catalogue" aria-labelledby="catalogue-title">
      <div className="cb-section-heading">
        <div>
          <h2 id="catalogue-title">{tBoard("catalogue")}</h2>
          <p>{tBoard("catalogueDescription")}</p>
        </div>
      </div>

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
          const replacing = decisions.length === 5 && replacementSlot !== null;
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
            </article>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { ArrowRight, Building2, CircleAlert, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Decision, DistrictId, Evaluation } from "../contracts";
import { AKIM_DATASET } from "../data/akim-v1";
import { CitySculpture } from "@/components/brand";
import { cn } from "@/components/ui";

export interface CityBoardProps {
  evaluation: Evaluation;
  decisions: readonly Decision[];
  selectedDistrictId: DistrictId;
  onSelectedDistrictChange: (districtId: DistrictId) => void;
}

export function CityBoard({ evaluation, decisions, selectedDistrictId, onSelectedDistrictChange }: CityBoardProps) {
  const tDistricts = useTranslations("districts");
  const tIndicators = useTranslations("indicators");
  const tMeasures = useTranslations("measures");
  const tCommon = useTranslations("common");
  const tBoard = useTranslations("board");
  const selectedIndex = AKIM_DATASET.districts.findIndex((district) => district.id === selectedDistrictId);
  const districtValues = evaluation.districts.map((district) => district.score / 100);

  return (
    <section className="cb-panel cb-board" aria-labelledby="city-board-title">
      <div className="cb-section-heading">
        <div>
          <h2 id="city-board-title">{tBoard("board")}</h2>
          <p>{tBoard("boardDescription")}</p>
        </div>
        <span className={cn("cb-result-kind", evaluation.complete ? "cb-result-official" : "cb-result-draft")}>
          {evaluation.complete ? tBoard("officialResult") : tBoard("draftResult")}
        </span>
      </div>

      <div className="cb-board-visual">
        <CitySculpture
          districtValues={districtValues}
          selectedDistrictIndex={selectedIndex}
          label={tBoard("sculptureLabel")}
          className="cb-sculpture"
        />
        <div className="cb-district-selector" aria-label={tBoard("board")}>
          {evaluation.districts.map((district) => (
            <button
              type="button"
              key={district.districtId}
              aria-pressed={selectedDistrictId === district.districtId}
              onClick={() => onSelectedDistrictChange(district.districtId)}
            >
              <span>{tDistricts(district.districtId)}</span>
              <strong>{district.score.toFixed(1)}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="cb-district-grid">
        {evaluation.districts.map((district) => {
          const needs = [...district.indicators].sort((a, b) => a.before - b.before).slice(0, 2);
          const districtMeasures = decisions.filter((decision) => decision.districtId === district.districtId || decision.districtId === null);
          const critical = district.indicators.filter((indicator) => indicator.after < 40);
          const isSelected = selectedDistrictId === district.districtId;
          return (
            <article
              key={district.districtId}
              className={cn("cb-district-card", isSelected && "cb-district-card-selected")}
              onClick={() => onSelectedDistrictChange(district.districtId)}
            >
              <header>
                <div>
                  <MapPin className="size-4" aria-hidden="true" />
                  <h3>{tDistricts(district.districtId)}</h3>
                </div>
                <strong>{district.score.toFixed(1)}</strong>
              </header>

              <div className="cb-needs">
                <span className="cb-small-label">{tBoard("mainNeeds")}</span>
                {needs.map((indicator) => (
                  <div key={indicator.indicatorId} className="cb-indicator-row">
                    <span>{tIndicators(indicator.indicatorId)}</span>
                    <span className="cb-before-after">
                      <span>{indicator.before}</span>
                      <ArrowRight aria-hidden="true" />
                      <strong className={cn(indicator.delta > 0 && "cb-value-positive", indicator.delta < 0 && "cb-value-negative")}>
                        {indicator.after.toFixed(1)}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>

              {critical.length ? (
                <p className="cb-critical-note">
                  <CircleAlert className="size-4" aria-hidden="true" />
                  {tCommon("critical")}: {critical.map((item) => tIndicators(item.indicatorId)).join(", ")}
                </p>
              ) : null}

              <div className="cb-district-measures">
                <span className="cb-small-label">{tBoard("selectedMeasures")}</span>
                {districtMeasures.length ? (
                  <ul>
                    {districtMeasures.map((decision) => (
                      <li key={decision.measureId}>
                        {decision.districtId === null ? <Building2 className="size-3.5" aria-hidden="true" /> : null}
                        {tMeasures(decision.measureId)}
                      </li>
                    ))}
                  </ul>
                ) : <p>{tBoard("noDistrictMeasures")}</p>}
              </div>

              <details className="cb-mobile-details" open={isSelected}>
                <summary>{tBoard("districtDetails")}</summary>
                <div>
                  {district.indicators.map((indicator) => (
                    <div key={indicator.indicatorId} className="cb-indicator-row">
                      <span>{tIndicators(indicator.indicatorId)}</span>
                      <span className="cb-before-after">
                        <span>{indicator.before}</span><ArrowRight aria-hidden="true" />
                        <strong>{indicator.after.toFixed(1)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}

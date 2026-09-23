"use client";

import { MapPin, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Decision } from "../contracts";
import { AKIM_DATASET } from "../data/akim-v1";
import { cn } from "@/components/ui";

export interface DecisionTrayProps {
  decisions: readonly Decision[];
  replacementSlot: number | null;
  onReplacementSlotChange: (slot: number | null) => void;
  onRemove: (slot: number) => void;
}

export function DecisionTray({
  decisions,
  replacementSlot,
  onReplacementSlotChange,
  onRemove,
}: DecisionTrayProps) {
  const tMeasures = useTranslations("measures");
  const tDistricts = useTranslations("districts");
  const tCommon = useTranslations("common");
  const tBoard = useTranslations("board");

  return (
    <section className="cb-panel" aria-labelledby="decision-tray-title">
      <div className="cb-section-heading">
        <div>
          <h2 id="decision-tray-title">{tBoard("decisionTray")}</h2>
          <p>{tBoard("decisionTrayDescription")}</p>
        </div>
        <span className="cb-count" aria-label={`${decisions.length} / 5`}>{decisions.length} / 5</span>
      </div>

      {decisions.length === 5 ? (
        <p className="cb-tray-guidance">
          <RotateCcw className="size-4" aria-hidden="true" />
          {tBoard("chooseReplacement")}
        </p>
      ) : null}

      <ol className="cb-tray-list">
        {Array.from({ length: 5 }, (_, slot) => {
          const decision = decisions[slot];
          const measure = decision ? AKIM_DATASET.measures.find((entry) => entry.id === decision.measureId) : null;
          const selected = replacementSlot === slot;
          return (
            <li key={slot} className={cn("cb-tray-slot", selected && "cb-tray-slot-selected", !decision && "cb-tray-slot-empty")}>
              <span className="cb-slot-number" aria-hidden="true">{slot + 1}</span>
              {decision && measure ? (
                <>
                  <div className="cb-slot-copy">
                    <strong>{tMeasures(decision.measureId)}</strong>
                    <span>
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {decision.districtId ? tDistricts(decision.districtId) : tCommon("city")}
                      <span aria-hidden="true">·</span>
                      {measure.cost} {tCommon("units")}
                    </span>
                  </div>
                  {decisions.length === 5 ? (
                    <button
                      type="button"
                      className="cb-slot-action"
                      aria-pressed={selected}
                      onClick={() => onReplacementSlotChange(selected ? null : slot)}
                    >
                      {selected ? tBoard("replacementSelected") : tBoard("replaceHere")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="cb-icon-button"
                    aria-label={`${tBoard("removeMeasure")}: ${tMeasures(decision.measureId)}`}
                    onClick={() => onRemove(slot)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="cb-empty-label">{tBoard("emptySlot")}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

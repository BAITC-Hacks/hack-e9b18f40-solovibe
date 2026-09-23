"use client";

import { Ban, CheckCircle2, CircleHelp, Clock3, LoaderCircle, OctagonX, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { RunEvent, RunStatus as RunStatusValue, RunView } from "../ai-contracts";
import { Button, cn } from "@/components/ui";

const statusIcons = {
  queued: Clock3,
  running: LoaderCircle,
  waiting_input: CircleHelp,
  completed: CheckCircle2,
  failed: OctagonX,
  cancelled: Ban,
} satisfies Record<RunStatusValue, typeof Clock3>;

const toolKeys: Record<string, string> = {
  readScenario: "toolReadScenario",
  getAttribution: 'toolGetAttribution',
  comparePlans: 'toolComparePlans',
  priceCondition: 'toolPriceCondition',
  applyAlternative: 'toolApplyAlternative',
  stressTest:'toolStressTest',repairStress:'toolRepairStress',readBrief:'toolReadBrief',writeBrief:'toolWriteBrief',updateBrief:'toolUpdateBrief',
  readEvidence: "toolReadEvidence",
  validatePlan: "toolValidatePlan",
  simulatePlan: "toolSimulatePlan",
  searchPlans: "toolSearchPlans",
  saveAlternative: "toolSaveAlternative",
  saveAnalysis: "toolSaveAnalysis",
  requestClarification: "toolClarification",
};

export interface RunStatusProps {
  view: RunView;
  isStopping?: boolean;
  connectionInterrupted?: boolean;
  onStop?: () => void;
}

function eventLabel(event: RunEvent, t: ReturnType<typeof useTranslations<"assistant">>) {
  if (event.kind === "tool" && event.toolName) return `${t(toolKeys[event.toolName] ?? "statusEvent")}: ${t(event.status === "started" ? "operationStarted" : event.status === "failed" ? "operationFailed" : "operationCompleted")}`;
  if (event.kind === "result") return t("resultEvent");
  return event.status in statusIcons ? t(event.status) : t("statusEvent");
}

export function RunStatus({ view, isStopping = false, connectionInterrupted = false, onStop }: RunStatusProps) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const run = view.run;
  const status = run.status;
  const Icon = statusIcons[status];
  const isActive = status === "queued" || status === "running";
  const events = [...new Map(view.events.map(event => [event.kind === "tool" && event.payload.receiptId ? String(event.payload.receiptId) : `event:${event.seq}`, event])).values()];

  return (
    <section className="cba-run" aria-live="polite">
      <div className="cba-run-heading">
        <div className={cn("cba-status-icon", `cba-status-${status}`)}>
          <Icon className={cn(status === "running" && "cba-spin")} aria-hidden="true" />
        </div>
        <div>
          <h3>{t(status)}</h3>
        </div>
        {isActive && onStop ? (
          <Button variant="secondary" size="compact" onClick={onStop} loading={isStopping} loadingLabel={t("stopping")}>
            <Square className="size-3.5" aria-hidden="true" />{t("stop")}
          </Button>
        ) : null}
      </div>

      {connectionInterrupted && isActive ? <p className="cba-connection-note">{t("connectionLost")}</p> : null}

      {events.length ? (
        <details className="cba-operations">
          <summary>{t("operations")} <span>{events.length}</span></summary>
          <ol>
            {events.map((event) => (
              <li key={event.seq}>
                <span className="cba-event-marker" aria-hidden="true" />
                <span>{eventLabel(event, t)}</span>
                <time dateTime={event.createdAt}>{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(event.createdAt))}</time>
              </li>
            ))}
          </ol>
        </details>
      ) : isActive ? (
        <div className="cba-awaiting-event"><LoaderCircle className="cba-spin" aria-hidden="true" />{t(status)}</div>
      ) : null}
    </section>
  );
}

export default RunStatus;

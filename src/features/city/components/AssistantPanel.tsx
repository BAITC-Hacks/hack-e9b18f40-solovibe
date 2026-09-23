"use client";

import { Bot, LoaderCircle, PencilLine, Send, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, type FormEvent } from "react";
import type { AnalysisBlock, EvidenceLink, RunView } from "../ai-contracts";
import type { EvidenceRef, Evaluation } from "../contracts";
import type { ApiProblem, EvaluationRecord } from "../records";
import { useCityRun, type ConversationTurn } from "../client/use-city-run";
import { useScenario } from "../client/scenario-context";
import { AlternativeCard } from "./AlternativeCard";
import { RunStatus } from "./RunStatus";
import { Alert, Button, cn } from "@/components/ui";
import "../assistant.css";

function evaluationMap(view: RunView) {
  return new Map<string, EvaluationRecord>([
    [view.source.evaluation.id, view.source.evaluation],
    ...view.alternatives.map((alternative) => [alternative.evaluation.id, alternative.evaluation] as const),
  ]);
}

function findComparable(evaluation: Evaluation, evidence: EvidenceRef) {
  return evaluation.evidence.find((candidate) => candidate.id === evidence.id)
    ?? evaluation.evidence.find((candidate) => candidate.kind === evidence.kind
      && candidate.districtId === evidence.districtId
      && candidate.indicatorId === evidence.indicatorId
      && candidate.measureId === evidence.measureId);
}

function EvidenceValue({ link, view }: { link: EvidenceLink; view: RunView }) {
  const locale = useLocale();
  const t = useTranslations("assistant");
  const tCommon = useTranslations("common");
  const tDistricts = useTranslations("districts");
  const tIndicators = useTranslations("indicators");
  const evaluations = evaluationMap(view);
  const evaluation = evaluations.get(link.evaluationId);
  const evidence = evaluation?.result.evidence.find((item) => item.id === link.evidenceId);
  if (!evaluation || !evidence) return null;
  const compareEvaluation = link.compareToEvaluationId ? evaluations.get(link.compareToEvaluationId) : null;
  const comparison = compareEvaluation ? findComparable(compareEvaluation.result, evidence) : null;
  const delta = comparison ? evidence.value - comparison.value : null;
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  let label = t("evidence");
  if (evidence.kind === "total") label = tCommon("score");
  else if (evidence.kind === "population") label = t("populationMean");
  else if (evidence.kind === "critical") label = t("thresholdPenalty");
  else if (evidence.kind === "district" && evidence.districtId) label = `${t("score")}: ${tDistricts(evidence.districtId)}`;
  else if (evidence.indicatorId) {
    label = evidence.districtId ? `${tIndicators(evidence.indicatorId)}, ${tDistricts(evidence.districtId)}` : tIndicators(evidence.indicatorId);
  }
  return (
    <li>
      <ShieldCheck aria-hidden="true" />
      <span>{label}</span>
      <strong>{formatter.format(evidence.value)}</strong>
      {delta !== null ? (
        <small className={cn(delta > 0 && "cba-delta-positive", delta < 0 && "cba-delta-negative")}>
          {t("comparedWithSource")}: {delta > 0 ? "+" : ""}{formatter.format(delta)}
        </small>
      ) : null}
    </li>
  );
}

function AnalysisSection({ view }: { view: RunView }) {
  const t = useTranslations("assistant");
  if (!view.analysis) return null;
  const kindKey: Record<AnalysisBlock["kind"], string> = {
    benefit: "benefit",
    tradeoff: "tradeoff",
    risk: "risk",
    limitation: "limitation",
    infeasible: "infeasible",
    noImprovement: "noImprovement",
  };
  return (
    <section className="cba-analysis">
      <h3>{t("analysis")}</h3>
      <div className="cba-analysis-list">
        {view.analysis.document.blocks.map((block, index) => (
          <article key={`${block.kind}-${index}`} className={`cba-analysis-${block.kind}`}>
            <h4>{t(kindKey[block.kind])}</h4>
            <p>{block.text}</p>
            {block.refs.length ? (
              <ul className="cba-evidence-list">
                {block.refs.map((link) => <EvidenceValue key={`${link.evaluationId}-${link.evidenceId}`} link={link} view={view} />)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ErrorText({ code }: { code: string }) {
  const tErrors = useTranslations("errors");
  const t = useTranslations("assistant");
  let message: string;
  try { message = tErrors(code); }
  catch { message = t("draftRetained"); }
  return <>{message}</>;
}

function ProblemAlert({ problem, fallbackKey }: { problem: ApiProblem; fallbackKey: "draftRetained" | "applyFailed" }) {
  const t = useTranslations("assistant");
  const tErrors = useTranslations("errors");
  let message: string;
  try { message = tErrors(problem.code, problem.params); }
  catch { message = t(fallbackKey); }
  return <Alert tone="danger" title={message}>{t(fallbackKey)}</Alert>;
}

interface TurnProps {
  turn: ConversationTurn;
  currentRevisionId: string;
  applyingRevisionId: string | null;
  appliedRevisionId: string | null;
  isStopping: boolean;
  connectionInterrupted: boolean;
  onReuse: (objective: string) => void;
  onStop: (runId: string) => void;
  onRetry: (view: RunView) => void;
  onApply: (revisionId: string) => void;
}

function ConversationTurnView({
  turn,
  currentRevisionId,
  applyingRevisionId,
  appliedRevisionId,
  isStopping,
  connectionInterrupted,
  onReuse,
  onStop,
  onRetry,
  onApply,
}: TurnProps) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const view = turn.view;
  const stale = turn.record.inputRevisionId !== currentRevisionId;
  const failed = turn.record.status === "failed" || turn.record.status === "cancelled";
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(turn.record.createdAt));
  return (
    <article className="cba-turn">
      <div className="cba-message cba-message-user">
        <p>{turn.record.objective}</p>
        <footer>
          <time dateTime={turn.record.createdAt}>{time}</time>
          <button type="button" onClick={() => onReuse(turn.record.objective)}>
            <PencilLine aria-hidden="true" />{t("reuseMessage")}
          </button>
        </footer>
      </div>
      <div className="cba-message cba-message-assistant" aria-label={t("assistantReply")}>
        {!view && turn.loading ? <div className="cba-inline-loading"><LoaderCircle className="cba-spin" aria-hidden="true" />{t("loadingReply")}</div> : null}
        {!view && !turn.loading ? <Alert tone="danger"><ErrorText code="NETWORK" /></Alert> : null}
        {view ? (
          <>
            {stale ? <p className="cba-stale cba-source-note">{t("stale")}</p> : null}
            <RunStatus
              view={view}
              isStopping={isStopping}
              connectionInterrupted={connectionInterrupted && (view.run.status === "queued" || view.run.status === "running")}
              onStop={() => onStop(view.run.id)}
            />
            {view.run.question ? <div className="cba-question"><p>{view.run.question}</p></div> : null}
            {view.alternatives.length ? (
              <section className="cba-alternatives">
                <h3>{t("alternatives")}</h3>
                <div className="cba-alternative-grid">
                  {view.alternatives.map((alternative, index) => (
                    <AlternativeCard
                      key={alternative.revision.id}
                      source={view.source}
                      alternative={alternative}
                      index={index}
                      stale={stale}
                      applying={applyingRevisionId === alternative.revision.id}
                      applied={appliedRevisionId === alternative.revision.id}
                      onApply={onApply}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            <AnalysisSection view={view} />
            {view.run.errorCode ? <Alert tone="danger"><ErrorText code={view.run.errorCode} /></Alert> : null}
            {failed ? <Button variant="secondary" size="compact" onClick={() => onRetry(view)}>{t("retry")}</Button> : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export interface AssistantPanelProps { className?: string; }

export function AssistantPanel({ className }: AssistantPanelProps) {
  const t = useTranslations("assistant");
  const scenario = useScenario();
  const run = useCityRun();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const latest = run.latestRun;
  const waiting = latest?.run.status === "waiting_input";
  const objectiveValid = run.draft.trim().length >= 3 && run.draft.trim().length <= 2000;
  const latestEventCount = latest?.events.length ?? 0;
  const latestContentVersion = `${latest?.run.status ?? "none"}:${latestEventCount}:${latest?.analysis?.id ?? "none"}:${latest?.alternatives.length ?? 0}`;

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      const transcript = transcriptRef.current;
      if (transcript) transcript.scrollTop = transcript.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [latestContentVersion, run.pendingRequest, run.turns.length]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!objectiveValid) return;
    stickToBottomRef.current = true;
    void run.start(waiting && latest ? {
      objective: run.draft,
      procedure: latest.run.procedure,
      parentRunId: latest.run.id,
    } : undefined);
  }

  async function loadOlderMessages() {
    const transcript = transcriptRef.current;
    const previousHeight = transcript?.scrollHeight ?? 0;
    const previousTop = transcript?.scrollTop ?? 0;
    stickToBottomRef.current = false;
    await run.loadOlder();
    requestAnimationFrame(() => {
      const current = transcriptRef.current;
      if (current) current.scrollTop = previousTop + current.scrollHeight - previousHeight;
    });
  }

  const starters = useMemo(() => [
    { key: "starterFind", procedure: "plan" as const },
    { key: "starterExplain", procedure: "explain" as const },
    { key: "starterBalance", procedure: "plan" as const },
  ], []);

  return (
    <section className={cn("cba-panel", className)} aria-labelledby="assistant-title">
      <header className="cba-panel-heading">
        <div className="cba-heading-icon"><Bot aria-hidden="true" /></div>
        <div>
          <h2 id="assistant-title">{t("conversationTitle")}</h2>
          <p>{t("conversationDescription")}</p>
        </div>
      </header>

      <div
        ref={transcriptRef}
        className="cba-transcript"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {run.hasOlder ? (
          <Button variant="quiet" size="compact" className="cba-load-older" loading={run.isLoadingOlder} onClick={() => void loadOlderMessages()}>
            {t("loadOlder")}
          </Button>
        ) : null}
        {run.isLoadingConversation ? <div className="cba-conversation-loading"><LoaderCircle className="cba-spin" aria-hidden="true" />{t("loadingConversation")}</div> : null}
        {!run.isLoadingConversation && !run.turns.length && !run.pendingRequest ? (
          <div className="cba-starters">
            <h3>{t("starterHeading")}</h3>
            {starters.map((starter) => (
              <button key={starter.key} type="button" onClick={() => { stickToBottomRef.current = true; void run.start({ objective: t(starter.key), procedure: starter.procedure }); }}>
                {t(starter.key)}
              </button>
            ))}
          </div>
        ) : null}
        {run.turns.map((turn) => (
          <ConversationTurnView
            key={turn.record.id}
            turn={turn}
            currentRevisionId={scenario.serverView.revision.id}
            applyingRevisionId={run.applyingRevisionId}
            appliedRevisionId={run.appliedRevisionId}
            isStopping={run.isStopping}
            connectionInterrupted={run.connectionInterrupted}
            onReuse={(objective) => { run.setDraft(objective); stickToBottomRef.current = true; }}
            onStop={(runId) => void run.stop(runId)}
            onRetry={(view) => void run.start({ objective: view.run.objective, procedure: view.run.procedure, parentRunId: view.run.id })}
            onApply={(revisionId) => void run.apply(revisionId)}
          />
        ))}
        {run.pendingRequest ? (
          <article className="cba-turn cba-turn-pending">
            <div className="cba-message cba-message-user"><p>{run.pendingRequest.objective}</p></div>
            <div className="cba-message cba-message-assistant cba-inline-loading"><LoaderCircle className="cba-spin" aria-hidden="true" />{t("sending")}</div>
          </article>
        ) : null}
        {run.problem ? <ProblemAlert problem={run.problem} fallbackKey="draftRetained" /> : null}
        {run.applyProblem ? <ProblemAlert problem={run.applyProblem} fallbackKey="applyFailed" /> : null}
      </div>

      <form className="cba-compose" onSubmit={submit}>
        {waiting && latest?.run.question ? <p className="cba-waiting-question">{latest.run.question}</p> : null}
        <label htmlFor="city-assistant-objective" className="sr-only">{waiting ? t("answer") : t("objectiveLabel")}</label>
        <textarea
          id="city-assistant-objective"
          value={run.draft}
          onChange={(event) => run.setDraft(event.target.value)}
          placeholder={waiting ? t("answer") : t("messagePlaceholder")}
          maxLength={2000}
          rows={3}
          aria-invalid={run.draft.length > 0 && !objectiveValid}
        />
        <div className="cba-compose-meta">
          <span>{t("characterCount", { count: run.draft.length })}</span>
          <Button type="submit" size="compact" disabled={!objectiveValid || run.isSubmitting || run.isLoadingConversation} loading={run.isSubmitting} loadingLabel={t("sending")}>
            <Send className="size-4" aria-hidden="true" />{waiting ? t("answer") : t("sendMessage")}
          </Button>
        </div>
        {run.draft.length > 0 && !objectiveValid ? <p className="cba-field-error">{t("invalidObjective")}</p> : null}
      </form>
    </section>
  );
}

export default AssistantPanel;

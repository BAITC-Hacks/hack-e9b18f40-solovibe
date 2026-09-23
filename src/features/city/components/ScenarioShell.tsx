"use client";

import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Coins, Pencil, Scale, Server, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import type { Decision, DistrictId, DomainIssue } from "../contracts";
import type { ScenarioView } from "../records";
import { useScenarioController } from "../client/use-scenario-controller";
import { ScenarioControllerProvider } from "../client/scenario-context";
import { Catalogue, type ChooseResult } from "./Catalogue";
import { CityBoard } from "./CityBoard";
import { DecisionTray } from "./DecisionTray";
import { Alert, Button, LanguageSelector, SaveState, cn } from "@/components/ui";
import { Logo } from "@/components/brand";
import { AccountControl } from "@/components/app/AccountControl";
import { Link, useRouter } from "@/i18n/navigation";
import "../board.css";

export interface ScenarioShellProps {
  initial: ScenarioView;
  assistant?: ReactNode;
}

export function ScenarioShell({ initial, assistant }: ScenarioShellProps) {
  const tCommon = useTranslations("common");
  const tDomain = useTranslations("domain");
  const tErrors = useTranslations("errors");
  const tBoard = useTranslations("board");
  const tAssistant = useTranslations("assistant");
  const tMeasures = useTranslations("measures");
  const tDistricts = useTranslations("districts");
  const controller = useScenarioController(initial);
  const router = useRouter();
  const [selectedDistrictId, setSelectedDistrictId] = useState<DistrictId>("yesil");
  const [replacementSlot, setReplacementSlot] = useState<number | null>(null);
  const [replacementPrompt, setReplacementPrompt] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatCloseRef = useRef<HTMLButtonElement>(null);
  const chatLaunchRef = useRef<HTMLButtonElement>(null);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    requestAnimationFrame(() => chatLaunchRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const frame = requestAnimationFrame(() => chatCloseRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [chatOpen, closeChat]);
  async function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (await controller.flush()) router.push(href);
  }

  function issueText(issue: DomainIssue) {
    const values = Object.fromEntries(
      Object.entries(issue.params).filter((entry): entry is [string, string | number] => typeof entry[1] !== "boolean"),
    );
    return tDomain(issue.code, values);
  }

  function focusCatalogue() {
    const heading = document.getElementById("catalogue-title");
    if (!heading) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  }

  function addOrReplace(decision: Decision): ChooseResult {
    let next: Decision[];
    if (replacementSlot !== null) {
      next = controller.decisions.map((current, index) => index === replacementSlot ? decision : current);
    } else if (controller.decisions.length === 5) {
      setReplacementPrompt(true);
      return "need-replacement";
    } else {
      next = [...controller.decisions, decision];
    }
    if (controller.trySetDecisions(next)) {
      setReplacementSlot(null);
      setReplacementPrompt(false);
      return "accepted";
    }
    return "invalid";
  }

  function removeDecision(slot: number) {
    const next = controller.decisions.filter((_, index) => index !== slot);
    if (controller.trySetDecisions(next)) {
      setReplacementSlot(null);
      setReplacementPrompt(false);
    }
  }

  const savedEvaluation = controller.serverView.evaluation.result;
  const preview = controller.preview;
  const scoreChanged = preview.score !== savedEvaluation.score;

  if (controller.sessionChanging) {
    return <div className="cb-session-changing" aria-busy="true">{tCommon("loading")}</div>;
  }

  return (
    <ScenarioControllerProvider value={controller}>
    <div className="cb-shell">
      <header className="cb-shell-header">
        <Link href="/" className="cb-brand-link" aria-label="CityBalance" onClick={event => navigate(event, "/")}>
          <Logo />
        </Link>
        <nav className="cb-main-nav" aria-label={tBoard("home")}>
          <Link href="/" onClick={event => navigate(event, "/")}>{tBoard("home")}</Link>
          <Link href="/scenarios" onClick={event => navigate(event, "/scenarios")}>{tBoard("library")}</Link>
        </nav>
        <div className="cb-header-actions">
          <AccountControl returnTo={`/city/${initial.scenario.id}`} beforeNavigate={controller.flush} />
          <LanguageSelector label={tCommon("language")} beforeChange={controller.flush} />
        </div>
      </header>

      <main className="cb-workspace">
        <div className="cb-title-row">
          <label className="cb-title-field">
            <span className="sr-only">{tBoard("titleLabel")}</span>
            <Pencil className="size-5" aria-hidden="true" />
            <input
              value={controller.title}
              onChange={(event) => controller.setTitle(event.target.value)}
              aria-label={tBoard("titleLabel")}
            />
          </label>
          <SaveState
            status={controller.saveStatus}
            labels={{
              idle: tCommon("unsaved"),
              saving: tCommon("saving"),
              saved: tCommon("saved"),
              error: tBoard("saveFailed"),
            }}
          />
        </div>

        <div className="cb-workspace-columns">
        <div className="cb-manual-workspace">
        <section className="cb-summary" aria-labelledby="plan-summary-title" aria-live="polite">
          <div className="cb-summary-heading">
            <h1 id="plan-summary-title">{tBoard("planSummary")}</h1>
            <span>{tBoard("preview")}</span>
          </div>
          <div className="cb-summary-metrics">
            <div>
              <Coins aria-hidden="true" />
              <span>{tCommon("budget")}</span>
              <strong>{preview.cost} / 100</strong>
              <small>{tCommon("remaining")}: {preview.remaining} {tCommon("units")}</small>
            </div>
            <div className={cn(!preview.complete && "cb-metric-muted")}>
              <Scale aria-hidden="true" />
              <span>{tCommon("score")}</span>
              <strong>{preview.complete && preview.score !== null ? preview.score.toFixed(2) : "…"}</strong>
              <small>{preview.complete ? tBoard("officialResult") : tBoard("draftScoreHint")}</small>
            </div>
            <div>
              <AlertTriangle aria-hidden="true" />
              <span>{tBoard("criticalPairs")}</span>
              <strong>{preview.criticalPairs.length}</strong>
              <small>{preview.complete ? tBoard("officialResult") : tBoard("draftResult")}</small>
            </div>
          </div>
          {controller.isDirty || scoreChanged ? (
            <div className="cb-preview-note">
              <span>{tBoard("preview")}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
              <span>{tBoard("savedVersion")}: {savedEvaluation.score === null ? "…" : savedEvaluation.score.toFixed(2)}</span>
            </div>
          ) : (
            <div className="cb-preview-note cb-preview-note-saved">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {tBoard("savedVersion")}
            </div>
          )}
        </section>

        {replacementPrompt ? <Alert tone="warning">{tBoard("selectReplacementFirst")}</Alert> : null}
        {controller.attemptIssues.map((issue, index) => (
          <Alert key={`${issue.code}-${index}`} tone="warning">{issueText(issue)}</Alert>
        ))}
        {controller.problem ? (
          <Alert tone="danger" title={tBoard("saveFailed")}>
            <p>{tErrors(controller.problem.code, controller.problem.params)}</p>
            <Button variant="secondary" size="compact" onClick={() => void controller.retrySave()} className="mt-3">
              {tBoard("retrySave")}
            </Button>
          </Alert>
        ) : null}

        {controller.conflict ? (
          <section className="cb-conflict" aria-labelledby="conflict-title">
            <div className="cb-conflict-heading">
              <AlertTriangle aria-hidden="true" />
              <div>
                <h2 id="conflict-title">{tBoard("conflictTitle")}</h2>
                <p>{controller.conflict.external ? tBoard("externalChange") : tBoard("conflictBody")}</p>
              </div>
            </div>
            <div className="cb-conflict-compare">
              <div>
                <h3>{tBoard("localVersion")}</h3>
                <ul>{controller.conflict.localDecisions.map((decision) => <li key={decision.measureId}>{tMeasures(decision.measureId)}{decision.districtId ? `, ${tDistricts(decision.districtId)}` : ""}</li>)}</ul>
              </div>
              <div>
                <h3>{tBoard("serverVersion")}</h3>
                <ul>{controller.conflict.server.revision.decisions.map((decision) => <li key={decision.measureId}>{tMeasures(decision.measureId)}{decision.districtId ? `, ${tDistricts(decision.districtId)}` : ""}</li>)}</ul>
              </div>
            </div>
            <div className="cb-conflict-actions">
              <Button variant="secondary" onClick={controller.useServerVersion}><Server className="size-4" aria-hidden="true" />{tBoard("useServer")}</Button>
              <Button onClick={() => void controller.retryLocalVersion()}>{tBoard("retryLocal")}</Button>
            </div>
          </section>
        ) : null}

        <div className="cb-primary-grid">
          <CityBoard
            evaluation={preview}
            decisions={controller.decisions}
            selectedDistrictId={selectedDistrictId}
            onSelectedDistrictChange={setSelectedDistrictId}
          />
          <DecisionTray
            decisions={controller.decisions}
            replacementSlot={replacementSlot}
            onReplacementSlotChange={(slot) => {
              setReplacementSlot(slot);
              setReplacementPrompt(false);
              if (slot !== null) focusCatalogue();
            }}
            onBrowseCatalogue={() => {
              setReplacementSlot(null);
              focusCatalogue();
            }}
            onRemove={removeDecision}
          />
        </div>

        <Catalogue
          decisions={controller.decisions}
          replacementSlot={replacementSlot}
          attemptIssues={controller.attemptIssues}
          formatIssue={issueText}
          onChoose={addOrReplace}
          onNeedReplacement={() => setReplacementPrompt(true)}
        />
        </div>

        {assistant ? (
          <aside id="city-conversation" className={cn("cb-conversation-column", chatOpen && "cb-conversation-open")}>
            <button
              ref={chatCloseRef}
              type="button"
              className="cb-chat-close"
              aria-label={tAssistant("closeConversation")}
              onClick={closeChat}
            >
              <X aria-hidden="true" />
            </button>
            {assistant}
          </aside>
        ) : null}
        </div>

        {assistant ? (
          <button
            ref={chatLaunchRef}
            type="button"
            className="cb-chat-launcher"
            aria-controls="city-conversation"
            aria-expanded={chatOpen}
            onClick={() => setChatOpen(true)}
          >
            <Bot aria-hidden="true" />
            {tAssistant("discussPlan")}
          </button>
        ) : null}
      </main>
    </div>
    </ScenarioControllerProvider>
  );
}

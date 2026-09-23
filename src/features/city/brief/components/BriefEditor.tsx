"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, Check, ChevronDown, History, RefreshCw, Save, Square } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cityApi, errorCode } from "@/lib/city-api";
import type { RunView } from "../../ai-contracts";
import type { ScenarioView } from "../../records";
import type { BriefSection, BriefView } from "../contracts";
import { BriefStatus, DecisionTable, EvidenceRefs, ResultSummary, SourceStamp, sectionOrder } from "./BriefDocument";
import "../brief.css";
import {DeliveryPanel} from '../../components/sharing/DeliveryPanel';

type SectionId = BriefSection["id"];
type Work = "save" | "history" | "refresh" | "run" | "cancel" | null;

interface DraftSnapshot {
  title: string;
  texts: Partial<Record<SectionId, string>>;
}

interface StoredDraft extends DraftSnapshot {
  baseVersion: number;
  baseTitle: string;
  baseTexts: Partial<Record<SectionId, string>>;
  instruction: string;
  selectedSection: SectionId | "all";
}

export interface BriefEditorProps {
  initial: BriefView;
  deliveryActions?: ReactNode;
}

function sectionMap(view: BriefView) {
  return Object.fromEntries(view.brief.sections.map((section) => [section.id, section.text])) as Partial<Record<SectionId, string>>;
}

function terminal(view: RunView) {
  return ["completed", "failed", "cancelled", "waiting_input"].includes(view.run.status);
}

function isAbort(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError";
}

function cloneTexts(texts: Partial<Record<SectionId, string>>) {
  return { ...texts };
}

export function BriefEditor({ initial, deliveryActions }: BriefEditorProps) {
  const t = useTranslations("brief");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as "ru" | "kk" | "en";
  const [view, setView] = useState(initial);
  const [title, setTitle] = useState(initial.brief.title);
  const [texts, setTexts] = useState<Partial<Record<SectionId, string>>>(() => sectionMap(initial));
  const [selectedSection, setSelectedSection] = useState<SectionId | "all">("all");
  const [instruction, setInstruction] = useState("");
  const [work, setWork] = useState<Work>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const pollController = useRef<AbortController | null>(null);
  const activeControllers = useRef(new Set<AbortController>());
  const alive = useRef(true);
  const sessionInvalidated = useRef(false);
  const sessionEpoch = useRef(0);
  const latestView = useRef(initial);
  const latestTitle = useRef(initial.brief.title);
  const latestTexts = useRef<Partial<Record<SectionId, string>>>(sectionMap(initial));
  const latestInstruction = useRef("");
  const latestSelectedSection = useRef<SectionId | "all">("all");
  const draftLoaded = useRef(false);
  const storageKey = `citybalance:brief-draft:${initial.brief.id}`;
  const currentVersion = Math.max(...view.versions, view.brief.version);
  const historical = view.brief.version !== currentVersion;

  const changedSections = useMemo(
    () => view.brief.sections.filter((section) => (texts[section.id] ?? "") !== section.text),
    [texts, view.brief.sections],
  );
  const dirty = title !== view.brief.title || changedSections.length > 0;

  function captureDraft(): DraftSnapshot {
    return { title: latestTitle.current, texts: cloneTexts(latestTexts.current) };
  }

  function draftChangedSince(sent: DraftSnapshot) {
    return latestTitle.current !== sent.title || sectionOrder.some((id) => (latestTexts.current[id] ?? "") !== (sent.texts[id] ?? ""));
  }

  function finishWork() {
    if (alive.current && !sessionInvalidated.current) setWork(null);
  }

  function persistDraft() {
    if (sessionInvalidated.current || !draftLoaded.current) return;
    const currentView = latestView.current;
    const currentTitle = latestTitle.current;
    const currentTexts = latestTexts.current;
    const hasChanges = currentTitle !== currentView.brief.title || currentView.brief.sections.some((section) => (currentTexts[section.id] ?? "") !== section.text);
    try {
      if (!hasChanges && !latestInstruction.current) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      const stored: StoredDraft = {
        baseVersion: currentView.brief.version,
        baseTitle: currentView.brief.title,
        baseTexts: sectionMap(currentView),
        title: currentTitle,
        texts: cloneTexts(currentTexts),
        instruction: latestInstruction.current,
        selectedSection: latestSelectedSection.current,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // The visible editor remains authoritative when storage is restricted.
    }
  }

  function assertCurrent(epoch: number) {
    if (!alive.current || epoch !== sessionEpoch.current) throw new DOMException("Session changed", "AbortError");
  }

  async function request<T>(path: string, options: { method?: string; body?: unknown } = {}) {
    const epoch = sessionEpoch.current;
    const controller = new AbortController();
    activeControllers.current.add(controller);
    try {
      const result = await cityApi<T>(path, { ...options, signal: controller.signal });
      assertCurrent(epoch);
      return result;
    } finally {
      activeControllers.current.delete(controller);
    }
  }

  useEffect(() => {
    alive.current = true;
    sessionInvalidated.current = false;
    const controllers = activeControllers.current;
    let restored: StoredDraft | null = null;
    try {
      restored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as StoredDraft | null;
    } catch {
      // Ignore malformed or unavailable session storage.
    }
    queueMicrotask(() => {
      if (!alive.current || sessionInvalidated.current) return;
      if (restored && restored.title !== undefined && restored.texts && restored.baseTexts) {
        const restoredTitle = restored.title !== restored.baseTitle ? restored.title : initial.brief.title;
        const serverTexts = sectionMap(initial);
        const restoredTexts = { ...serverTexts };
        for (const id of sectionOrder) {
          if ((restored.texts[id] ?? "") !== (restored.baseTexts[id] ?? "")) restoredTexts[id] = restored.texts[id] ?? "";
        }
        latestTitle.current = restoredTitle;
        latestTexts.current = restoredTexts;
        latestInstruction.current = restored.instruction ?? "";
        latestSelectedSection.current = sectionOrder.includes(restored.selectedSection as SectionId) ? restored.selectedSection : "all";
        setTitle(restoredTitle);
        setTexts(restoredTexts);
        setInstruction(restored.instruction ?? "");
        setSelectedSection(latestSelectedSection.current);
      }
      draftLoaded.current = true;
    });
    return () => {
      persistDraft();
      alive.current = false;
      sessionEpoch.current += 1;
      sessionInvalidated.current = true;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      pollController.current?.abort();
    };
  // The brief id is the lifetime boundary for this editor instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    persistDraft();
  // Persist the visible draft after each user or server reconciliation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, texts, instruction, selectedSection, view]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      persistDraft();
      const currentView = latestView.current;
      const hasChanges = latestTitle.current !== currentView.brief.title || currentView.brief.sections.some((section) => (latestTexts.current[section.id] ?? "") !== section.text);
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handlePageHide = () => persistDraft();
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  // Event handlers read current values through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("citybalance-session");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object" || !("changed" in event.data) || event.data.changed !== true) return;
      sessionEpoch.current += 1;
      sessionInvalidated.current = true;
      activeControllers.current.forEach((controller) => controller.abort());
      activeControllers.current.clear();
      pollController.current?.abort();
      pollController.current = null;
      requestIds.current.clear();
      try { sessionStorage.removeItem(storageKey); } catch { /* Session change still clears visible state. */ }
      latestTitle.current = "";
      latestTexts.current = {};
      latestInstruction.current = "";
      setTitle("");
      setTexts({});
      setInstruction("");
      setRun(null);
      setProblem(null);
      setNotice(null);
      setWork(null);
    };
    return () => channel.close();
  }, [storageKey]);

  function acceptView(next: BriefView, sent?: DraftSnapshot) {
    const currentTitle = latestTitle.current;
    const currentTexts = latestTexts.current;
    const nextTexts = sectionMap(next);
    const reconciledTitle = sent && currentTitle !== sent.title ? currentTitle : next.brief.title;
    const reconciledTexts = { ...nextTexts };
    if (sent) {
      for (const id of sectionOrder) {
        if ((currentTexts[id] ?? "") !== (sent.texts[id] ?? "")) reconciledTexts[id] = currentTexts[id] ?? "";
      }
    }
    latestView.current = next;
    latestTitle.current = reconciledTitle;
    latestTexts.current = reconciledTexts;
    setView(next);
    setTitle(reconciledTitle);
    setTexts(reconciledTexts);
  }

  async function loadBrief(version?: number, sent?: DraftSnapshot) {
    const suffix = version === undefined ? "" : `?version=${version}`;
    const next = await request<BriefView>(`/briefs/${view.brief.id}${suffix}`);
    acceptView(next, sent);
    return next;
  }

  async function save() {
    if (!dirty || work || historical) return;
    setWork("save");
    setProblem(null);
    setNotice(null);
    const sent = captureDraft();
    const submittedTitle = view.brief.title !== sent.title ? sent.title : undefined;
    const submittedSections = view.brief.sections.filter((section) => (sent.texts[section.id] ?? "") !== section.text);
    try {
      const next = await request<BriefView>(`/briefs/${view.brief.id}`, {
        method: "PATCH",
        body: {
          expectedVersion: view.brief.version,
          ...(submittedTitle !== undefined ? { title: submittedTitle } : {}),
          sectionEdits: submittedSections.map((section) => ({ id: section.id, text: sent.texts[section.id] ?? "" })),
        },
      });
      const changedWhilePending = draftChangedSince(sent);
      acceptView(next, sent);
      setNotice(changedWhilePending ? null : t("saved"));
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      finishWork();
    }
  }

  async function acceptGenerated(section: BriefSection) {
    if (!section.generatedText || work || historical) return;
    setWork("save");
    setProblem(null);
    const sent = captureDraft();
    try {
      const next = await request<BriefView>(`/briefs/${view.brief.id}`, {
        method: "PATCH",
        body: {
          expectedVersion: view.brief.version,
          sectionEdits: [{ id: section.id, text: section.generatedText, acceptGenerated: true }],
        },
      });
      const changedWhilePending = draftChangedSince(sent);
      acceptView(next, sent);
      setNotice(changedWhilePending ? null : t("generatedAccepted"));
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      finishWork();
    }
  }

  async function openVersion(version: number) {
    if (work || dirty || version === view.brief.version) return;
    setWork("history");
    setProblem(null);
    try {
      await loadBrief(version);
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      finishWork();
    }
  }

  async function refreshSource() {
    if (work || historical) return;
    setWork("refresh");
    setProblem(null);
    setNotice(null);
    const sent = captureDraft();
    try {
      const scenario = await request<ScenarioView>(`/scenarios/${view.brief.scenarioId}`);
      if (scenario.revision.id === view.brief.sourceRevisionId) {
        setNotice(t("sourceAlreadyCurrent"));
        return;
      }
      const signature = `refresh:${view.brief.version}:${scenario.revision.id}`;
      const clientRequestId = requestIds.current.get(signature) ?? crypto.randomUUID();
      requestIds.current.set(signature, clientRequestId);
      const next = await request<BriefView>(`/briefs/${view.brief.id}/refresh`, {
        method: "POST",
        body: {
          expectedVersion: view.brief.version,
          targetRevisionId: scenario.revision.id,
          clientRequestId,
        },
      });
      requestIds.current.delete(signature);
      const changedWhilePending = draftChangedSince(sent);
      acceptView(next, sent);
      setNotice(dirty || changedWhilePending ? t("refreshedDraftPreserved") : t("refreshed"));
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      finishWork();
    }
  }

  async function pollRun(first: RunView, controller: AbortController, epoch: number) {
    let current = first;
    while (!terminal(current)) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 1200);
        controller.signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      });
      current = await cityApi<RunView>(`/runs/${current.run.id}`, { signal: controller.signal });
      assertCurrent(epoch);
      setRun(current);
    }
    return current;
  }

  async function refine() {
    const objective = instruction.trim();
    if (objective.length < 3 || work || historical) return;
    setWork("run");
    setProblem(null);
    setNotice(null);
    const signature = JSON.stringify([view.brief.id, view.brief.version, selectedSection, objective]);
    const clientRequestId = requestIds.current.get(signature) ?? crypto.randomUUID();
    requestIds.current.set(signature, clientRequestId);
    const controller = new AbortController();
    pollController.current = controller;
    activeControllers.current.add(controller);
    const epoch = sessionEpoch.current;
    const sent = captureDraft();
    const sentInstruction = latestInstruction.current;
    try {
      const created = await cityApi<RunView>("/runs", {
        method: "POST",
        signal: controller.signal,
        body: {
          scenarioId: view.brief.scenarioId,
          inputRevisionId: view.brief.sourceRevisionId,
          procedure: "brief",
          objective,
          locale,
          context: {
            briefId: view.brief.id,
            briefVersion: view.brief.version,
            ...(selectedSection === "all" ? {} : { sectionIds: [selectedSection] }),
          },
          clientRequestId,
        },
      });
      assertCurrent(epoch);
      setRun(created);
      const completed = await pollRun(created, controller, epoch);
      if (completed.run.status === "completed") {
        requestIds.current.delete(signature);
        await loadBrief(undefined, sent);
        if (latestInstruction.current === sentInstruction) {
          latestInstruction.current = "";
          setInstruction("");
        }
        setNotice(t("generationComplete"));
      } else {
        setProblem(completed.run.errorCode ?? (completed.run.status === "waiting_input" ? "INVALID_REQUEST" : "AI_UNAVAILABLE"));
      }
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      activeControllers.current.delete(controller);
      if (pollController.current === controller) pollController.current = null;
      finishWork();
    }
  }

  async function cancel() {
    if (!run || !["queued", "running"].includes(run.run.status)) return;
    setWork("cancel");
    try {
      const stopped = await request<RunView>(`/runs/${run.run.id}/cancel`, { method: "POST", body: {} });
      pollController.current?.abort();
      setRun(stopped);
      setNotice(t("generationCancelled"));
    } catch (cause) {
      if (!isAbort(cause)) setProblem(errorCode(cause));
    } finally {
      finishWork();
    }
  }

  return (
    <main className="cbb-editor">
      <header className="cbb-editor__header">
        <div>
          <div className="cbb-heading-row"><BriefStatus view={view} /><SourceStamp view={view} /></div>
          <label className="cbb-title-field">
            <span>{t("titleLabel")}</span>
            <input value={title} maxLength={160} disabled={historical || work === "history"} onChange={(event) => {
              latestTitle.current = event.target.value;
              setTitle(event.target.value);
              setNotice(null);
            }} />
          </label>
        </div>
        <div className="cbb-header-actions">
          <label className="cbb-version-select">
            <span><History aria-hidden="true" />{t("versionLabel")}</span>
            <div>
              <select
                value={view.brief.version}
                disabled={Boolean(work) || dirty}
                onChange={(event) => void openVersion(Number(event.target.value))}
              >
                {[...view.versions].sort((a, b) => b - a).map((version) => (
                  <option key={version} value={version}>{t("versionOption", { version })}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </div>
            {dirty ? <small>{t("saveBeforeHistory")}</small> : null}
          </label>
          <Button variant="secondary" onClick={() => void refreshSource()} loading={work === "refresh"} disabled={Boolean(work) || historical}>
            <RefreshCw size={17} aria-hidden="true" />{t("refreshSource")}
          </Button>
          <Button onClick={() => void save()} loading={work === "save"} disabled={Boolean(work) || !dirty || historical || !title.trim()}>
            <Save size={17} aria-hidden="true" />{t("save")}
          </Button>
        </div>
      </header>

      {historical ? <Alert tone="info" title={t("historicalTitle")}>{t("historicalDescription", { id: view.brief.sourceRevisionId })}</Alert> : null}
      {view.stale ? <Alert tone="warning" title={t("staleTitle")}>{t("staleDescription")}</Alert> : null}
      {problem ? <Alert tone="danger" title={t("actionFailed")}><p>{tErrors(problem)}</p><p>{t("draftRetained")}</p></Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="cbb-editor__layout">
        <section className="cbb-paper" aria-label={t("documentLabel")}>
          <div className="cbb-paper__intro">
            <h2>{t("decisionSet")}</h2>
            <p>{t("decisionSetHint")}</p>
          </div>
          <DecisionTable view={view} />
          <ResultSummary view={view} />

          <div className="cbb-section-editors">
            {sectionOrder.map((id) => {
              const section = view.brief.sections.find((item) => item.id === id);
              if (!section) return null;
              return (
                <section key={id} className={`cbb-section-editor ${section.stale ? "is-stale" : ""}`}>
                  <header>
                    <div>
                      <h2>{t(`section_${id}`)}</h2>
                      <span>{t(section.userEdited ? "userEdited" : "generated")}</span>
                    </div>
                    {section.stale ? <strong>{t("premiseChanged")}</strong> : null}
                  </header>
                  <label>
                    <span className="sr-only">{t("sectionText", { section: t(`section_${id}`) })}</span>
                    <textarea
                      value={texts[id] ?? ""}
                      maxLength={2500}
                      rows={Math.max(5, Math.min(12, Math.ceil((texts[id]?.length ?? 0) / 90)))}
                      disabled={historical || work === "history"}
                      onChange={(event) => {
                        const next = { ...latestTexts.current, [id]: event.target.value };
                        latestTexts.current = next;
                        setTexts(next);
                        setNotice(null);
                      }}
                    />
                  </label>
                  <div className="cbb-section-editor__meta">
                    <span>{t("characterCount", { count: texts[id]?.length ?? 0 })}</span>
                  </div>
                  {section.generatedText && section.userEdited && section.generatedText !== section.text ? (
                    <details className="cbb-generated-compare">
                      <summary>{t("compareGenerated")}</summary>
                      <div>
                        <strong>{t("generatedCandidate")}</strong>
                        <p>{section.generatedText}</p>
                        <Button variant="secondary" size="compact" disabled={Boolean(work) || historical} onClick={() => void acceptGenerated(section)}>
                          <Check size={16} aria-hidden="true" />{t("acceptGenerated")}
                        </Button>
                      </div>
                    </details>
                  ) : null}
                  <EvidenceRefs refs={section.refs} view={view} />
                </section>
              );
            })}
          </div>
        </section>

        <aside className="cbb-editor__aside">
          <section className="cbb-refine">
            <div className="cbb-refine__title"><Bot aria-hidden="true" /><div><h2>{t("refineTitle")}</h2><p>{t("refineHint")}</p></div></div>
            <label>
              <span>{t("refineSection")}</span>
              <select value={selectedSection} disabled={Boolean(work) || historical} onChange={(event) => {
                const next = event.target.value as SectionId | "all";
                latestSelectedSection.current = next;
                setSelectedSection(next);
              }}>
                <option value="all">{t("allSections")}</option>
                {sectionOrder.map((id) => <option key={id} value={id}>{t(`section_${id}`)}</option>)}
              </select>
            </label>
            <label>
              <span>{t("instructionLabel")}</span>
              <textarea
                value={instruction}
                maxLength={2000}
                rows={5}
                disabled={historical}
                placeholder={t("instructionPlaceholder")}
                onChange={(event) => {
                  latestInstruction.current = event.target.value;
                  setInstruction(event.target.value);
                }}
              />
            </label>
            <p className="cbb-refine__note">{t("refineLanguageNote")}</p>
            <div className="cbb-refine__actions">
              <Button onClick={() => void refine()} loading={work === "run"} loadingLabel={t("generating")} disabled={Boolean(work) || historical || instruction.trim().length < 3}>
                {t(selectedSection === "all" ? "generateNarrative" : "refineSelected")}
              </Button>
              {run && ["queued", "running"].includes(run.run.status) ? (
                <Button variant="secondary" onClick={() => void cancel()} loading={work === "cancel"}>
                  <Square size={14} aria-hidden="true" />{t("cancelGeneration")}
                </Button>
              ) : null}
            </div>
            {run ? <p className={`cbb-run-state cbb-run-state--${run.run.status}`}>{t(`run_${run.run.status}`)}</p> : null}
          </section>
          <section className="cbb-delivery-actions">{deliveryActions??<DeliveryPanel scenarioId={view.brief.scenarioId} revisionId={view.brief.sourceRevisionId} briefId={view.brief.id} briefVersion={view.brief.version} htmlReady={view.brief.status!=='pending'}/>}</section>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RunEvent, RunRecord, RunStatus, RunView } from "../ai-contracts";
import type { ApiProblem } from "../records";
import { inferProcedure } from "../intent";
import { useScenario } from "./scenario-context";
import { AiApiError, applyAlternative, cancelRun, createRun, getRun, listRuns, type RunProblem } from "./ai-api";

const terminalStatuses = new Set<RunStatus>(["completed", "failed", "cancelled", "waiting_input"]);
const statusValues = new Set<RunStatus>(["queued", "running", "waiting_input", "completed", "failed", "cancelled"]);
const draftPrefix = "citybalance:assistant-draft:";
const maxDraftKeys = 10;

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localProblem(code = "NETWORK"): RunProblem {
  return { code, messageKey: `errors.${code}`, requestId: "client" };
}

function readStoredDraft(key: string) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text.slice(0, 2000) : "";
  } catch {
    return raw.slice(0, 2000);
  }
}

function writeStoredDraft(key: string, text: string) {
  if (!text) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify({ text: text.slice(0, 2000), updatedAt: Date.now() }));
  const drafts = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
    .filter((candidate): candidate is string => Boolean(candidate?.startsWith(draftPrefix)))
    .map((candidate) => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(candidate) ?? "{}") as { updatedAt?: unknown };
        return { key: candidate, updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0 };
      } catch {
        return { key: candidate, updatedAt: 0 };
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  drafts.slice(maxDraftKeys).forEach((entry) => sessionStorage.removeItem(entry.key));
}

function clearStoredDrafts() {
  const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index))
    .filter((candidate): candidate is string => Boolean(candidate?.startsWith(draftPrefix)));
  keys.forEach((key) => sessionStorage.removeItem(key));
}

function mergeEvent(view: RunView, event: RunEvent): RunView {
  if (view.events.some((existing) => existing.seq === event.seq)) return view;
  const nextStatus = event.kind === "status" && statusValues.has(event.status as RunStatus)
    ? event.status as RunStatus
    : view.run.status;
  return { ...view, run: { ...view.run, status: nextStatus }, events: [...view.events, event].sort((a, b) => a.seq - b.seq) };
}

function sortNewest(records: RunRecord[]) {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface StartRunOptions {
  objective?: string;
  procedure?: "plan" | "explain";
  parentRunId?: string;
}

export interface ConversationTurn {
  record: RunRecord;
  view: RunView | null;
  loading: boolean;
}

export function useCityRun() {
  const scenario = useScenario();
  const { flush, refresh, acceptCanonical } = scenario;
  const locale = useLocale() as "ru" | "kk" | "en";
  const scenarioId = scenario.serverView.scenario.id;
  const storageKey = `${draftPrefix}${scenarioId}`;
  const [draft, setDraftState] = useState("");
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [views, setViews] = useState<Record<string, RunView>>({});
  const [loadingRunIds, setLoadingRunIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ objective: string; procedure: "plan" | "explain" } | null>(null);
  const [problem, setProblem] = useState<RunProblem | null>(null);
  const [applyProblem, setApplyProblem] = useState<ApiProblem | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [applyingRevisionId, setApplyingRevisionId] = useState<string | null>(null);
  const [appliedRevisionId, setAppliedRevisionId] = useState<string | null>(null);
  const [connectionInterrupted, setConnectionInterrupted] = useState(false);
  const [streamGeneration, setStreamGeneration] = useState(0);
  const requestIdsRef = useRef(new Map<string, string>());
  const applyIdsRef = useRef(new Map<string, string>());
  const draftLoadedKeyRef = useRef<string | null>(null);
  const requestsRef = useRef(new Set<AbortController>());
  const sourceRef = useRef<EventSource | null>(null);
  const viewsRef = useRef<Record<string, RunView>>({});
  const lastSeqRef = useRef(0);
  const sessionEpochRef = useRef(0);

  const latestRecord = records[0] ?? null;
  const liveRecord = records.find((record) => record.status === "queued" || record.status === "running") ?? null;
  const liveRunId = liveRecord?.id;
  const liveRunStatus = liveRecord?.status;

  const runRequest = useCallback(async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const epoch = sessionEpochRef.current;
    const request = new AbortController();
    requestsRef.current.add(request);
    try {
      const result = await operation(request.signal);
      if (epoch !== sessionEpochRef.current) throw new DOMException("Session changed", "AbortError");
      return result;
    } finally {
      requestsRef.current.delete(request);
    }
  }, []);

  const setDraft = useCallback((value: string) => setDraftState(value.slice(0, 2000)), []);

  const updateRecord = useCallback((record: RunRecord) => {
    setRecords((current) => sortNewest([record, ...current.filter((item) => item.id !== record.id)]));
  }, []);

  const updateView = useCallback((view: RunView) => {
    setViews((current) => {
      const next = { ...current, [view.run.id]: view };
      viewsRef.current = next;
      return next;
    });
    updateRecord(view.run);
  }, [updateRecord]);

  const loadViews = useCallback(async (items: RunRecord[]) => {
    const missing = items.filter((item) => !viewsRef.current[item.id]);
    if (!missing.length) return;
    setLoadingRunIds((current) => new Set([...current, ...missing.map((item) => item.id)]));
    for (let index = 0; index < missing.length; index += 4) {
      const batch = missing.slice(index, index + 4);
      const results = await Promise.allSettled(batch.map((item) => runRequest((signal) => getRun(item.id, signal))));
      results.forEach((result) => { if (result.status === "fulfilled") updateView(result.value); });
      setLoadingRunIds((current) => {
        const next = new Set(current);
        batch.forEach((item) => next.delete(item.id));
        return next;
      });
    }
  }, [runRequest, updateView]);

  const fetchSnapshot = useCallback(async (runId: string) => {
    try {
      const view = await runRequest((signal) => getRun(runId, signal));
      updateView(view);
      if (terminalStatuses.has(view.run.status)) {
        setConnectionInterrupted(false);
        await refresh();
      }
      return view;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setProblem(error instanceof AiApiError ? error.problem : localProblem());
      return null;
    }
  }, [refresh, runRequest, updateView]);

  const start = useCallback(async (options: StartRunOptions = {}) => {
    const objective = (options.objective ?? draft).trim();
    const procedure = options.procedure ?? inferProcedure(objective);
    if (objective.length < 3 || objective.length > 2000) {
      setProblem(localProblem("INVALID_REQUEST"));
      return null;
    }
    setPendingRequest({ objective, procedure });
    setIsSubmitting(true);
    setProblem(null);
    setAppliedRevisionId(null);
    const flushed = await flush();
    if (!flushed) {
      setPendingRequest(null);
      setIsSubmitting(false);
      return null;
    }
    const latest = await refresh();
    if (!latest) {
      setPendingRequest(null);
      setIsSubmitting(false);
      return null;
    }
    const parentRunId = options.parentRunId ?? latestRecord?.id;
    const signature = JSON.stringify([latest.revision.id, procedure, objective, parentRunId ?? null]);
    const clientRequestId = requestIdsRef.current.get(signature) ?? uniqueId();
    requestIdsRef.current.set(signature, clientRequestId);
    try {
      const view = await runRequest((signal) => createRun({ scenarioId, inputRevisionId: latest.revision.id, procedure, objective, locale, clientRequestId, parentRunId }, signal));
      requestIdsRef.current.delete(signature);
      updateView(view);
      setDraftState("");
      setPendingRequest(null);
      setConnectionInterrupted(false);
      return view;
    } catch (error) {
      if (error instanceof AiApiError) {
        setProblem(error.problem);
        if (error.problem.run) {
          requestIdsRef.current.delete(signature);
          updateView(error.problem.run);
        }
      } else if (!(error instanceof DOMException && error.name === "AbortError")) setProblem(localProblem());
      setPendingRequest(null);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, flush, latestRecord?.id, locale, refresh, runRequest, scenarioId, updateView]);

  const stop = useCallback(async (runId?: string) => {
    const targetId = runId ?? liveRunId;
    if (!targetId) return;
    setIsStopping(true);
    try {
      const view = await runRequest((signal) => cancelRun(targetId, signal));
      updateView(view);
      sourceRef.current?.close();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setProblem(error instanceof AiApiError ? error.problem : localProblem());
    } finally {
      setIsStopping(false);
    }
  }, [liveRunId, runRequest, updateView]);

  const apply = useCallback(async (revisionId: string) => {
    setApplyingRevisionId(revisionId);
    setApplyProblem(null);
    const flushed = await flush();
    if (!flushed) { setApplyingRevisionId(null); return false; }
    const latest = await refresh();
    if (!latest) { setApplyingRevisionId(null); return false; }
    const clientMutationId = applyIdsRef.current.get(revisionId) ?? uniqueId();
    applyIdsRef.current.set(revisionId, clientMutationId);
    try {
      const view = await runRequest((signal) => applyAlternative(scenarioId, { revisionId, expectedRevisionId: latest.revision.id, clientMutationId }, signal));
      applyIdsRef.current.delete(revisionId);
      acceptCanonical(view);
      setAppliedRevisionId(revisionId);
      await refresh();
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setApplyProblem(error instanceof AiApiError ? error.problem : localProblem());
      return false;
    } finally {
      setApplyingRevisionId(null);
    }
  }, [acceptCanonical, flush, refresh, runRequest, scenarioId]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || isLoadingOlder || !records.length) return;
    setIsLoadingOlder(true);
    try {
      const before = records[records.length - 1].id;
      const page = await runRequest((signal) => listRuns(scenarioId, before, signal));
      setRecords((current) => sortNewest([...current, ...page.items.filter((item) => !current.some((known) => known.id === item.id))]));
      setNextCursor(page.nextCursor);
      await loadViews(page.items);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setProblem(error instanceof AiApiError ? error.problem : localProblem());
    } finally {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, loadViews, nextCursor, records, runRequest, scenarioId]);

  useEffect(() => {
    let active = true;
    draftLoadedKeyRef.current = null;
    let restored = "";
    try { restored = readStoredDraft(storageKey); } catch { /* keep the editable empty value */ }
    queueMicrotask(() => {
      if (!active) return;
      draftLoadedKeyRef.current = storageKey;
      setDraftState(restored);
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (draftLoadedKeyRef.current !== storageKey) return;
    try { writeStoredDraft(storageKey, draft); } catch { /* the visible value remains authoritative */ }
  }, [draft, storageKey]);

  useEffect(() => {
    let active = true;
    void runRequest((signal) => listRuns(scenarioId, undefined, signal))
      .then(async (page) => {
        if (!active) return;
        setRecords(sortNewest(page.items));
        setNextCursor(page.nextCursor);
        await loadViews(page.items);
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) setProblem(error instanceof AiApiError ? error.problem : localProblem());
      })
      .finally(() => { if (active) setIsLoadingConversation(false); });
    return () => { active = false; };
  }, [loadViews, runRequest, scenarioId]);

  const liveView = liveRunId ? views[liveRunId] : null;
  const liveViewAvailable = Boolean(liveView);
  useEffect(() => {
    lastSeqRef.current = Math.max(0, ...(liveView?.events ?? []).map((event) => event.seq));
  }, [liveView?.events]);

  useEffect(() => {
    if (!liveRunId || !liveRunStatus || !liveViewAvailable || terminalStatuses.has(liveRunStatus)) return;
    const source = new EventSource(`/api/city/runs/${encodeURIComponent(liveRunId)}/events?after=${lastSeqRef.current}`);
    sourceRef.current = source;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    source.addEventListener("city", (rawEvent) => {
      try {
        const event = JSON.parse((rawEvent as MessageEvent<string>).data) as RunEvent;
        lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);
        setViews((current) => {
          const currentView = current[event.runId];
          if (!currentView) return current;
          const next = { ...current, [event.runId]: mergeEvent(currentView, event) };
          viewsRef.current = next;
          return next;
        });
        if (event.kind === "status" && statusValues.has(event.status as RunStatus)) {
          setRecords((current) => current.map((record) => record.id === event.runId ? { ...record, status: event.status as RunStatus } : record));
        }
        if (event.kind === "status" && terminalStatuses.has(event.status as RunStatus)) {
          source.close();
          void fetchSnapshot(liveRunId);
        }
      } catch { setConnectionInterrupted(true); }
    });
    source.onopen = () => setConnectionInterrupted(false);
    source.onerror = () => {
      source.close();
      if (closed) return;
      setConnectionInterrupted(true);
      void fetchSnapshot(liveRunId).then((snapshot) => {
        if (!closed && snapshot && !terminalStatuses.has(snapshot.run.status)) {
          reconnectTimer = setTimeout(() => setStreamGeneration((value) => value + 1), 1500);
        }
      });
    };
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
    };
  }, [fetchSnapshot, liveRunId, liveRunStatus, liveViewAvailable, streamGeneration]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("citybalance-session");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object" || !("changed" in event.data) || event.data.changed !== true) return;
      sessionEpochRef.current += 1;
      requestsRef.current.forEach((request) => request.abort());
      requestsRef.current.clear();
      sourceRef.current?.close();
      sourceRef.current = null;
      requestIdsRef.current.clear();
      applyIdsRef.current.clear();
      setRecords([]);
      setViews({});
      viewsRef.current = {};
      setPendingRequest(null);
      setDraftState("");
      try { clearStoredDrafts(); } catch { /* page refresh clears the visible state */ }
    };
    return () => channel.close();
  }, []);

  useEffect(() => () => {
    sourceRef.current?.close();
    requestsRef.current.forEach((request) => request.abort());
  }, []);

  const turns = useMemo<ConversationTurn[]>(() => [...records].reverse().map((record) => ({
    record,
    view: views[record.id] ?? null,
    loading: loadingRunIds.has(record.id),
  })), [loadingRunIds, records, views]);

  return {
    draft,
    setDraft,
    turns,
    latestRun: latestRecord ? views[latestRecord.id] ?? null : null,
    pendingRequest,
    problem,
    applyProblem,
    isLoadingConversation,
    isLoadingOlder,
    hasOlder: Boolean(nextCursor),
    isSubmitting,
    isStopping,
    applyingRevisionId,
    appliedRevisionId,
    connectionInterrupted,
    start,
    stop,
    apply,
    loadOlder,
  };
}

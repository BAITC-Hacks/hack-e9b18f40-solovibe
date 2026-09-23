"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AKIM_DATASET, DEFAULT_CONSTRAINTS } from "../data/akim-v1";
import { evaluate } from "../engine";
import type { Constraints, Decision, DomainIssue } from "../contracts";
import type { ApiProblem, ScenarioView } from "../records";
import { CityApiError, getScenario, renameScenario, saveRevision } from "./api";

interface DraftSnapshot {
  fingerprint: string;
  decisions: Decision[];
  constraints: Constraints;
  clientMutationId: string;
}

export interface ScenarioConflict {
  server: ScenarioView;
  localDecisions: Decision[];
  external: boolean;
}

function copyDecisions(decisions: readonly Decision[]): Decision[] {
  return decisions.map((decision) => ({ ...decision }));
}

function copyConstraints(constraints: Constraints): Constraints {
  return structuredClone(constraints);
}

function fingerprint(decisions: readonly Decision[], constraints: Constraints) {
  return JSON.stringify([decisions, constraints]);
}

function mutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function networkProblem(): ApiProblem {
  return { code: "NETWORK", messageKey: "errors.NETWORK", requestId: "client" };
}

export function useScenarioController(initial: ScenarioView) {
  const [serverView, setServerView] = useState(initial);
  const [decisions, setDecisionsState] = useState<Decision[]>(() => copyDecisions(initial.revision.decisions));
  const [constraints, setConstraintsState] = useState<Constraints>(() => copyConstraints(initial.revision.constraints));
  const [title, setTitleState] = useState(initial.scenario.title);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [attemptIssues, setAttemptIssues] = useState<DomainIssue[]>([]);
  const [conflict, setConflictState] = useState<ScenarioConflict | null>(null);
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState(() => fingerprint(initial.revision.decisions, initial.revision.constraints));
  const [acknowledgedTitle, setAcknowledgedTitle] = useState(initial.scenario.title);

  const viewRef = useRef(initial);
  const decisionsRef = useRef(decisions);
  const constraintsRef = useRef(constraints);
  const titleRef = useRef(title);
  const acknowledgedRef = useRef(fingerprint(initial.revision.decisions, initial.revision.constraints));
  const acknowledgedTitleRef = useRef(initial.scenario.title);
  const mutationIdsRef = useRef(new Map<string, string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRevisionSaveRef = useRef<Promise<boolean> | null>(null);
  const activeTitleSaveRef = useRef<Promise<boolean> | null>(null);
  const conflictRef = useRef<ScenarioConflict | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sessionEpochRef = useRef(0);
  const requestsRef = useRef(new Set<AbortController>());
  const [sessionChanging, setSessionChanging] = useState(false);

  const currentFingerprint = fingerprint(decisions, constraints);
  const revisionDirty = currentFingerprint !== acknowledgedFingerprint;
  const titleDirty = title !== acknowledgedTitle;
  const dirtyRef = useRef(revisionDirty || titleDirty);

  useEffect(() => {
    dirtyRef.current = revisionDirty || titleDirty;
  }, [revisionDirty, titleDirty]);

  const preview = useMemo(() => evaluate(AKIM_DATASET, decisions), [decisions]);

  const setConflict = useCallback((next: ScenarioConflict | null) => {
    conflictRef.current = next;
    setConflictState(next);
  }, []);

  const acceptCanonical = useCallback((view: ScenarioView, replaceDraft: boolean, replaceTitle = replaceDraft) => {
    viewRef.current = view;
    setServerView(view);
    acknowledgedRef.current = fingerprint(view.revision.decisions, view.revision.constraints);
    acknowledgedTitleRef.current = view.scenario.title;
    setAcknowledgedFingerprint(acknowledgedRef.current);
    setAcknowledgedTitle(view.scenario.title);
    if (replaceDraft) {
      const nextDecisions = copyDecisions(view.revision.decisions);
      decisionsRef.current = nextDecisions;
      setDecisionsState(nextDecisions);
      const nextConstraints = copyConstraints(view.revision.constraints);
      constraintsRef.current = nextConstraints;
      setConstraintsState(nextConstraints);
      if (replaceTitle) {
        titleRef.current = view.scenario.title;
        setTitleState(view.scenario.title);
      }
      setSaveStatus("saved");
      setProblem(null);
    }
  }, []);

  const saveRevisionSnapshot = useCallback(async (snapshot: DraftSnapshot): Promise<boolean> => {
    const epoch = sessionEpochRef.current;
    const request = new AbortController();
    requestsRef.current.add(request);
    setSaveStatus("saving");
    setProblem(null);
    try {
      const response = await saveRevision(viewRef.current.scenario.id, {
        expectedRevisionId: viewRef.current.revision.id,
        decisions: snapshot.decisions,
        constraints: snapshot.constraints,
        clientMutationId: snapshot.clientMutationId,
        intent: viewRef.current.revision.intent,
      }, request.signal);
      if (epoch !== sessionEpochRef.current) return false;
      mutationIdsRef.current.delete(snapshot.fingerprint);
      if (fingerprint(response.revision.decisions, response.revision.constraints) !== snapshot.fingerprint) {
        // A retried mutation may already be committed and superseded by another tab.
        acceptCanonical(response, false);
        setConflict({ server: response, localDecisions: copyDecisions(decisionsRef.current), external: true });
        setSaveStatus("error");
        return false;
      }
      const currentMatches = fingerprint(decisionsRef.current, constraintsRef.current) === snapshot.fingerprint;
      const titleMatches = titleRef.current === acknowledgedTitleRef.current;
      acceptCanonical(response, currentMatches, titleMatches);
      channelRef.current?.postMessage({ type: "scenario-invalidated" });
      if (!currentMatches) setSaveStatus("idle");
      return true;
    } catch (error) {
      if (epoch !== sessionEpochRef.current) return false;
      const apiError = error instanceof CityApiError ? error : null;
      if (apiError?.status === 409 || apiError?.problem.code === "STALE_REVISION") {
        try {
          const latest = await getScenario(viewRef.current.scenario.id);
          acceptCanonical(latest, false);
          setConflict({ server: latest, localDecisions: copyDecisions(decisionsRef.current), external: false });
        } catch {
          setProblem(networkProblem());
        }
      } else {
        setProblem(apiError?.problem ?? networkProblem());
      }
      setSaveStatus("error");
      return false;
    } finally {
      requestsRef.current.delete(request);
    }
  }, [acceptCanonical, setConflict]);

  const saveCurrentRevision = useCallback(async (): Promise<boolean> => {
    if (conflictRef.current) return false;
    const current = fingerprint(decisionsRef.current, constraintsRef.current);
    if (current === acknowledgedRef.current) return true;
    if (activeRevisionSaveRef.current) {
      const prior = activeRevisionSaveRef.current;
      const priorSucceeded = await prior;
      if (!priorSucceeded || conflictRef.current) return false;
      if (activeRevisionSaveRef.current === prior) activeRevisionSaveRef.current = null;
    }
    const latest = fingerprint(decisionsRef.current, constraintsRef.current);
    if (latest === acknowledgedRef.current) return true;
    const clientMutationId = mutationIdsRef.current.get(latest) ?? mutationId();
    mutationIdsRef.current.set(latest, clientMutationId);
    const snapshot: DraftSnapshot = {
      fingerprint: latest,
      decisions: copyDecisions(decisionsRef.current),
      constraints: copyConstraints(constraintsRef.current),
      clientMutationId,
    };
    const operation = saveRevisionSnapshot(snapshot);
    activeRevisionSaveRef.current = operation;
    const succeeded = await operation;
    if (activeRevisionSaveRef.current === operation) activeRevisionSaveRef.current = null;
    return succeeded;
  }, [saveRevisionSnapshot]);

  const saveCurrentTitle = useCallback(async (): Promise<boolean> => {
    if (titleRef.current === acknowledgedTitleRef.current) return true;
    if (activeTitleSaveRef.current) {
      const prior = activeTitleSaveRef.current;
      const priorSucceeded = await prior;
      if (!priorSucceeded) return false;
      if (activeTitleSaveRef.current === prior) activeTitleSaveRef.current = null;
    }
    if (titleRef.current === acknowledgedTitleRef.current) return true;
    const sentTitle = titleRef.current.trim();
    if (!sentTitle) {
      setProblem({ code: "INVALID_REQUEST", messageKey: "errors.INVALID_REQUEST", requestId: "client" });
      setSaveStatus("error");
      return false;
    }
    const operation = (async () => {
      const epoch = sessionEpochRef.current;
      const request = new AbortController();
      requestsRef.current.add(request);
      setSaveStatus("saving");
      try {
        const response = await renameScenario(viewRef.current.scenario.id, sentTitle, request.signal);
        if (epoch !== sessionEpochRef.current) return false;
        const merged = { ...viewRef.current, scenario: { ...viewRef.current.scenario, title: response.scenario.title, updatedAt: response.scenario.updatedAt } };
        viewRef.current = merged;
        setServerView(merged);
        acknowledgedTitleRef.current = response.scenario.title;
        setAcknowledgedTitle(response.scenario.title);
        if (titleRef.current.trim() === sentTitle) {
          titleRef.current = response.scenario.title;
          setTitleState(response.scenario.title);
        }
        setProblem(null);
        channelRef.current?.postMessage({ type: "scenario-invalidated" });
        return true;
      } catch (error) {
        if (epoch !== sessionEpochRef.current) return false;
        setProblem(error instanceof CityApiError ? error.problem : networkProblem());
        setSaveStatus("error");
        return false;
      } finally {
        requestsRef.current.delete(request);
      }
    })();
    activeTitleSaveRef.current = operation;
    const succeeded = await operation;
    if (activeTitleSaveRef.current === operation) activeTitleSaveRef.current = null;
    return succeeded;
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const revisionSaved = await saveCurrentRevision();
    if (!revisionSaved) return false;
    const titleSaved = await saveCurrentTitle();
    if (!titleSaved) return false;
    const clean = fingerprint(decisionsRef.current, constraintsRef.current) === acknowledgedRef.current
      && titleRef.current.trim() === acknowledgedTitleRef.current;
    setSaveStatus(clean ? "saved" : "idle");
    return clean;
  }, [saveCurrentRevision, saveCurrentTitle]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("idle");
    setProblem(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, 400);
  }, []);

  const trySetDecisions = useCallback((next: Decision[]) => {
    const result = evaluate(AKIM_DATASET, next);
    if (!result.valid) {
      setAttemptIssues(result.issues);
      return false;
    }
    const copied = copyDecisions(next);
    decisionsRef.current = copied;
    dirtyRef.current = true;
    setDecisionsState(copied);
    setAttemptIssues([]);
    scheduleSave();
    return true;
  }, [scheduleSave]);

  const setTitle = useCallback((next: string) => {
    titleRef.current = next;
    dirtyRef.current = true;
    setTitleState(next);
    scheduleSave();
  }, [scheduleSave]);

  const useServerVersion = useCallback(() => {
    const currentConflict = conflictRef.current;
    if (!currentConflict) return;
    acceptCanonical(currentConflict.server, true);
    setConflict(null);
    setAttemptIssues([]);
  }, [acceptCanonical, setConflict]);

  const retryLocalVersion = useCallback(async () => {
    const currentConflict = conflictRef.current;
    if (!currentConflict) return false;
    acceptCanonical(currentConflict.server, false);
    setConflict(null);
    mutationIdsRef.current.delete(fingerprint(decisionsRef.current, constraintsRef.current));
    return saveCurrentRevision();
  }, [acceptCanonical, saveCurrentRevision, setConflict]);

  const refresh = useCallback(async (): Promise<ScenarioView | null> => {
    const epoch = sessionEpochRef.current;
    const request = new AbortController();
    requestsRef.current.add(request);
    try {
      const latest = await getScenario(viewRef.current.scenario.id, request.signal);
      if (epoch !== sessionEpochRef.current) return null;
      const activeRevisionChanged = latest.revision.id !== viewRef.current.revision.id;
      if (dirtyRef.current && activeRevisionChanged) {
        acceptCanonical(latest, false);
        setConflict({ server: latest, localDecisions: copyDecisions(decisionsRef.current), external: true });
      } else {
        acceptCanonical(latest, !dirtyRef.current);
      }
      return latest;
    } catch (error) {
      if (epoch === sessionEpochRef.current) setProblem(error instanceof CityApiError ? error.problem : networkProblem());
      return null;
    } finally {
      requestsRef.current.delete(request);
    }
  }, [acceptCanonical, setConflict]);

  const adoptCanonical = useCallback((view: ScenarioView) => {
    acceptCanonical(view, true);
    setConflict(null);
    setAttemptIssues([]);
    setProblem(null);
  }, [acceptCanonical, setConflict]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !activeRevisionSaveRef.current && !activeTitleSaveRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("citybalance-scenarios");
    channelRef.current = channel;
    channel.onmessage = async (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object" || !("type" in event.data) || event.data.type !== "scenario-invalidated") return;
      try {
        const latest = await getScenario(viewRef.current.scenario.id);
        if (latest.revision.id === viewRef.current.revision.id && latest.scenario.title === viewRef.current.scenario.title) return;
        if (dirtyRef.current || activeRevisionSaveRef.current || activeTitleSaveRef.current) {
          acceptCanonical(latest, false);
          setConflict({ server: latest, localDecisions: copyDecisions(decisionsRef.current), external: true });
        } else {
          acceptCanonical(latest, true);
        }
      } catch {
        // A no-secret invalidation is best-effort; normal save/refetch paths still recover.
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [acceptCanonical, setConflict]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("citybalance-session");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object" || !("changed" in event.data) || event.data.changed !== true) return;
      sessionEpochRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      mutationIdsRef.current.clear();
      requestsRef.current.forEach((request) => request.abort());
      requestsRef.current.clear();
      decisionsRef.current = [];
      titleRef.current = "";
      const clearedConstraints = copyConstraints(DEFAULT_CONSTRAINTS);
      constraintsRef.current = clearedConstraints;
      setDecisionsState([]);
      setTitleState("");
      setConstraintsState(clearedConstraints);
      setSessionChanging(true);
      window.location.reload();
    };
    return () => channel.close();
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    serverView,
    decisions,
    constraints,
    title,
    preview,
    saveStatus,
    problem,
    attemptIssues,
    conflict,
    isDirty: revisionDirty || titleDirty,
    trySetDecisions,
    setTitle,
    flush,
    retrySave: flush,
    useServerVersion,
    retryLocalVersion,
    refresh,
    acceptCanonical: adoptCanonical,
    sessionChanging,
  };
}

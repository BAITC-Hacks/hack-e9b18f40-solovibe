"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { cityApi, errorCode } from "@/lib/city-api";
import { useScenario } from "../../client/scenario-context";
import { draftFingerprint } from "../../client/draft-key";
import { AKIM_DATASET } from "../../data/akim-v1";
import type { MeasureId } from "../../contracts";
import type { ScenarioView } from "../../records";
import type { RunView } from "../../ai-contracts";
import type { StressRecord, StressView, WorkshopSearchView } from "../../workshop-contracts";
import { ConditionChecks, DecisionChanges, EvaluationSummary } from "../workshop/Comparison";
import "../../stress.css";
import { useRouter } from "@/i18n/navigation";
import type { BriefView } from "../../brief/contracts";
const pending = (status?: string) => status === "queued" || status === "running";
const fingerprint = (c: ReturnType<typeof useScenario>) => draftFingerprint(c.decisions, c.constraints) + c.title;
export function StressPanel() {
    const router = useRouter(), tw = useTranslations("workflow");
    const c = useScenario(), t = useTranslations("stress"), tm = useTranslations("measures"), td = useTranslations("districts"), ti = useTranslations("indicators"), te = useTranslations("errors"), domain = useTranslations("domain"), locale = useLocale();
    const [measure, setMeasure] = useState<MeasureId | "">(""), [cost, setCost] = useState(20), [delay, setDelay] = useState(0), [objective, setObjective] = useState("");
    const [history, setHistory] = useState<StressRecord[]>([]), [chosen, setChosen] = useState<string | null>(null), [view, setView] = useState<StressView | null>(null), [reload, setReload] = useState(0), [loading, setLoading] = useState(false);
    const [job, setJob] = useState<WorkshopSearchView | null>(null), [run, setRun] = useState<RunView | null>(null), [paused, setPaused] = useState(false), [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
    const latest = useRef(c), mounted = useRef(true), requests = useRef(new Set<AbortController>()), mutating = useRef(false), tokens = useRef(new Map<string, string>()), selection = useRef<string | null>(null);
    useEffect(() => { latest.current = c; }, [c]);
    useEffect(() => { selection.current = chosen; }, [chosen]);
    useEffect(() => { mounted.current = true; const current = requests.current; return () => { mounted.current = false; current.forEach(a => a.abort()); }; }, []);
    const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown) => {
        const a = new AbortController();
        requests.current.add(a);
        try {
            return await cityApi<T>(path, { method, body, signal: a.signal });
        }
        finally {
            requests.current.delete(a);
        }
    }, []);
    const report = useCallback((error: unknown) => {
        if (!mounted.current)
            return;
        const code = errorCode(error);
        setProblem(te.has(code) ? te(code) : t("requestFailed"));
    }, [te, t]);
    const idFor = (key: string) => {
        let id = tokens.current.get(key);
        if (!id) {
            id = crypto.randomUUID();
            tokens.current.set(key, id);
        }
        return id;
    };
    const scenarioId = c.serverView.scenario.id, revisionId = c.serverView.revision.id;
    useEffect(() => {
        const a = new AbortController();
        requestList();
        async function requestList() {
            try {
                const result = await cityApi<{
                    items: StressRecord[];
                }>(`/stress-tests?scenarioId=${scenarioId}`, { signal: a.signal });
                if (a.signal.aborted)
                    return;
                setHistory(result.items);
                if (!selection.current && result.items.length)
                    setChosen(result.items[0].id);
            }
            catch (error) {
                if (!a.signal.aborted)
                    report(error);
            }
        }
        return () => a.abort();
    }, [scenarioId, revisionId, reload, report]);
    useEffect(() => {
        if (!chosen)
            return;
        const a = new AbortController();
        queueMicrotask(() => {
            if (!a.signal.aborted)
                setLoading(true);
        });
        cityApi<StressView>(`/stress-tests/${chosen}`, { signal: a.signal }).then(result => {
            if (!a.signal.aborted)
                setView(result);
        }).catch(error => {
            if (!a.signal.aborted)
                report(error);
        }).finally(() => {
            if (!a.signal.aborted)
                setLoading(false);
        });
        return () => a.abort();
    }, [chosen, revisionId, reload, report]);
    const jobId = pending(job?.status) ? job!.id : null, runId = pending(run?.run.status) ? run!.run.id : null;
    useEffect(() => {
        if ((!jobId && !runId) || paused)
            return;
        const a = new AbortController();
        let count = 0, timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            try {
                let ongoing = false;
                if (jobId) {
                    const next = await cityApi<WorkshopSearchView>(`/searches/${jobId}`, { signal: a.signal });
                    if (a.signal.aborted)
                        return;
                    setJob(next);
                    ongoing = pending(next.status);
                }
                if (runId) {
                    const next = await cityApi<RunView>(`/runs/${runId}`, { signal: a.signal });
                    if (a.signal.aborted)
                        return;
                    setRun(next);
                    ongoing = ongoing || pending(next.run.status);
                }
                if (ongoing) {
                    if (++count >= 150)
                        setPaused(true);
                    else
                        timer = setTimeout(poll, 2000);
                }
                else
                    setReload(v => v + 1);
            }
            catch (error) {
                if (!a.signal.aborted) {
                    report(error);
                    setPaused(true);
                }
            }
        };
        timer = setTimeout(poll, 1000);
        return () => { clearTimeout(timer); a.abort(); };
    }, [jobId, runId, paused, report]);
    async function act(action: () => Promise<void>) {
        if (mutating.current)
            return;
        mutating.current = true;
        setBusy(true);
        setProblem(null);
        setNotice(null);
        try {
            await action();
        }
        catch (error) {
            report(error);
        }
        finally {
            mutating.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    const selectedMeasure = c.decisions.some(d => d.measureId === measure) ? measure : c.decisions[0]?.measureId ?? "";
    async function create() {
        await act(async () => {
            if (!await latest.current.flush()) {
                setProblem(t("saveFirst"));
                return;
            }
            if (!mounted.current)
                return;
            const saved = await request<ScenarioView>(`/scenarios/${scenarioId}`);
            if (!mounted.current)
                return;
            if (latest.current.isDirty || draftFingerprint(saved.revision.decisions, saved.revision.constraints) !== draftFingerprint(latest.current.decisions, latest.current.constraints)) {
                setProblem(t("saveFirst"));
                return;
            }
            const key = JSON.stringify([saved.revision.id, selectedMeasure, cost, delay]);
            const result = await request<StressView>("/stress-tests", "POST", { sourceRevisionId: saved.revision.id, measureId: selectedMeasure, costIncreasePct: cost, extraLagQuarters: delay, clientMutationId: idFor(key) });
            if (!mounted.current)
                return;
            tokens.current.delete(key);
            setChosen(result.experiment.id);
            setView(result);
            setJob(null);
            setRun(null);
            setReload(v => v + 1);
        });
    }
    async function makeBrief(revisionId: string) { if (!view)
        return; await act(async () => { if (!await latest.current.flush())
        return; const brief = await request<BriefView>('/briefs', 'POST', { sourceRevisionId: revisionId, stressId: view.experiment.id, locale, clientMutationId: crypto.randomUUID() }); if (mounted.current)
        router.push(`/city/${brief.brief.scenarioId}/brief?briefId=${brief.brief.id}`); }); }
    async function repair(ai: boolean) {
        if (!view)
            return;
        const experiment = view.experiment;
        await act(async () => {
            const key = `${experiment.id}:${ai ? objective || t("defaultObjective") : "exact"}`;
            if (ai) {
                const result = await request<RunView>("/runs", "POST", { scenarioId, inputRevisionId: experiment.sourceRevisionId, procedure: "plan", context: { stressId: experiment.id }, objective: objective.trim() || t("defaultObjective"), locale, clientRequestId: idFor(key) });
                if (mounted.current)
                    setRun(result);
            }
            else {
                const result = await request<WorkshopSearchView>(`/stress-tests/${experiment.id}/repair`, "POST", { clientRequestId: idFor(key) });
                if (mounted.current)
                    setJob(result);
            }
            tokens.current.delete(key);
            if (mounted.current) {
                setPaused(false);
                setReload(v => v + 1);
            }
        });
    }
    async function cancel() {
        await act(async () => {
            if (jobId) {
                const result = await request<WorkshopSearchView>(`/searches/${jobId}/cancel`, "POST", {});
                if (mounted.current)
                    setJob(result);
            }
            if (runId) {
                const result = await request<RunView>(`/runs/${runId}/cancel`, "POST", {});
                if (mounted.current)
                    setRun(result);
            }
            if (mounted.current)
                setReload(v => v + 1);
        });
    }
    async function apply(candidateId: string, fork = false) {
        await act(async () => {
            if (fork) {
                const result = await request<ScenarioView>(`/scenarios/${scenarioId}/forks`, "POST", { revisionId: candidateId, clientMutationId: idFor(`fork:${candidateId}`) });
                if (mounted.current)
                    setNotice(t("forked", { title: result.scenario.title }));
                return;
            }
            if (!await latest.current.flush()) {
                setProblem(t("saveFirst"));
                return;
            }
            if (!mounted.current)
                return;
            const saved = await request<ScenarioView>(`/scenarios/${scenarioId}`);
            if (!mounted.current)
                return;
            if (saved.revision.id !== latest.current.serverView.revision.id) {
                await latest.current.refresh();
                setProblem(t("saveFirst"));
                return;
            }
            if (latest.current.isDirty) {
                setProblem(t("saveFirst"));
                return;
            }
            const before = fingerprint(latest.current);
            try {
                const result = await request<ScenarioView>(`/scenarios/${scenarioId}/apply`, "POST", { revisionId: candidateId, expectedRevisionId: saved.revision.id, clientMutationId: idFor(`apply:${candidateId}:${saved.revision.id}`) });
                if (!mounted.current)
                    return;
                if (before === fingerprint(latest.current) && !latest.current.isDirty && latest.current.serverView.revision.id === saved.revision.id)
                    latest.current.acceptCanonical(result);
                else {
                    await latest.current.refresh();
                    setNotice(t("localPreserved"));
                }
            }
            catch (error) {
                if (errorCode(error) === "STALE_REVISION")
                    await latest.current.refresh();
                throw error;
            }
        });
    }
    const experiment = view?.experiment, stale = !!view && (view.stale || experiment?.sourceRevisionId !== revisionId || c.isDirty), active = !!jobId || !!runId;
    const definition = AKIM_DATASET.measures.find(m => m.id === selectedMeasure);
    const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n);
    return <section className="cbs-panel" aria-labelledby="cbs-title"><header><h3 id="cbs-title">{t("title")}</h3><p>{t("intro")}</p></header>
 <div className="cbs-inputs"><label>{t("measure")}<select value={selectedMeasure} disabled={!c.decisions.length} onChange={e => setMeasure(e.target.value as MeasureId)}>{!c.decisions.length && <option value="">{t("selectFirst")}</option>}{c.decisions.map(d => <option key={d.measureId} value={d.measureId}>{tm(d.measureId)} · {d.districtId ? td(d.districtId) : t("city")}</option>)}</select></label><label>{t("costIncrease")}<input type="number" min="0" max="50" value={cost} onChange={e => setCost(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}/></label><label>{t("extraDelay")}<input type="number" min="0" max="4" step="1" value={delay} onChange={e => setDelay(Math.max(0, Math.min(4, Math.round(Number(e.target.value) || 0))))}/></label></div>
 <p className="cbs-hint">{t("conditionLimits")}</p>{definition && <p className="cbs-hint">{t("lagHint", { original: definition.lag, effective: Math.min(8, definition.lag + delay) })}</p>}<div className="cbs-actions"><Button disabled={!selectedMeasure || active || !!c.conflict} loading={busy} onClick={() => void create()}>{t("create")}</Button><Button variant="quiet" onClick={() => { setCost(0); setDelay(0); }}>{t("reset")}</Button></div><details className="cbs-method"><summary>{t("methodDetails")}</summary><p className="cbs-hint">{t("assumptionLimit")}</p></details>
 {problem && <div className="cbs-warning" role="alert">{problem}<Button variant="quiet" onClick={() => { setProblem(null); setReload(v => v + 1); setPaused(false); }}>{t("retry")}</Button></div>}{notice && <p role="status">{notice}</p>}
 {history.length > 0 && <details className="cbs-history-disclosure"><summary>{t("historyCount", { count: history.length })}</summary><label className="cbs-history">{t("history")}<select disabled={active || busy} value={chosen ?? ""} onChange={e => { setChosen(e.target.value); setView(null); setJob(null); setRun(null); }}>{history.map(item => <option key={item.id} value={item.id}>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))} · {tm(item.assumption.measureId)} · +{item.assumption.costIncreasePct}% · +{item.assumption.extraLagQuarters} {t("quarters")}</option>)}</select></label></details>}
 {loading && <p role="status">{t("loading")}</p>}
 {experiment && <div className="cbs-result">{(experiment.assumption.measureId!==selectedMeasure||experiment.assumption.costIncreasePct!==cost||experiment.assumption.extraLagQuarters!==delay)&&<p className="cbs-hint">{t("savedParameters")}</p>}<div className="cbs-source"><h4>{tm(experiment.assumption.measureId)} · +{experiment.assumption.costIncreasePct}% · +{experiment.assumption.extraLagQuarters} {t("quarters")}</h4></div>{stale && <p className="cbs-warning">{t("stale")}</p>}
 <p className={experiment.stressed.valid ? "cbs-outcome-ok" : "cbs-warning"} role="status">{t(experiment.stressed.valid ? "withinConditions" : "invalid")}</p>
 <table className="cbs-outcome-table"><caption className="cbw-visually-hidden">{t("outcomes")}</caption><thead><tr><th scope="col">{t("metric")}</th><th scope="col">{t("baseline")}</th><th scope="col">{t("experiment")}</th></tr></thead><tbody>{[{ key: "score", label: t("scoreMetric"), before: experiment.baseline.score, after: experiment.stressed.score }, { key: "cost", label: t("costMetric"), before: experiment.baseline.cost, after: experiment.stressed.cost }, { key: "weakest", label: t("weakestMetric"), before: experiment.baseline.minimumDistrictScore, after: experiment.stressed.minimumDistrictScore }, { key: "critical", label: t("criticalMetric"), before: experiment.baseline.criticalPairs.length, after: experiment.stressed.criticalPairs.length }].map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.before === null ? "—" : number(row.before)}</td><td><strong>{row.after === null ? "—" : number(row.after)}</strong>{row.before !== null && row.after !== null && <small>Δ {row.after - row.before > 0 ? "+" : ""}{number(row.after - row.before)}</small>}</td></tr>)}</tbody></table>
 {experiment.stressed.issues.map((issue, i) => <p className="cbs-warning" key={i}>{domain.has(issue.code) ? domain(issue.code, Object.fromEntries(Object.entries(issue.params).map(([k, v]) => [k, typeof v === "boolean" ? String(v) : v]))) : t("validationIssue", { code: issue.code })}</p>)}
 <details><summary>{t("indicatorChanges")}</summary><p className="cbs-hint">{t("source")}: {experiment.sourceRevisionId.slice(0, 8)}</p><div className="cbs-districts">{experiment.stressed.districts.map(d => { const original = experiment.baseline.districts.find(b => b.districtId === d.districtId); return <article key={d.districtId}><h5>{td(d.districtId)}</h5><dl>{d.indicators.map(i => { const from = original?.indicators.find(b => b.indicatorId === i.indicatorId)?.after; return <div key={i.indicatorId}><dt>{ti(i.indicatorId)}</dt><dd>{from === undefined ? "—" : number(from)} → {number(i.after)}</dd></div>; })}</dl></article>; })}</div></details>
 <section className="cbs-repair"><h4>{t(experiment.stressed.valid ? "improveTitle" : "repairTitle")}</h4><p>{t("repairShort")}</p><div className="cbs-actions"><Button disabled={busy || active || loading} onClick={() => void repair(false)}>{t("repairExact")}</Button><Button variant="secondary" disabled={busy || active} onClick={() => void makeBrief(experiment.sourceRevisionId)}>{tw("createBrief")}</Button>{active && <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>{t("cancel")}</Button>}</div><details><summary>{t("assistant")}</summary><label>{t("objective")}<textarea rows={3} maxLength={2000} value={objective} onChange={e => setObjective(e.target.value)} placeholder={t("defaultObjective")}/></label><Button variant="secondary" disabled={busy || active || loading} onClick={() => void repair(true)}>{t("repairAi")}</Button></details>
 {job && <div role="status" className="cbs-status"><strong>{t(job.result?.status === "incomplete" ? "incomplete" : job.status)}</strong>{job.result && <span>{t("progress", { evaluated: job.result.evaluatedCount, feasible: job.result.feasibleCount })}</span>}{job.result?.status === "complete" && !job.result.feasibleCount && <p>{t("infeasible")}</p>}{job.errorCode && <p>{te.has(job.errorCode) ? te(job.errorCode) : t("requestFailed")}</p>}</div>}
 {run && <div className="cbs-analysis"><p role="status">{t(run.run.status)}</p>{run.run.errorCode && <p className="cbs-warning">{te.has(run.run.errorCode) ? te(run.run.errorCode) : t("requestFailed")}</p>}{run.run.question && <p>{run.run.question}</p>}{run.run.status === "waiting_input" && <p>{t("waitingHint")}</p>}{run.events.length > 0 && <p className="cbs-hint">{t("observedSteps", { count: run.events.filter(e => e.kind === "tool").length })}</p>}{run.analysis?.document.blocks.map((block, i) => <p className="cbs-analysis-block" key={i}>{block.text}</p>)}</div>}
 {paused && active && <Button variant="secondary" onClick={() => { setProblem(null); setPaused(false); }}>{t("resume")}</Button>}
 <div className="cbs-repairs">{view?.repairs.map((repair, i) => <article className="cbs-candidate" key={repair.revision.id}><h4>{repair.revision.title || `${t("candidate")} ${i + 1}`}</h4><h5>{t("sameAssumption")}</h5><EvaluationSummary result={repair.sensitivity}/>{!repair.sensitivity.valid && <p className="cbs-warning">{t("invalid")}</p>}{!repair.revision.decisions.some(d => d.measureId === experiment.assumption.measureId) && <p className="cbs-warning">{t("riskRemoved", { measure: tm(experiment.assumption.measureId) })}</p>}<details><summary>{t("decisions")}</summary><DecisionChanges source={experiment.baseline.decisions} target={repair.revision.decisions}/><ConditionChecks constraints={repair.revision.constraints} result={repair.sensitivity}/><p className="cbs-hint">{t("applyHint")}</p><h5>{t("official")}</h5><EvaluationSummary result={repair.evaluation.result}/></details><div className="cbs-actions"><Button disabled={busy || !!c.conflict || !repair.sensitivity.valid || loading} onClick={() => void apply(repair.revision.id)}>{t("apply")}</Button><Button variant="secondary" disabled={busy || loading} onClick={() => void apply(repair.revision.id, true)}>{t("fork")}</Button><Button variant="quiet" disabled={busy} onClick={() => void makeBrief(repair.revision.id)}>{tw("createBrief")}</Button></div></article>)}</div></section></div>}
 </section>;
}

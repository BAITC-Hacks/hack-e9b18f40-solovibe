"use client";
import {draftFingerprint} from '../../client/draft-key';
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { cityApi, errorCode } from "@/lib/city-api";
import { useScenario } from "../../client/scenario-context";
import { DEFAULT_CONSTRAINTS } from "../../data/akim-v1";
import type { ScenarioView } from "../../records";
import type { ComparisonView, PriceCondition, RevisionSnapshot, WorkshopSearchView } from "../../workshop-contracts";
import { Priorities } from "./Priorities";
import { Comparison, ConditionChecks, DecisionChanges, EvaluationSummary } from "./Comparison";
import { RevisionHistory } from "./RevisionHistory";
import "../../workshop.css";
const priceKeys: PriceCondition[] = ["minDirectDistricts", "maxCriticalPairs", "maxSpend", "requiredDirections", "locked", "excludedMeasureIds", "districtFloors", "indicatorFloors"];
const active = (s: WorkshopSearchView | null) => s?.status === "queued" || s?.status === "running";
const fingerprint = (c: ReturnType<typeof useScenario>) => draftFingerprint(c.decisions,c.constraints)+c.title;
export function WorkshopPanel() {
    const c = useScenario(), t = useTranslations("workshop"), te = useTranslations("errors"), domain = useTranslations("domain"), locale = useLocale();
    const [search, setSearch] = useState<WorkshopSearchView | null>(null), [source, setSource] = useState<RevisionSnapshot | null>(null), [searchInput, setSearchInput] = useState("");
    const [price, setPrice] = useState<PriceCondition | "">(""), [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [pollPaused, setPollPaused] = useState(false);
    const [selected, setSelected] = useState<string[]>([]), [comparison, setComparison] = useState<ComparisonView | null>(null), [compareBusy, setCompareBusy] = useState(false), [historyVersion, setHistoryVersion] = useState(0);
    const latest = useRef(c), mounted = useRef(true), requests = useRef(new Set<AbortController>()), mutation = useRef(false), searchEpoch = useRef(0), comparisonEpoch = useRef(0);
    useEffect(() => { latest.current = c; }, [c]);
    useEffect(() => { mounted.current = true; const pending = requests.current; return () => { mounted.current = false; pending.forEach(r => r.abort()); }; }, []);
    const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => { const a = new AbortController(); requests.current.add(a); try {
        return await cityApi<T>(path, { method, body, signal: a.signal });
    }
    finally {
        requests.current.delete(a);
    } }, []);
    const report = useCallback((e: unknown) => { if (!mounted.current)
        return; const code = errorCode(e); setProblem(te.has(code) ? te(code) : t("requestFailed")); }, [t, te]);
    const storageKey = `city-workshop-compare:${c.serverView.scenario.id}`;
    useEffect(() => { let disposed = false; queueMicrotask(() => { if (disposed)
        return; try {
        const ids = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(ids))
            setSelected(ids.filter((id): id is string => typeof id === "string").slice(0, 3));
    }
    catch { /* Storage can be unavailable. */ } }); return () => { disposed = true; }; }, [storageKey]);
    const toggle = (id: string) => { setSelected(ids => { const next = ids.includes(id) ? ids.filter(v => v !== id) : ids.length < 3 ? [...ids, id] : ids; try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
    }
    catch { } return next; }); setComparison(null); comparisonEpoch.current++; };
    const pollingId = active(search) ? search!.id : null;
    useEffect(() => {
        if (!pollingId || pollPaused)
            return;
        const id = pollingId, epoch = searchEpoch.current, a = new AbortController(), pending = requests.current;
        pending.add(a);
        let timer: ReturnType<typeof setTimeout>;
        let count = 0;
        const poll = async () => { try {
            const view = await cityApi<WorkshopSearchView>(`/searches/${id}`, { signal: a.signal });
            if (a.signal.aborted || epoch !== searchEpoch.current)
                return;
            setSearch(view);
            if (active(view)) {
                if (++count >= 150) {
                    setPollPaused(true);
                    return;
                }
                timer = setTimeout(poll, 2000);
            }
            else {
                setHistoryVersion(v => v + 1);
            }
        }
        catch (e) {
            if (!a.signal.aborted && epoch === searchEpoch.current) {
                report(e);
                setPollPaused(true);
            }
        } };
        timer = setTimeout(poll, 1000);
        return () => { clearTimeout(timer); a.abort(); pending.delete(a); };
    }, [pollingId, pollPaused, report]);
    const enabledPrices = priceKeys.filter(key => JSON.stringify(c.constraints[key] ?? []) !== JSON.stringify(DEFAULT_CONSTRAINTS[key] ?? []));
    const stale = !!search && (search.stale || searchInput !== draftFingerprint([],c.constraints) || search.inputRevisionId !== c.serverView.revision.id || c.isDirty);
    async function run() { if (mutation.current)
        return; mutation.current = true; setBusy(true); setProblem(null); setNotice(null); const epoch = ++searchEpoch.current; try {
        if (!await latest.current.flush()) {
            setProblem(t("saveFirst"));
            return;
        }
        if (!mounted.current)
            return;
        const saved = await request<ScenarioView>(`/scenarios/${latest.current.serverView.scenario.id}`);
        if (!mounted.current || epoch !== searchEpoch.current)
            return;
        if (latest.current.isDirty || draftFingerprint([],saved.revision.constraints) !== draftFingerprint([],latest.current.constraints)) {
            setProblem(t("saveFirst"));
            return;
        }
        setSource({ revision: saved.revision, evaluation: saved.evaluation });
        setSearchInput(draftFingerprint([],saved.revision.constraints));
        const result = await request<WorkshopSearchView>("/searches", "POST", { scenarioId: saved.scenario.id, inputRevisionId: saved.revision.id, constraints: saved.revision.constraints, limit: 3, clientRequestId: crypto.randomUUID(), ...(price && enabledPrices.includes(price) ? { priceCondition: price } : {}) });
        if (!mounted.current || epoch !== searchEpoch.current)
            return;
        setSearch(result);
        setPollPaused(false);
    }
    catch (e) {
        report(e);
    }
    finally {
        mutation.current = false;
        if (mounted.current)
            setBusy(false);
    } }
    async function cancel() { if (!search)
        return; setBusy(true); try {
        const view = await request<WorkshopSearchView>(`/searches/${search.id}/cancel`, "POST", {});
        if (mounted.current)
            setSearch(view);
    }
    catch (e) {
        report(e);
    }
    finally {
        if (mounted.current)
            setBusy(false);
    } }
    async function apply(id: string) { if (mutation.current)
        return; mutation.current = true; setBusy(true); setProblem(null); try {
        if (!await latest.current.flush()) {
            setProblem(t("saveFirst"));
            return;
        }
        if (!mounted.current)
            return;
        const saved = await request<ScenarioView>(`/scenarios/${latest.current.serverView.scenario.id}`);
        if (!mounted.current)
            return;
        const before = fingerprint(latest.current);
        if (latest.current.isDirty || latest.current.serverView.revision.id!==saved.revision.id) {
            setProblem(t("saveFirst"));
            return;
        }
        const result = await request<ScenarioView>(`/scenarios/${saved.scenario.id}/apply`, "POST", { revisionId: id, expectedRevisionId: saved.revision.id, clientMutationId: crypto.randomUUID() });
        if (!mounted.current)
            return;
        if (before === fingerprint(latest.current) && !latest.current.isDirty && latest.current.serverView.revision.id === saved.revision.id) {
            latest.current.acceptCanonical(result);
        }
        else {
            await latest.current.refresh();
            setNotice(t("localPreserved"));
        }
        setHistoryVersion(v => v + 1);
    }
    catch (e) {
        report(e);
        if (errorCode(e) === "STALE_REVISION") {
            await latest.current.refresh();
        }
    }
    finally {
        mutation.current = false;
        if (mounted.current)
            setBusy(false);
    } }
    async function fork(id: string) { if (mutation.current)
        return; mutation.current = true; setBusy(true); setProblem(null); try {
        const view = await request<ScenarioView>(`/scenarios/${latest.current.serverView.scenario.id}/forks`, "POST", { revisionId: id, clientMutationId: crypto.randomUUID() });
        if (mounted.current)
            setNotice(t("forked", { title: view.scenario.title }));
    }
    catch (e) {
        report(e);
    }
    finally {
        mutation.current = false;
        if (mounted.current)
            setBusy(false);
    } }
    async function compare() { const epoch = ++comparisonEpoch.current; setCompareBusy(true); setProblem(null); try {
        const view = await request<ComparisonView>("/comparisons", "POST", { revisionIds: selected });
        if (mounted.current && epoch === comparisonEpoch.current)
            setComparison(view);
    }
    catch (e) {
        report(e);
    }
    finally {
        if (mounted.current)
            setCompareBusy(false);
    } }
    const result = search?.result, baseline = search?.baseline?.candidates[0], candidate = result?.candidates[0];
    const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6, signDisplay: "exceptZero" }).format(v);
    return <div className="cbw-workshop"><Priorities /><section className="cbw-search" aria-labelledby="cbw-search-title"><header><h3 id="cbw-search-title">{t("alternatives")}</h3><p>{t("searchHint")}</p></header><div className="cbw-search-bar"><label>{t("priceCondition")}<select value={enabledPrices.includes(price as PriceCondition) ? price : ""} onChange={e => setPrice(e.target.value as PriceCondition | "")}><option value="">{t("ordinarySearch")}</option>{enabledPrices.map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label><Button loading={busy} disabled={active(search) || !!c.conflict} onClick={() => void run()}>{t("search")}</Button>{active(search) && <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>{t("cancel")}</Button>}</div>{price && enabledPrices.includes(price) && <p className="cbw-hint">{t("priceHint")}</p>}
 {problem && <p role="alert" className="cbw-warning">{problem}</p>}{notice && <p role="status">{notice}</p>}
 {search && <div className="cbw-search-state" role="status"><strong>{t(result?.status === "incomplete" ? "incomplete" : search.status)}</strong>{result && <span>{t("progress", { evaluated: result.evaluatedCount, feasible: result.feasibleCount })}</span>}{result?.certificate && <span>{t("exhaustive")}</span>}{search.errorCode && <span>{te.has(search.errorCode) ? te(search.errorCode) : t("requestFailed")}</span>}</div>}
 {pollPaused && active(search) && <Button variant="secondary" onClick={() => { setProblem(null); setPollPaused(false); }}>{t("resumeStatus")}</Button>}
 {stale && <p className="cbw-warning">{t("stale")}</p>}
 {result?.issues.map((issue, i) => <p className="cbw-warning" key={`${issue.code}-${i}`}>{t.has(`issue_${issue.code}`) ? t(`issue_${issue.code}`, Object.fromEntries(Object.entries(issue.params).map(([k, v]) => [k, typeof v === "boolean" ? String(v) : v]))) : domain.has(issue.code) ? domain(issue.code, Object.fromEntries(Object.entries(issue.params).map(([k, v]) => [k, typeof v === "boolean" ? String(v) : v]))) : t("constraintConflict", { code: issue.code })}</p>)}
 {result?.status === "complete" && !result.feasibleCount && <p>{t("infeasible")}</p>}
 {baseline && candidate && <div className="cbw-price"><h4>{t(result?.objective === "maxScore" && result.certificate && search?.baseline?.certificate ? "conditionPrice" : "conditionComparison")}</h4><p>{t("priceDelta")}: Score {baseline.evaluation.score !== null && candidate.evaluation.score !== null ? n(candidate.evaluation.score - baseline.evaluation.score) : "—"} · {t("cost")} {n(candidate.evaluation.cost - baseline.evaluation.cost)}</p><p className="cbw-hint">{t("priceEvidence")}</p><DecisionChanges source={baseline.decisions} target={candidate.decisions}/><p>{t("directDistricts")}: {baseline.evaluation.directDistrictIds.length} → {candidate.evaluation.directDistrictIds.length}</p></div>}
 <div className="cbw-candidates">{search?.alternatives.map((s, i) => <article className="cbw-card" key={s.revision.id}><h4>{s.revision.title || `${t("alternative")} ${i + 1}`}</h4><EvaluationSummary result={s.evaluation.result}/><ConditionChecks constraints={result?.constraints ?? s.revision.constraints} result={s.evaluation.result}/><details><summary>{t("inspect")}</summary><DecisionChanges source={source?.revision.decisions ?? []} target={s.revision.decisions}/></details><div className="cbw-actions"><Button disabled={busy || stale || !!c.conflict} onClick={() => void apply(s.revision.id)}>{t("apply")}</Button><Button variant="secondary" disabled={busy} onClick={() => void fork(s.revision.id)}>{t("fork")}</Button><label className="cbw-check"><input type="checkbox" checked={selected.includes(s.revision.id)} disabled={selected.length >= 3 && !selected.includes(s.revision.id)} onChange={() => toggle(s.revision.id)}/>{t("selectCompare")}</label></div></article>)}</div></section>
 <section className="cbw-compare-selection"><h3>{t("compareSelection")}</h3><p>{t("compareHint")}</p><div className="cbw-actions"><label className="cbw-check"><input type="checkbox" checked={selected.includes(c.serverView.revision.id)} disabled={selected.length >= 3 && !selected.includes(c.serverView.revision.id)} onChange={() => toggle(c.serverView.revision.id)}/>{t("current")}</label>{selected.map(id => <Button key={id} variant="quiet" onClick={() => toggle(id)}>{id.slice(0, 8)} · {t("remove")}</Button>)}<Button disabled={!selected.length} loading={compareBusy} onClick={() => void compare()}>{t("compare")} ({selected.length}/3)</Button></div>{comparison && <Comparison view={comparison}/>}</section>
 <RevisionHistory key={`${c.serverView.scenario.id}:${c.serverView.revision.id}:${historyVersion}`} scenarioId={c.serverView.scenario.id} activeRevisionId={c.serverView.revision.id} version={historyVersion} selected={selected} onSelect={toggle} onApply={apply} onFork={fork} busy={busy}/>
 </div>;
}

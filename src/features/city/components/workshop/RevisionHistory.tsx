"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { cityApi, errorCode } from "@/lib/city-api";
import type { RevisionSnapshot } from "../../workshop-contracts";
import { EvaluationSummary } from "./Comparison";
interface HistoryPage {
    items: RevisionSnapshot[];
    nextCursor: string | null;
}
interface Props {
    scenarioId: string;
    activeRevisionId: string;
    version: number;
    refreshKey?:string;
    selected: string[];
    onSelect: (id: string) => void;
    onApply: (id: string) => Promise<void>;
    onFork: (id: string) => Promise<void>;
    busy: boolean;
}
export function RevisionHistory({ scenarioId, activeRevisionId, refreshKey, selected, onSelect, onApply, onFork, busy }: Props) {
    const t = useTranslations("workshop"), te = useTranslations("errors"), locale = useLocale();
    const lastRefresh=useRef(refreshKey);
    const mutations = useRef(new Set<AbortController>());
    useEffect(() => { const pending = mutations.current; return () => pending.forEach(a => a.abort()); }, []);
    const [page, setPage] = useState<HistoryPage>({ items: [], nextCursor: null }), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [problem, setProblem] = useState<string | null>(null), [retry, setRetry] = useState(0), [rename, setRename] = useState<string | null>(null), [title, setTitle] = useState(""), [saving, setSaving] = useState(false);
    useEffect(() => {
        const a = new AbortController();
        const refreshHead=lastRefresh.current!==refreshKey;lastRefresh.current=refreshKey;
        queueMicrotask(() => {
            if (!a.signal.aborted) {
                setLoading(true);
                setProblem(null);
            }
        });
        cityApi<HistoryPage>(`/scenarios/${scenarioId}/history${cursor && !refreshHead ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { signal: a.signal }).then(next => {
            if (!a.signal.aborted)
                setPage(prior => refreshHead?{items:[...next.items,...prior.items.filter(s=>!next.items.some(n=>n.revision.id===s.revision.id))],nextCursor:prior.nextCursor??next.nextCursor}:({ items: cursor ? [...prior.items.filter(s => !next.items.some(n => n.revision.id === s.revision.id)), ...next.items] : next.items, nextCursor: next.nextCursor }));
        }).catch(e => {
            if (!a.signal.aborted) {
                const code = errorCode(e);
                setProblem(te.has(code) ? te(code) : t("requestFailed"));
            }
        }).finally(() => {
            if (!a.signal.aborted)
                setLoading(false);
        });
        return () => a.abort();
    }, [scenarioId, activeRevisionId, cursor, retry, t, te,refreshKey]);
    async function saveTitle(id: string) {
        if (!title.trim())
            return;
        setSaving(true);
        setProblem(null);
        const a = new AbortController();
        mutations.current.add(a);
        try {
            await cityApi(`/scenarios/${scenarioId}/history/${id}`, { method: "PATCH", body: { title: title.trim() }, signal: a.signal });
            if (a.signal.aborted)
                return;
            setPage(p => ({ ...p, items: p.items.map(s => s.revision.id === id ? { ...s, revision: { ...s.revision, title: title.trim() } } : s) }));
            setRename(null);
        }
        catch (e) {
            if (a.signal.aborted)
                return;
            const code = errorCode(e);
            setProblem(te.has(code) ? te(code) : t("requestFailed"));
        }
        finally {
            mutations.current.delete(a);
            if (!a.signal.aborted)
                setSaving(false);
        }
    }
    return <section className="cbw-history"><h3>{t("history")}</h3><p>{t("historyHint")}</p>{problem && <div role="alert"><p className="cbw-warning">{problem}</p><Button variant="secondary" onClick={() => setRetry(v => v + 1)}>{t("retry")}</Button></div>}<ol>{page.items.map(s => <li className="cbw-history-row" key={s.revision.id}><div className="cbw-history-heading"><h4>{s.revision.title || t("version")}</h4>{s.revision.id === activeRevisionId && <span className="cbw-tag">{t("current")}</span>}<time dateTime={s.revision.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.revision.createdAt))}</time></div><details className="cbw-version-source"><summary>{t("versionSource")}</summary><p className="cbw-hint">{t("origin")}: {t.has(`cause_${s.revision.cause}`) ? t(`cause_${s.revision.cause}`) : t("savedRevision")}{s.revision.sourceRevisionId && <> · {t("source")}: {s.revision.sourceRevisionId.slice(0, 8)}</>}</p></details><EvaluationSummary result={s.evaluation.result}/>{rename === s.revision.id ? <form className="cbw-search-bar" onSubmit={e => { e.preventDefault(); void saveTitle(s.revision.id); }}><label>{t("branchTitle")}<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} autoFocus/></label><Button type="submit" loading={saving} disabled={!title.trim()}>{t("save")}</Button><Button variant="quiet" disabled={saving} onClick={() => setRename(null)}>{t("cancel")}</Button></form> : <div className="cbw-actions"><Button variant="secondary" disabled={busy || s.revision.id === activeRevisionId} onClick={() => void onApply(s.revision.id)}>{t("restore")}</Button><Button variant="quiet" disabled={busy} onClick={() => void onFork(s.revision.id)}>{t("fork")}</Button><Button variant="quiet" onClick={() => { setRename(s.revision.id); setTitle(s.revision.title ?? ""); }}>{t("rename")}</Button><label className="cbw-check"><input type="checkbox" checked={selected.includes(s.revision.id)} disabled={selected.length >= 3 && !selected.includes(s.revision.id)} onChange={() => onSelect(s.revision.id)}/>{t("selectCompare")}</label></div>}</li>)}</ol>{!loading && !page.items.length && !problem && <p>{t("emptyHistory")}</p>}{loading && <p role="status">{t("loading")}</p>}{page.nextCursor && <Button variant="secondary" loading={loading} onClick={() => setCursor(page.nextCursor)}>{t("more")}</Button>}</section>;
}

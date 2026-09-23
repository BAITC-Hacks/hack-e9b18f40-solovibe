"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { errorCode } from "@/lib/city-api";
import type { ArtifactRecord } from "../../artifact-contracts";
import type { ShareRecord } from "../../sharing-contracts";
import { aborted, useDeliveryRequests } from "./requests";
import { SharedComparisonPanel } from "./SharedComparisonPanel";
import "../../delivery.css";
interface Props {
    scenarioId: string;
    revisionId: string;
    briefId?: string;
    briefVersion?: number;
    htmlReady?: boolean;
}
export function DeliveryPanel({ scenarioId, revisionId, briefId, briefVersion, htmlReady = false }: Props) {
    const t = useTranslations("delivery"), te = useTranslations("errors"), locale = useLocale(), { request, download, sessionChanged } = useDeliveryRequests();
    const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]), [shares, setShares] = useState<ShareRecord[]>([]), [selected, setSelected] = useState<string[]>([]), [includeBrief, setIncludeBrief] = useState(false), [teamName, setTeamName] = useState("");
    const [observedAt,setObservedAt]=useState(0);
    const [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null), [link, setLink] = useState<{
        id: string;
        url: string;
    } | null>(null), [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false);
    const epoch=useRef(0);
    const alive = useRef(true), mutating = useRef(false), ids = useRef(new Map<string, string>());
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const report = useCallback((error: unknown) => { if (!alive.current || aborted(error))
        return; const code = errorCode(error); setProblem(te.has(code) ? te(code) : t("requestFailed")); }, [te, t]);
    useEffect(() => { let cancelled = false; const observed=epoch.current; Promise.all([request<{
            items: ArtifactRecord[];
        }>(`/artifacts?scenarioId=${scenarioId}`), request<{
            items: ShareRecord[];
        }>(`/shares?scenarioId=${scenarioId}`)]).then(([files, saved]) => { if (!cancelled && observed===epoch.current) {
        setArtifacts(files.items);
        setShares(saved.items);setObservedAt(Date.now());
    } }).catch(error => { if (!cancelled)
        report(error); }); return () => { cancelled = true; }; }, [scenarioId, revisionId, refresh, report, request]);
    const hasPending = artifacts.some(a => a.state === "pending");
    useEffect(() => { if (!hasPending || paused)
        return; let cancelled = false, count = 0, timer: ReturnType<typeof setTimeout>; const poll = async () => { try {
        const observed=epoch.current;
        const result = await request<{
            items: ArtifactRecord[];
        }>(`/artifacts?scenarioId=${scenarioId}`);
        if (cancelled)
            return;
        if(observed===epoch.current)setArtifacts(result.items);
        if (result.items.some(a => a.state === "pending")) {
            if (++count >= 60)
                setPaused(true);
            else
                timer = setTimeout(poll, 2000);
        }
    }
    catch (error) {
        if (!cancelled) {
            report(error);
            setPaused(true);
        }
    } }; timer = setTimeout(poll, 1500); return () => { cancelled = true; clearTimeout(timer); }; }, [hasPending, paused, scenarioId, request, report]);
    const tokenFor = (key: string) => { let id = ids.current.get(key); if (!id) {
        id = crypto.randomUUID();
        ids.current.set(key, id);
    } return id; };
    async function act(work: () => Promise<void>) { if (mutating.current)
        return; mutating.current = true;epoch.current++; setBusy(true); setProblem(null); try {
        await work();
    }
    catch (error) {
        report(error);
    }
    finally {
        mutating.current = false;
        if (alive.current){setBusy(false);setRefresh(v=>v+1);}
    } }
    const withBrief = includeBrief && htmlReady && !!briefId && !!briefVersion;
    const eligible = artifacts.filter(a => a.state === "ready" && a.revisionId === revisionId && (!a.briefId || (withBrief && a.briefId === briefId && a.briefVersion === briefVersion)));
    async function generate(kind: ArtifactRecord["kind"], source?: ArtifactRecord) { await act(async () => { const input = { revisionId: source?.revisionId ?? revisionId, kind, locale: source?.locale ?? locale, ...(kind === "html" ? { briefId: source?.briefId ?? briefId, briefVersion: source?.briefVersion ?? briefVersion } : {}) }; const key = JSON.stringify(input); const result = await request<ArtifactRecord>("/artifacts", "POST", { ...input, clientMutationId: tokenFor(key) }); if (!alive.current)
        return; ids.current.delete(key); setArtifacts(items => [result, ...items.filter(a => a.id !== result.id)]); setPaused(false); }); }
    async function removeArtifact(id: string) { await act(async () => { await request(`/artifacts/${id}`, "DELETE"); if (!alive.current)
        return; setArtifacts(items => items.filter(a => a.id !== id)); setSelected(items => items.filter(v => v !== id)); }); }
    async function publish() { await act(async () => { const artifactIds = eligible.filter(a => selected.includes(a.id)).map(a => a.id); const input = { revisionId, teamName: teamName.trim(), artifactIds, ...(withBrief ? { briefId, briefVersion } : {}) }; const key = JSON.stringify(input); const result = await request<{
        share: ShareRecord;
        token: string | null;
    }>("/shares", "POST", { ...input, clientMutationId: tokenFor(key) }); if (!alive.current)
        return; ids.current.delete(key); setObservedAt(Date.now());setShares(items => [result.share, ...items.filter(s => s.id !== result.share.id)]); setLink(result.token ? { id: result.share.id, url: `${window.location.origin}/${locale}/share/${result.token}` } : null); setCopied(false); setCopyFailed(false); if (!result.token)
        setProblem(t("tokenUnavailable")); }); }
    async function revoke(id: string) { await act(async () => { await request(`/shares/${id}`, "DELETE"); if (!alive.current)
        return; setShares(items => items.map(s => s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s)); if (link?.id === id)
        setLink(null); }); }
    async function copy() { if (!link)
        return; try {
        await navigator.clipboard.writeText(link.url);
        setCopied(true);
        setCopyFailed(false);
    }
    catch {
        setCopied(false);
        setCopyFailed(true);
    } }
    if (sessionChanged)
        return <p>{t("sessionChanged")}</p>;
    return <div className="cbd-delivery"><section><h3>{t("exports")}</h3><p>{t("exportHint")}</p><p className="cbd-hint">{t("revision")}: {revisionId}{briefVersion && <> · {t("briefVersion")}: {briefVersion}</>}</p><div className="cbd-actions"><Button disabled={busy} onClick={() => void generate("json")}>{t("exportJson")}</Button><Button disabled={busy} variant="secondary" onClick={() => void generate("csv")}>{t("exportCsv")}</Button>{htmlReady && briefId && briefVersion && <Button disabled={busy} variant="secondary" onClick={() => void generate("html")}>{t("exportHtml")}</Button>}</div><p className="cbd-hint">{t("retention")}</p>{problem && <p role="alert" className="cbd-warning">{problem}</p>}<div className="cbd-file-list">{artifacts.filter(a => a.state !== "deleted").map(a => <article key={a.id}><div><strong>{a.kind.toUpperCase()} · {a.locale}</strong><span className="cbd-tag">{t(a.state)}</span><p className="cbd-hint">{t("revision")}: {a.revisionId.slice(0, 8)}{a.briefVersion && <> · {t("briefVersion")}: {a.briefVersion}</>}{a.size !== null && <> · {new Intl.NumberFormat(locale).format(a.size)} {t("bytes")}</>}</p>{a.errorCode && <p className="cbd-warning">{te.has(a.errorCode) ? te(a.errorCode) : t("exportFailed")}</p>}</div><div className="cbd-actions">{a.state === "ready" && <Button variant="secondary" disabled={busy} onClick={() => void act(() => download(`/artifacts/${a.id}/download`, `citybalance-${a.revisionId.slice(0, 8)}.${a.kind}`))}>{t("download")}</Button>}{a.state === "failed" && <Button variant="secondary" disabled={busy} onClick={() => void generate(a.kind, a)}>{t("retrySource")}</Button>}{a.state !== "deleting" && <Button variant="quiet" disabled={busy} onClick={() => void removeArtifact(a.id)}>{t("deleteFile")}</Button>}</div></article>)}</div>{!artifacts.length && <p>{t("noFiles")}</p>}<Button variant="quiet" disabled={busy} onClick={() => { setPaused(false); setRefresh(v => v + 1); }}>{t(paused ? "resume" : "refresh")}</Button></section>
 <section><h3>{t("shareTitle")}</h3><p>{t("shareHint")}</p><label>{t("teamName")}<input maxLength={80} value={teamName} onChange={e => setTeamName(e.target.value)}/></label>{htmlReady && briefId && briefVersion && <label className="cbd-check"><input type="checkbox" checked={includeBrief} onChange={e => setIncludeBrief(e.target.checked)}/>{t("includeBrief", { version: briefVersion })}</label>}<fieldset><legend>{t("chooseFiles")}</legend>{eligible.length ? eligible.map(a => <label className="cbd-check" key={a.id}><input type="checkbox" checked={selected.includes(a.id)} disabled={!selected.includes(a.id) && eligible.filter(a => selected.includes(a.id)).length >= 10} onChange={e => setSelected(ids => e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))}/>{a.kind.toUpperCase()} · {a.locale} · {a.id.slice(0, 8)}</label>) : <p className="cbd-hint">{t("noEligibleFiles")}</p>}</fieldset><div className="cbd-publication"><h4>{t("publication")}</h4><ul><li>{t("revision")}: {revisionId}</li><li>{t("publicDecisions")}</li>{withBrief && <li>{t("includeBrief", { version: briefVersion! })}</li>}{eligible.filter(a => selected.includes(a.id)).map(a => <li key={a.id}>{a.kind.toUpperCase()} · {a.locale} · {a.id.slice(0, 8)}</li>)}<li>{t("expiry30")}</li></ul></div><Button disabled={busy} onClick={() => void publish()}>{t("publish")}</Button>{link && <div className="cbd-link"><label>{t("shareLink")}<input value={link.url} readOnly onFocus={e => e.target.select()}/></label><Button variant="secondary" onClick={() => void copy()}>{t(copied ? "copied" : "copy")}</Button>{copyFailed && <p role="status">{t("copyFallback")}</p>}</div>}
 <div className="cbd-share-list">{shares.map(s => { const expired = Date.parse(s.expiresAt) <= observedAt, inactive = !!s.revokedAt || expired; return <article key={s.id}><div><h4>{s.teamName || t("unnamedTeam")}</h4><p className="cbd-hint">{t("revision")}: {s.revisionId.slice(0, 8)} · {t("expires")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(s.expiresAt))}</p><p>{t(s.revokedAt ? "revoked" : expired ? "expired" : "active")}</p></div>{!inactive && <Button variant="secondary" disabled={busy} onClick={() => void revoke(s.id)}>{t("revoke")}</Button>}</article>; })}</div><p className="cbd-hint">{t("revokeHint")}</p></section><SharedComparisonPanel /></div>;
}

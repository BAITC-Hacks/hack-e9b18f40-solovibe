"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileArchive, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { errorCode } from "@/lib/city-api";
import type { ArtifactRecord } from "../../artifact-contracts";
import type { ShareRecord } from "../../sharing-contracts";
import { aborted, useDeliveryRequests } from "./requests";
import { SharedComparisonPanel } from "./SharedComparisonPanel";
import "../../delivery.css";

export type DeliverySection = "files" | "share" | "teams";
interface Props {
  scenarioId: string; revisionId: string; briefId?: string; briefVersion?: number; htmlReady?: boolean;
  activeSection?: DeliverySection; onSectionChange?: (section: DeliverySection) => void;
}
const tabs: { id: DeliverySection; Icon: typeof Download; label: "filesTab" | "shareTab" | "teamsTab" }[] = [
  { id: "files", Icon: Download, label: "filesTab" }, { id: "share", Icon: Share2, label: "shareTab" }, { id: "teams", Icon: Users, label: "teamsTab" },
];

export function DeliveryPanel({ scenarioId, revisionId, briefId, briefVersion, htmlReady = false, activeSection, onSectionChange }: Props) {
  const t = useTranslations("delivery"), te = useTranslations("errors"), locale = useLocale();
  const { request, download, sessionChanged } = useDeliveryRequests();
  const tabId = useId().replaceAll(":", "");
  const [localSection, setLocalSection] = useState<DeliverySection>("files");
  const section = activeSection ?? localSection;
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]), [shares, setShares] = useState<ShareRecord[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [includeBrief, setIncludeBrief] = useState(false), [teamName, setTeamName] = useState(""), [observedAt, setObservedAt] = useState(0);
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null), [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false);
  const epoch = useRef(0), alive = useRef(true), mutating = useRef(false), ids = useRef(new Map<string, string>());

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const report = useCallback((error: unknown) => {
    if (!alive.current || aborted(error)) return;
    const code = errorCode(error); setProblem(te.has(code) ? te(code) : t("requestFailed"));
  }, [te, t]);
  useEffect(() => {
    let cancelled = false; const observed = epoch.current;
    Promise.all([request<{ items: ArtifactRecord[] }>(`/artifacts?scenarioId=${scenarioId}`), request<{ items: ShareRecord[] }>(`/shares?scenarioId=${scenarioId}`)])
      .then(([files, saved]) => { if (!cancelled && observed === epoch.current) { setArtifacts(files.items); setShares(saved.items); setObservedAt(Date.now()); } })
      .catch((error) => { if (!cancelled) report(error); });
    return () => { cancelled = true; };
  }, [scenarioId, revisionId, refresh, report, request]);
  const hasPending = artifacts.some((artifact) => artifact.state === "pending");
  useEffect(() => {
    if (!hasPending || paused) return;
    let cancelled = false, count = 0, timer: ReturnType<typeof setTimeout>;
    const poll = async () => { try {
      const observed = epoch.current, result = await request<{ items: ArtifactRecord[] }>(`/artifacts?scenarioId=${scenarioId}`);
      if (cancelled) return; if (observed === epoch.current) setArtifacts(result.items);
      if (result.items.some((artifact) => artifact.state === "pending")) { if (++count >= 60) setPaused(true); else timer = setTimeout(poll, 2000); }
    } catch (error) { if (!cancelled) { report(error); setPaused(true); } } };
    timer = setTimeout(poll, 1500); return () => { cancelled = true; clearTimeout(timer); };
  }, [hasPending, paused, scenarioId, request, report]);

  function selectSection(next: DeliverySection) { setLocalSection(next); setProblem(null); onSectionChange?.(next); }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: DeliverySection) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === current);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex].id;
    selectSection(next);
    requestAnimationFrame(() => document.getElementById(`${tabId}-tab-${next}`)?.focus());
  }
  function tokenFor(key: string) { let id = ids.current.get(key); if (!id) { id = crypto.randomUUID(); ids.current.set(key, id); } return id; }
  async function act(work: () => Promise<void>) {
    if (mutating.current) return; mutating.current = true; epoch.current++; setBusy(true); setProblem(null);
    try { await work(); } catch (error) { report(error); } finally { mutating.current = false; if (alive.current) { setBusy(false); setRefresh((value) => value + 1); } }
  }
  const withBrief = includeBrief && htmlReady && Boolean(briefId) && Boolean(briefVersion);
  const eligible = artifacts.filter((artifact) => artifact.state === "ready" && artifact.revisionId === revisionId && (!artifact.briefId || (withBrief && artifact.briefId === briefId && artifact.briefVersion === briefVersion)));
  async function generate(kind: ArtifactRecord["kind"], source?: ArtifactRecord) { await act(async () => {
    const input = { revisionId: source?.revisionId ?? revisionId, kind, locale: source?.locale ?? locale, ...(kind === "html" ? { briefId: source?.briefId ?? briefId, briefVersion: source?.briefVersion ?? briefVersion } : {}) };
    const key = JSON.stringify(input), result = await request<ArtifactRecord>("/artifacts", "POST", { ...input, clientMutationId: tokenFor(key) });
    if (!alive.current) return; ids.current.delete(key); setArtifacts((items) => [result, ...items.filter((artifact) => artifact.id !== result.id)]); setPaused(false);
  }); }
  async function removeArtifact(id: string) { await act(async () => { await request(`/artifacts/${id}`, "DELETE"); if (!alive.current) return; setArtifacts((items) => items.filter((artifact) => artifact.id !== id)); setSelected((items) => items.filter((value) => value !== id)); }); }
  async function publish() { await act(async () => {
    const artifactIds = eligible.filter((artifact) => selected.includes(artifact.id)).map((artifact) => artifact.id), input = { revisionId, teamName: teamName.trim(), artifactIds, ...(withBrief ? { briefId, briefVersion } : {}) }, key = JSON.stringify(input);
    const result = await request<{ share: ShareRecord; token: string | null }>("/shares", "POST", { ...input, clientMutationId: tokenFor(key) });
    if (!alive.current) return; ids.current.delete(key); setObservedAt(Date.now()); setShares((items) => [result.share, ...items.filter((share) => share.id !== result.share.id)]); setLink(result.token ? { id: result.share.id, url: `${window.location.origin}/${locale}/share/${result.token}` } : null); setCopied(false); setCopyFailed(false); if (!result.token) setProblem(t("tokenUnavailable"));
  }); }
  async function revoke(id: string) { await act(async () => { await request(`/shares/${id}`, "DELETE"); if (!alive.current) return; setShares((items) => items.map((share) => share.id === id ? { ...share, revokedAt: new Date().toISOString() } : share)); if (link?.id === id) setLink(null); }); }
  async function copy() { if (!link) return; try { await navigator.clipboard.writeText(link.url); setCopied(true); setCopyFailed(false); } catch { setCopied(false); setCopyFailed(true); } }
  if (sessionChanged) return <p>{t("sessionChanged")}</p>;
  const visibleArtifacts = artifacts.filter((artifact) => artifact.state !== "deleted");

  return <section className="cbd-delivery" aria-labelledby={`${tabId}-title`}>
    <header className="cbd-delivery__header"><div><h2 id={`${tabId}-title`}>{t("deliveryTitle")}</h2><p>{t("deliveryHint")}</p></div><p className="cbd-source-summary"><FileArchive aria-hidden="true"/><span>{t("sourceSnapshot")}</span><strong>{revisionId.slice(0, 8)}</strong>{briefVersion ? <span>{t("briefVersion")}: {briefVersion}</span> : null}</p></header>
    <div className="cbd-tabs" role="tablist" aria-label={t("deliverySections")}>{tabs.map(({ id, Icon, label }) => <button key={id} id={`${tabId}-tab-${id}`} type="button" role="tab" aria-selected={section === id} aria-controls={`${tabId}-panel-${id}`} tabIndex={section === id ? 0 : -1} onClick={() => selectSection(id)} onKeyDown={(event) => moveTab(event, id)}><Icon aria-hidden="true"/><span>{t(label)}</span></button>)}</div>
    {problem ? <p role="alert" className="cbd-warning">{problem}</p> : null}

    <div id={`${tabId}-panel-files`} role="tabpanel" aria-labelledby={`${tabId}-tab-files`} hidden={section !== "files"}>
      <div className="cbd-panel-intro"><div><h3>{t("exports")}</h3><p>{t("exportHint")}</p></div></div>
      <div className="cbd-format-list"><div><strong>JSON</strong><p>{t("formatJsonHint")}</p><Button disabled={busy} onClick={() => void generate("json")}>{t("exportJson")}</Button></div><div><strong>CSV</strong><p>{t("formatCsvHint")}</p><Button disabled={busy} variant="secondary" onClick={() => void generate("csv")}>{t("exportCsv")}</Button></div><div className={!htmlReady || !briefId || !briefVersion ? "is-unavailable" : ""}><strong>HTML</strong><p>{htmlReady && briefId && briefVersion ? t("formatHtmlHint") : t("formatHtmlUnavailable")}</p>{htmlReady && briefId && briefVersion ? <Button disabled={busy} variant="secondary" onClick={() => void generate("html")}>{t("exportHtml")}</Button> : null}</div></div>
      <p className="cbd-hint">{t("retention")}</p><div className="cbd-list-heading"><h4>{t("readyFiles")}</h4><Button variant="quiet" disabled={busy} onClick={() => { setPaused(false); setRefresh((value) => value + 1); }}>{t(paused ? "resume" : "refresh")}</Button></div>
      <div className="cbd-file-list">{visibleArtifacts.map((artifact) => <article key={artifact.id}><div><strong>{artifact.kind.toUpperCase()} <span>{artifact.locale.toUpperCase()}</span></strong><span className="cbd-tag">{t(artifact.state)}</span><p className="cbd-hint">{t("revision")}: {artifact.revisionId.slice(0, 8)} · {artifact.briefVersion ? `${t("briefVersion")}: ${artifact.briefVersion}` : t("sourcePlanOnly")}{artifact.size !== null ? ` · ${new Intl.NumberFormat(locale).format(artifact.size)} ${t("bytes")}` : ""}</p>{artifact.errorCode ? <p className="cbd-warning">{te.has(artifact.errorCode) ? te(artifact.errorCode) : t("exportFailed")}</p> : null}</div><div className="cbd-actions">{artifact.state === "ready" ? <Button variant="secondary" disabled={busy} onClick={() => void act(() => download(`/artifacts/${artifact.id}/download`, `citybalance-${artifact.revisionId.slice(0, 8)}.${artifact.kind}`))}>{t("download")}</Button> : null}{artifact.state === "failed" ? <Button variant="secondary" disabled={busy} onClick={() => void generate(artifact.kind, artifact)}>{t("retrySource")}</Button> : null}{artifact.state !== "deleting" ? <Button variant="quiet" disabled={busy} onClick={() => void removeArtifact(artifact.id)}>{t("deleteFile")}</Button> : null}</div></article>)}</div>
      {!visibleArtifacts.length ? <p className="cbd-empty">{t("noFiles")}</p> : null}
    </div>

    <div id={`${tabId}-panel-share`} role="tabpanel" aria-labelledby={`${tabId}-tab-share`} hidden={section !== "share"}>
      <div className="cbd-panel-intro"><div><h3>{t("shareTitle")}</h3><p>{t("shareHint")}</p></div></div>
      <div className="cbd-publication"><h4>{t("sharePreviewTitle")}</h4><p>{t("sharePreviewBody")}</p><ul><li>{t("publicDecisions")}</li>{withBrief ? <li>{t("includeBrief", { version: briefVersion! })}</li> : null}<li>{t("expiry30")}</li></ul></div>
      <label>{t("teamName")}<input maxLength={80} value={teamName} onChange={(event) => setTeamName(event.target.value)}/></label>{htmlReady && briefId && briefVersion ? <label className="cbd-check"><input type="checkbox" checked={includeBrief} onChange={(event) => setIncludeBrief(event.target.checked)}/>{t("includeBrief", { version: briefVersion })}</label> : null}
      <fieldset><legend>{t("chooseFiles")}</legend>{eligible.length ? eligible.map((artifact) => <label className="cbd-check" key={artifact.id}><input type="checkbox" checked={selected.includes(artifact.id)} disabled={!selected.includes(artifact.id) && eligible.filter((item) => selected.includes(item.id)).length >= 10} onChange={(event) => setSelected((items) => event.target.checked ? [...items, artifact.id] : items.filter((id) => id !== artifact.id))}/>{artifact.kind.toUpperCase()} {artifact.locale.toUpperCase()}{artifact.size !== null ? `, ${new Intl.NumberFormat(locale).format(artifact.size)} ${t("bytes")}` : ""}</label>) : <p className="cbd-hint">{t("noEligibleFiles")}</p>}</fieldset>
      <Button disabled={busy} onClick={() => void publish()}>{t("publish")}</Button>{link ? <div className="cbd-link"><label>{t("shareLink")}<input value={link.url} readOnly onFocus={(event) => event.target.select()}/></label><Button variant="secondary" onClick={() => void copy()}>{t(copied ? "copied" : "copy")}</Button>{copyFailed ? <p role="status">{t("copyFallback")}</p> : null}</div> : null}
      <div className="cbd-list-heading"><h4>{t("publishedSnapshots")}</h4></div><div className="cbd-share-list">{shares.map((share) => { const expired = Date.parse(share.expiresAt) <= observedAt, inactive = Boolean(share.revokedAt) || expired; return <article key={share.id}><div><h4>{share.teamName || t("unnamedTeam")}</h4><p className="cbd-hint">{t("revision")}: {share.revisionId.slice(0, 8)} · {t("expires")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(share.expiresAt))}</p><p>{t(share.revokedAt ? "revoked" : expired ? "expired" : "active")}</p></div>{!inactive ? <Button variant="secondary" disabled={busy} onClick={() => void revoke(share.id)}>{t("revoke")}</Button> : null}</article>; })}</div><p className="cbd-hint">{t("revokeHint")}</p>
    </div>

    <div id={`${tabId}-panel-teams`} role="tabpanel" aria-labelledby={`${tabId}-tab-teams`} hidden={section !== "teams"}><p className="cbd-team-purpose">{t("teamsPurpose")}</p><SharedComparisonPanel/></div>
  </section>;
}

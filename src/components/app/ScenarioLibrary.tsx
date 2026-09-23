"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Copy, Pencil, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import { AppHeader } from "./AppHeader";
import { StartActions } from "./StartActions";
import { Link, useRouter } from "@/i18n/navigation";
import { cityApi, errorCode } from "@/lib/city-api";
import type { ScenarioList, ScenarioView } from "@/features/city/records";

export function ScenarioLibrary({ initial }: { initial: ScenarioList }) {
  const t = useTranslations(); const locale = useLocale(); const router = useRouter();
  const [data, setData] = useState(initial); const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); const [title, setTitle] = useState(""); const [deleting, setDeleting] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const request = useRef(0); const forkId = useRef<{id:string;mutation:string}|null>(null);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  async function search(value: string, cursor?: string) {
    const generation = ++request.current; setBusy("search"); setError(null);
    try {
      const params = new URLSearchParams({ q: value }); if (cursor) params.set("cursor", cursor);
      const result = await cityApi<ScenarioList>(`/scenarios?${params}`);
      if (request.current === generation) setData(old => cursor ? { ...result, items: [...old.items, ...result.items] } : result);
    } catch (e) { if (request.current === generation) setError(errorCode(e)); }
    finally { if (request.current === generation) setBusy(null); }
  }
  async function act(id: string, action: "rename" | "delete" | "fork") {
    if (busy) return; setBusy(id); setError(null); ++request.current;
    try {
      if (action === "delete") {
        await cityApi(`/scenarios/${id}`, { method: "DELETE", body: {} });
        setData(old => ({ ...old, items: old.items.filter(p => p.id !== id) })); setDeleting(null);
      } else if (action === "rename") {
        const result = await cityApi<ScenarioView>(`/scenarios/${id}`, { method: "PATCH", body: { title } });
        setData(old => ({ ...old, items: old.items.map(p => p.id === id ? { ...p, ...result.scenario } : p) })); setEditing(null);
      } else {
        if (forkId.current?.id !== id) forkId.current = { id, mutation: crypto.randomUUID() };
        const result = await cityApi<ScenarioView>(`/scenarios/${id}/forks`, { method: "POST", body: { clientMutationId: forkId.current.mutation } });
        router.push(`/city/${result.scenario.id}`);
      }
    } catch (e) { setError(errorCode(e)); }
    finally { setBusy(null); }
  }
  return <main className="page-shell"><AppHeader />
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6"><div><h1 className="mb-3 text-4xl">{t("app.library")}</h1><p className="mb-0 max-w-xl text-muted">{t("app.libraryIntro")}</p></div><StartActions /></div>
    {data.principalKind === "guest" && <div className="mb-6"><Alert>{t("app.guestRetention")} <Link href="/sign-up" className="font-semibold underline">{t("app.signUp")}</Link></Alert></div>}
    <div className="mb-6 max-w-md"><Input label={t("app.searchPlans")} value={query} onChange={e => { const value=e.target.value; setQuery(value); if(timer.current)clearTimeout(timer.current); timer.current=setTimeout(()=>search(value),300); }} /></div>
    {error && <div className="mb-6"><Alert tone="danger">{t(`errors.${error}`)} <Button variant="quiet" onClick={()=>search(query)}>{t("common.retry")}</Button></Alert></div>}
    {!data.items.length ? <section className="surface px-6 py-14 text-center"><h2 className="text-2xl">{query ? t("app.noSearch") : t("app.emptyTitle")}</h2><p className="mb-0 text-muted">{!query && t("app.emptyText")}</p></section> :
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy={busy==="search"}>
        {data.items.map(p=><article key={p.id} className="surface flex flex-col p-6">
          {editing===p.id ? <form className="mb-4 space-y-3" onSubmit={e=>{e.preventDefault();void act(p.id,"rename");}}><Input label={t("app.planTitle")} value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required autoFocus/><div className="flex gap-2"><Button type="submit" size="compact" loading={busy===p.id}>{t("common.save")}</Button><Button variant="quiet" onClick={()=>setEditing(null)}>{t("common.cancel")}</Button></div></form> : <h2 className="mb-5 break-words text-xl"><Link href={`/city/${p.id}`} className="hover:underline">{p.title}</Link></h2>}
          <div className="mb-6 grid grid-cols-2 gap-4"><div className="text-sm text-muted">{t("common.cost")}<strong className="number block text-2xl text-ink">{number.format(p.cost)}<span className="text-sm font-normal"> / 100</span></strong></div><div className="text-sm text-muted">{t("common.score")}<strong className="number block text-2xl text-accent">{p.score===null?t("app.draft"):number.format(p.score)}</strong></div></div>
          <p className="mb-5 text-sm text-muted">{t("app.decisionCount",{count:p.decisionCount})}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2"><Link href={`/city/${p.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent">{t("app.open")}<ArrowUpRight size={18}/></Link><div className="flex"><Button variant="quiet" size="icon" aria-label={t("app.rename")} onClick={()=>{setEditing(p.id);setTitle(p.title);}}><Pencil size={17}/></Button><Button variant="quiet" size="icon" aria-label={t("app.fork")} disabled={!!busy} onClick={()=>act(p.id,"fork")}><Copy size={17}/></Button><Button variant="quiet" size="icon" aria-label={t("common.remove")} onClick={()=>setDeleting(p.id)}><Trash2 size={17}/></Button></div></div>
          {deleting===p.id && <div className="mt-4 rounded-2xl bg-[var(--inset)] p-4"><p className="text-sm">{t("app.deleteConfirm")}</p><div className="flex flex-wrap gap-2"><Button variant="danger" size="compact" loading={busy===p.id} onClick={()=>act(p.id,"delete")}>{t("common.remove")}</Button><Button variant="quiet" onClick={()=>setDeleting(null)}>{t("common.cancel")}</Button></div></div>}
        </article>)}
      </section>}
    {data.nextCursor && <div className="mt-6 text-center"><Button variant="secondary" loading={busy==="search"} onClick={()=>search(query,data.nextCursor!)}>{t("app.loadMore")}</Button></div>}
  </main>;
}

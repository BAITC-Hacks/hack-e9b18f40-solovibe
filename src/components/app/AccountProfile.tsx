"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input } from "@/components/ui";
import { AppHeader } from "./AppHeader";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { SignOutButton } from "./AccountControl";
export function AccountProfile({ user, returnTo }: { user: { name: string; email: string }; returnTo: string }) {
  const t=useTranslations(); const [name,setName]=useState(user.name); const [savedName,setSavedName]=useState(user.name);
  const [pending,setPending]=useState(false); const [error,setError]=useState(false); const [saved,setSaved]=useState(false);
  const draftKey=`citybalance:profile-draft:${user.email}`;
  useEffect(()=>{
    let active=true;
    try { const draft=JSON.parse(sessionStorage.getItem(draftKey)||"null") as {name?:string;base?:string}|null;
      if(draft?.base===user.name&&typeof draft.name==="string")queueMicrotask(()=>{if(active)setName(draft.name!.slice(0,100));});
    } catch { /* The form remains usable when browser storage is restricted. */ }
    return()=>{active=false;};
  },[draftKey,user.name]);
  async function save(event:React.FormEvent){event.preventDefault();setPending(true);setError(false);setSaved(false);
    try{const result=await authClient.updateUser({name:name.trim()});if(result.error){setError(true);return;}setSavedName(name.trim());setSaved(true);try{sessionStorage.removeItem(draftKey);}catch{}}catch{setError(true);}finally{setPending(false);}
  }
  return <main className="page-shell"><AppHeader/><section className="surface mx-auto max-w-xl p-6 sm:p-9"><h1 className="text-3xl">{t("app.account")}</h1><p className="text-muted">{t("app.profileIntro")}</p><form onSubmit={save} className="space-y-5"><Input label={t("app.name")} value={name} onChange={e=>{setName(e.target.value);setSaved(false);try{sessionStorage.setItem(draftKey,JSON.stringify({name:e.target.value,base:savedName}));}catch{}}} required minLength={1} maxLength={100}/><div><span className="block text-sm font-semibold">{t("app.email")}</span><p className="mt-2 break-all">{user.email}</p></div>{error&&<Alert tone="danger">{t("app.profileError")}</Alert>}{saved&&<Alert tone="success">{t("common.saved")}</Alert>}<Button type="submit" loading={pending} disabled={!name.trim()||name.trim()===savedName}>{t("common.save")}</Button></form><div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"><Link href={returnTo} className="font-semibold text-accent">{t("app.returnToWork")}</Link><SignOutButton/></div></section></main>;
}

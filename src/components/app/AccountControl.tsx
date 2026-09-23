"use client";
import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { LogOut, UserRound } from "lucide-react";
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ beforeSignOut }: { beforeSignOut?: () => Promise<boolean> }) {
  const t=useTranslations(); const router=useRouter();
  const [open,setOpen]=useState(false); const [pending,setPending]=useState(false); const [error,setError]=useState(false);
  async function signOut() {
    if(pending)return;
    setPending(true);setError(false);
    try {
      if(beforeSignOut && !await beforeSignOut()){setOpen(false);return;}
      const result=await authClient.signOut();
      if(result.error){setError(true);return;}
      try { for(const key of Object.keys(sessionStorage))if(key.startsWith("citybalance:"))sessionStorage.removeItem(key); } catch { /* Storage restrictions must not turn a successful logout into an error. */ }
      if("BroadcastChannel" in window){const channel=new BroadcastChannel("citybalance-session");channel.postMessage({changed:true});channel.close();}
      setOpen(false);router.replace("/");router.refresh();
    }catch{setError(true);}finally{setPending(false);}
  }
  return <Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="quiet" size="compact"><LogOut size={16}/>{t("app.signOut")}</Button></DialogTrigger>
    <DialogContent closeLabel={t("common.close")}><DialogTitle>{t("app.signOutConfirm")}</DialogTitle><DialogDescription>{t("app.signOutDescription")}</DialogDescription>
      {error&&<Alert tone="danger">{t("app.signOutError")}</Alert>}
      <DialogFooter><Button variant="secondary" disabled={pending} onClick={()=>setOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" loading={pending} onClick={signOut}>{t("app.signOut")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
export function AccountControl({ returnTo="/scenarios", beforeNavigate }: { returnTo?: string; beforeNavigate?: () => Promise<boolean> }) {
  const t=useTranslations(); const router=useRouter(); const {data:session,isPending}=authClient.useSession();
  const href=`${session?"/account":"/sign-in"}?next=${encodeURIComponent(returnTo)}`;
  async function navigate(event:MouseEvent<HTMLAnchorElement>) {
    if(!beforeNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button!==0)return;
    event.preventDefault(); if(await beforeNavigate())router.push(href);
  }
  if(isPending)return <Button variant="quiet" size="compact" disabled aria-busy="true"><UserRound size={17}/>{t("app.account")}</Button>;
  return <span className="inline-flex flex-wrap items-center gap-1"><Link href={href} onClick={navigate} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:underline"><UserRound size={17}/>{t(session?"app.account":"app.signIn")}</Link>{session&&<SignOutButton beforeSignOut={beforeNavigate}/>}</span>;
}

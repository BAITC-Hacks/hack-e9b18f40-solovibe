"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Input } from "@/components/ui";
import { AppHeader } from "./AppHeader";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cityApi } from "@/lib/city-api";

// Same-tab memory preserves a form across locale navigation; credentials never enter browser storage.
let authDraft = { name: "", email: "", password: "" };

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string }) {
  const t=useTranslations(); const router=useRouter(); const signup=mode==="sign-up";
  const [name,setName]=useState(authDraft.name); const [email,setEmail]=useState(authDraft.email); const [password,setPassword]=useState(authDraft.password);
  const [pending,setPending]=useState(false); const [error,setError]=useState<string|null>(null); const [signed,setSigned]=useState(false);
  async function claim() {
    await cityApi("/owners/claim",{method:"POST",body:{}});
    const channel=new BroadcastChannel("citybalance-session"); channel.postMessage({changed:true}); channel.close();
    router.replace(next); router.refresh();
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if(pending)return; setPending(true);setError(null);
    try {
      if(!signed){
        const result=signup ? await authClient.signUp.email({name,email,password}) : await authClient.signIn.email({email,password});
        if(result.error){setError(signup?"signupError":"authError");return;}
        setSigned(true);setPassword(""); authDraft={name:"",email:"",password:""};
      }
      try {await claim();}catch{setError("claimError");}
    }catch{setError(signup?"signupError":"authError");}finally{setPending(false);}
  }
  return <main className="page-shell"><AppHeader/><section className="surface mx-auto mt-8 max-w-lg p-6 sm:p-9"><h1 className="text-3xl">{t(signup?"app.signUp":"app.signIn")}</h1><p className="text-muted">{t("app.authIntro")}</p>
    <form className="mt-6 space-y-5" onSubmit={submit}>
      {!signed && <>{signup&&<Input label={t("app.name")} value={name} onChange={e=>{setName(e.target.value);authDraft.name=e.target.value;}} autoComplete="name" required maxLength={100}/>}<Input label={t("app.email")} type="email" value={email} onChange={e=>{setEmail(e.target.value);authDraft.email=e.target.value;}} autoComplete="email" required maxLength={254}/><Input label={t("app.password")} type="password" value={password} onChange={e=>{setPassword(e.target.value);authDraft.password=e.target.value;}} autoComplete={signup?"new-password":"current-password"} minLength={10} maxLength={128} hint={t("app.passwordHint")} required/></>}
      {error&&<Alert tone="danger">{t(`app.${error}`)}</Alert>}
      <Button type="submit" className="w-full" loading={pending}>{t(signed?"app.claimRetry":signup?"app.signUp":"app.signIn")}</Button>
    </form><Link href={{pathname:signup?"/sign-in":"/sign-up",query:{next}}} className="mt-6 block text-center text-sm font-semibold text-accent">{t(signup?"app.haveAccount":"app.needAccount")}</Link>
  </section></main>;
}

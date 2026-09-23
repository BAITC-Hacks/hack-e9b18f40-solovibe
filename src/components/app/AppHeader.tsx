"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { Alert, Button, LanguageSelector } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
export function AppHeader() {
  const t = useTranslations();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const { data: session } = authClient.useSession();
  return <header className="page-header">
    <Link href="/" aria-label="CityBalance"><Logo /></Link>
    <nav className="flex flex-wrap items-center gap-2 sm:gap-4" aria-label={t("app.navigation")}>
      <Link className="min-h-11 content-center text-sm font-semibold hover:underline" href="/scenarios">{t("app.library")}</Link>
      {session ? <Button variant="quiet" size="compact" loading={signingOut} onClick={async () => {
        setSigningOut(true); setFailed(false);
        try {
          const result = await authClient.signOut();
          if (result.error) { setFailed(true); return; }
          const channel = new BroadcastChannel("citybalance-session"); channel.postMessage({ changed: true }); channel.close();
          router.replace("/"); router.refresh();
        } catch { setFailed(true); } finally { setSigningOut(false); }
      }}>{t("app.signOut")}</Button> : <Link className="min-h-11 content-center text-sm hover:underline" href="/sign-in">{t("app.signIn")}</Link>}
      <LanguageSelector label={t("common.language")} />
    </nav>
    {failed && <div className="w-full"><Alert tone="danger">{t("app.signOutError")}</Alert></div>}
  </header>;
}

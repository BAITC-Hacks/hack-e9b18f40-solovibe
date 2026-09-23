"use client";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { LanguageSelector } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { AccountControl } from "./AccountControl";
export function AppHeader() {
  const t = useTranslations();
  return <header className="page-header">
    <Link href="/" aria-label="CityBalance"><Logo /></Link>
    <nav className="flex flex-wrap items-center gap-2 sm:gap-4" aria-label={t("app.navigation")}>
      <Link className="min-h-11 content-center text-sm font-semibold hover:underline" href="/scenarios">{t("app.library")}</Link>
      <AccountControl />
      <LanguageSelector label={t("common.language")} />
    </nav>
  </header>;
}

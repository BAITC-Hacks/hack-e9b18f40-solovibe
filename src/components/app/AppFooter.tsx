"use client";

import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { Link } from "@/i18n/navigation";
import "./app-footer.css";

export function AppFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__brand">
          <Link href="/" aria-label="CityBalance"><Logo /></Link>
          <p>{t("description")}</p>
        </div>
        <nav aria-label={t("navigation")}>
          <Link href="/">{t("home")}</Link>
          <Link href="/#how-it-works">{t("howItWorks")}</Link>
          <Link href="/#decision-example">{t("decisionExample")}</Link>
          <Link href="/scenarios">{t("scenarios")}</Link>
        </nav>
        <div className="app-footer__notes">
          <p>{t("modelNote")}</p>
          <p>{t("attribution")}</p>
        </div>
      </div>
    </footer>
  );
}

"use client";
import { useTranslations } from "next-intl";
import { Alert, Button } from "@/components/ui";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t=useTranslations();
  return <main className="page-shell"><section className="surface mx-auto mt-12 max-w-xl space-y-6 p-8"><Alert tone="danger">{t("errors.STORAGE_UNAVAILABLE")}</Alert><Button onClick={reset}>{t("common.retry")}</Button></section></main>;
}

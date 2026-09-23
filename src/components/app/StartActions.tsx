"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Plus } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { cityApi, errorCode } from "@/lib/city-api";
import type { ScenarioView } from "@/features/city/records";
export function StartActions() {
  const t = useTranslations(); const router = useRouter();
  const [pending, setPending] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ source: string; id: string } | null>(null);
  async function start(source: "example" | "blank") {
    if (pending) return; setPending(source); setError(null);
    if (attempt.current?.source !== source) attempt.current = { source, id: crypto.randomUUID() };
    try {
      const view = await cityApi<ScenarioView>("/scenarios", { method: "POST", body: { source, clientMutationId: attempt.current.id, title: t(source === "example" ? "app.exampleTitle" : "app.blankTitle") } });
      router.push(`/city/${view.scenario.id}`);
    } catch (e) { setError(errorCode(e)); setPending(null); }
  }
  return <div className="space-y-4"><div className="flex flex-wrap gap-3">
    <Button onClick={() => start("example")} loading={pending === "example"} disabled={!!pending}>{t("app.startExample")}<ArrowUpRight size={19} /></Button>
    <Button variant="secondary" onClick={() => start("blank")} loading={pending === "blank"} disabled={!!pending}><Plus size={18} />{t("app.startBlank")}</Button>
  </div>{error && <Alert tone="danger">{t(`errors.${error}`)}</Alert>}</div>;
}

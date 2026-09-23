"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {useRouter} from "next/navigation";
import { Button } from "@/components/ui";
import { errorCode } from "@/lib/city-api";
import type { PublicSnapshot } from "../../sharing-contracts";
import type { ScenarioView } from "../../records";
import { aborted, useDeliveryRequests } from "./requests";
import { SnapshotContent } from "./SnapshotContent";
import "../../delivery.css";
export function SharedSnapshot({ initial, token }: {
    initial: PublicSnapshot;
    token: string;
}) {
    const router=useRouter();
    const t = useTranslations("delivery"), te = useTranslations("errors"), locale = useLocale();
    const { request, download, sessionChanged } = useDeliveryRequests();
    const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(initial), [checking, setChecking] = useState(false), [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null);
    const epoch = useRef(0), forkId = useRef<string | null>(null);
    const report = useCallback((error: unknown) => { if (aborted(error))
        return; const code = errorCode(error); setProblem(te.has(code) ? te(code) : t("unavailable")); }, [te, t]);
    const recheck = useCallback(async () => { const current = ++epoch.current; setChecking(true); setSnapshot(null); setProblem(null); try {
        const next = await request<PublicSnapshot>(`/shares/view/${encodeURIComponent(token)}`);
        if (current === epoch.current)
            setSnapshot(next);
    }
    catch (error) {
        if (current === epoch.current)
            report(error);
    }
    finally {
        if (current === epoch.current)
            setChecking(false);
    } }, [request, report, token]);
    useEffect(() => { const focus = () => { void recheck(); }; window.addEventListener("focus", focus); return () => { window.removeEventListener("focus", focus); }; }, [recheck]);
    async function fork() { setBusy(true); setProblem(null); try {
        forkId.current ??= crypto.randomUUID();
        const result = await request<ScenarioView>(`/shares/view/${encodeURIComponent(token)}/fork`, "POST", { clientMutationId: forkId.current });
        router.push(`/${locale}/city/${result.scenario.id}`);
    }
    catch (error) {
        report(error);
    }
    finally {
        setBusy(false);
    } }
    async function getFile(id: string, kind: string) { setBusy(true); setProblem(null); try {
        await download(`/shares/view/${encodeURIComponent(token)}/artifacts/${id}`, `citybalance-${kind}.${kind}`);
    }
    catch (error) {
        if (!aborted(error)) {
            setSnapshot(null);
            report(error);
        }
    }
    finally {
        setBusy(false);
    } }
    if (sessionChanged)
        return <p>{t("sessionChanged")}</p>;
    return <main className="cbd-public"><div className="cbd-actions"><Button variant="secondary" loading={checking} onClick={() => void recheck()}>{t("recheck")}</Button>{snapshot && <Button loading={busy} onClick={() => void fork()}>{t("fork")}</Button>}</div>{problem && <p role="alert" className="cbd-warning">{problem}</p>}{checking && <p role="status">{t("checking")}</p>}{snapshot && <SnapshotContent snapshot={snapshot}><section><h4>{t("files")}</h4>{snapshot.artifacts.length ? <div className="cbd-actions">{snapshot.artifacts.map(a => <Button key={a.id} variant="secondary" disabled={busy || a.state !== "ready"} onClick={() => void getFile(a.id, a.kind)}>{t("download")} {a.kind.toUpperCase()} · {a.locale}</Button>)}</div> : <p>{t("noFiles")}</p>}</section></SnapshotContent>}</main>;
}

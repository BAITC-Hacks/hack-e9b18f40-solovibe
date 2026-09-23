"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { errorCode } from "@/lib/city-api";
import type { SharedComparison } from "../../sharing-contracts";
import { aborted, useDeliveryRequests } from "./requests";
import { AlignedComparison } from "../workshop/Comparison";
import { SnapshotContent } from "./SnapshotContent";
export function SharedComparisonPanel() {
    const t = useTranslations("delivery"), te = useTranslations("errors"), { request, sessionChanged } = useDeliveryRequests();
    const [input, setInput] = useState(""), [comparison, setComparison] = useState<SharedComparison | null>(null), [busy, setBusy] = useState(false), [problem, setProblem] = useState<string | null>(null);
    const epoch = useRef(0);
    useEffect(() => () => { epoch.current++; }, []);
    async function compare() {
        const current = ++epoch.current;
        setComparison(null);
        setProblem(null);
        const values = input.split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
        if (!values.length || values.length > 3) {
            setProblem(t("linkCount"));
            return;
        }
        const tokens: string[] = [];
        for (const value of values) {
            let token = value;
            try {
                if (value.includes("://")) {
                    const url = new URL(value);
                    if (url.origin !== window.location.origin || !/^\/(ru|kk|en)\/share\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))
                        throw new Error();
                    token = url.pathname.split("/").filter(Boolean).at(-1)!;
                }
                if (!/^[A-Za-z0-9_-]{43,128}$/.test(token))
                    throw new Error();
                tokens.push(token);
            }
            catch {
                setProblem(t("invalidLink"));
                return;
            }
        }
        setBusy(true);
        try {
            const result = await request<SharedComparison>("/comparisons/shared", "POST", { shareTokens: tokens });
            if (current === epoch.current)
                setComparison(result);
        }
        catch (error) {
            if (current === epoch.current && !aborted(error)) {
                const code = errorCode(error);
                setProblem(te.has(code) ? te(code) : t("compareFailed"));
            }
        }
        finally {
            if (current === epoch.current)
                setBusy(false);
        }
    }
    if (sessionChanged)
        return null;
    return <section className="cbd-compare"><h3>{t("compareTitle")}</h3><p>{t("compareHint")}</p><label>{t("links")}<textarea rows={3} value={input} onChange={e => { setInput(e.target.value); setComparison(null); epoch.current++; setBusy(false); }} placeholder={t("linksHint")}/></label><Button loading={busy} onClick={() => void compare()}>{t("compare")}</Button>{problem && <p role="alert" className="cbd-warning">{problem}</p>}{comparison && <><p className="cbd-hint">{t("compareBasis")}</p><AlignedComparison columns={comparison.snapshots.map(s => ({ id: s.revisionId, title: s.teamName || s.title, subtitle: s.teamName ? s.title : s.revisionId.slice(0, 8), evaluation: s.evaluation, decisions: s.decisions }))}/><div className="cbd-comparison-documents">{comparison.snapshots.map((s, i) => <details key={`${s.revisionId}:${i}`}><summary><span className="cbw-column-number">{i + 1}</span>{s.teamName || s.title}</summary><SnapshotContent snapshot={s}/></details>)}</div></>}</section>;
}

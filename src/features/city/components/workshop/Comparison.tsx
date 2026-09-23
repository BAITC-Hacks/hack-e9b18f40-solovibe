"use client";
import { useLocale, useTranslations } from "next-intl";
import type { Constraints, Decision, Evaluation } from "../../contracts";
import type { ComparisonView, RevisionSnapshot } from "../../workshop-contracts";
import { AKIM_DATASET } from "../../data/akim-v1";
export const decisionKey = (d: Decision) => `${d.measureId}:${d.districtId ?? "city"}`;
export function DecisionChanges({ source, target }: {
    source: Decision[];
    target: Decision[];
}) {
    const t = useTranslations("workshop"), tm = useTranslations("measures"), td = useTranslations("districts");
    const groups = { added: target.filter(d => !source.some(v => decisionKey(v) === decisionKey(d))), removed: source.filter(d => !target.some(v => decisionKey(v) === decisionKey(d))), retained: target.filter(d => source.some(v => decisionKey(v) === decisionKey(d))) };
    return <div className="cbw-decisions">{Object.entries(groups).map(([key, items]) => <div key={key}><h5>{t(key)}</h5>{items.length ? <ul>{items.map(d => <li key={decisionKey(d)}>{tm(d.measureId)}<small>{d.districtId ? td(d.districtId) : t("city")}</small></li>)}</ul> : <span>—</span>}</div>)}</div>;
}
export function EvaluationSummary({ result }: {
    result: Evaluation;
}) {
    const t = useTranslations("workshop"), td = useTranslations("districts"), locale = useLocale();
    const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(v);
    return <><dl className="cbw-metrics"><div><dt>Score</dt><dd>{result.score === null ? "—" : n(result.score)}</dd></div><div><dt>{t("cost")}</dt><dd>{n(result.cost)}</dd></div><div><dt>{t("weakest")}</dt><dd>{n(result.minimumDistrictScore)}</dd></div><div><dt>{t("critical")}</dt><dd>{result.criticalPairs.length}</dd></div></dl><p className="cbw-hint">{t("weakest")}: {result.weakestDistrictIds.map(d => td(d)).join(", ")}. {t("directDistricts")}: {result.directDistrictIds.map(d => td(d)).join(", ") || "—"}</p></>;
}
export function ConditionChecks({ constraints: q, result: r }: {
    constraints: Constraints;
    result: Evaluation;
}) {
    const t = useTranslations("workshop"), td = useTranslations("districts"), ti = useTranslations("indicators");
    const checks: [
        string,
        boolean
    ][] = [
        [t("maxSpend") + ` ≤ ${q.maxSpend}`, r.cost <= q.maxSpend],
        [t("minDirectDistricts") + ` ≥ ${q.minDirectDistricts}`, r.directDistrictIds.length >= q.minDirectDistricts],
        ...(q.maxCriticalPairs === undefined ? [] : [[t("maxCriticalPairs") + ` ≤ ${q.maxCriticalPairs}`, r.criticalPairs.length <= q.maxCriticalPairs] as [
                string,
                boolean
            ]]),
        [t("locked"), q.locked.every(d => r.decisions.some(v => decisionKey(v) === decisionKey(d)))],
        [t("excludedMeasureIds"), r.decisions.every(d => !q.excludedMeasureIds.includes(d.measureId))],
        [t("requiredDirections"), (q.requiredDirections ?? []).every(d => r.decisions.some(v => AKIM_DATASET.measures.find(m => m.id === v.measureId)?.direction === d))],
        ...(q.districtFloors ?? []).map(f => [`${td(f.districtId)} ≥ ${f.minScore}`, (r.districts.find(d => d.districtId === f.districtId)?.score ?? -Infinity) >= f.minScore] as [
            string,
            boolean
        ]),
        ...(q.indicatorFloors ?? []).map(f => [`${td(f.districtId)} · ${ti(f.indicatorId)} ≥ ${f.minValue}`, (r.districts.find(d => d.districtId === f.districtId)?.indicators.find(i => i.indicatorId === f.indicatorId)?.after ?? -Infinity) >= f.minValue] as [
            string,
            boolean
        ])
    ];
    return <ul className="cbw-condition-checks">{checks.map(([label, ok], i) => <li className={ok ? "" : "cbw-warning"} key={i}>{ok ? "✓" : "!"} {label} · {t(ok ? "fulfilled" : "failedCondition")}</li>)}</ul>;
}
export function Comparison({ view }: {
    view: ComparisonView;
}) {
    const t = useTranslations("workshop"), td = useTranslations("districts"), locale = useLocale();
    const n = (v: number | null) => v === null ? "—" : new Intl.NumberFormat(locale, { maximumFractionDigits: 3, signDisplay: "exceptZero" }).format(v);
    return <section aria-label={t("comparison")} className="cbw-comparison"><h3>{t("comparison")}</h3><p>{t("comparisonHint")}</p><div className="cbw-comparison-grid">{view.snapshots.map((s, index) => { const r = s.evaluation.result, diff = view.differences.find(d => d.revisionId === s.revision.id), base = view.snapshots[0].evaluation.result; return <article className="cbw-card" key={s.revision.id}><h4>{s.revision.title || `${t("version")} ${index + 1}`}</h4><EvaluationSummary result={r}/>{index > 0 && diff && <p>{t("delta")}: Score {n(diff.scoreDelta)} · {t("cost")} {n(diff.costDelta)}</p>}<dl className="cbw-comparison-rows">{r.districts.map(d => <div key={d.districtId}><dt>{td(d.districtId)}</dt><dd>{d.score.toFixed(3)} <small>({n(d.score - (base.districts.find(v => v.districtId === d.districtId)?.score ?? 0))})</small></dd></div>)}{(["population", "weakest", "penalty"] as const).map(k => <div key={k}><dt>{t(`component_${k}`)}</dt><dd>{r.components[k].toFixed(3)} <small>({n(r.components[k] - base.components[k])})</small></dd></div>)}</dl><details><summary>{t("decisions")}</summary><DecisionChanges source={view.snapshots[0].revision.decisions} target={s.revision.decisions}/></details></article>; })}</div></section>;
}
export function SnapshotLabel({ snapshot }: {
    snapshot: RevisionSnapshot;
}) { const t = useTranslations("workshop"); return <>{snapshot.revision.title || t("version")} · {snapshot.revision.id.slice(0, 8)}</>; }

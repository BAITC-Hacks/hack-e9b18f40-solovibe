"use client";
import type { CSSProperties, ReactNode } from "react";
import "../../workshop.css";
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
    return <div className="cbw-decisions">{Object.entries(groups).map(([key, items]) => <div key={key}><h5>{t(key)}</h5>{items.length ? <ul>{items.map(d => <li key={decisionKey(d)}>{tm(d.measureId)}<small>{d.districtId ? td(d.districtId) : t("city")}</small></li>)}</ul> : <span>вЂ”</span>}</div>)}</div>;
}
export function EvaluationSummary({ result }: {
    result: Evaluation;
}) {
    const t = useTranslations("workshop"), td = useTranslations("districts"), locale = useLocale();
    const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(v);
    return <><dl className="cbw-metrics"><div><dt>Score</dt><dd>{result.score === null ? "вЂ”" : n(result.score)}</dd></div><div><dt>{t("cost")}</dt><dd>{n(result.cost)}</dd></div><div><dt>{t("weakest")}</dt><dd>{n(result.minimumDistrictScore)}</dd></div><div><dt>{t("critical")}</dt><dd>{result.criticalPairs.length}</dd></div></dl><p className="cbw-hint">{t("weakest")}: {result.weakestDistrictIds.map(d => td(d)).join(", ")}. {t("directDistricts")}: {result.directDistrictIds.map(d => td(d)).join(", ") || "вЂ”"}</p></>;
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
        [t("maxSpend") + ` в‰¤ ${q.maxSpend}`, r.cost <= q.maxSpend],
        [t("minDirectDistricts") + ` в‰Ґ ${q.minDirectDistricts}`, r.directDistrictIds.length >= q.minDirectDistricts],
        ...(q.maxCriticalPairs === undefined ? [] : [[t("maxCriticalPairs") + ` в‰¤ ${q.maxCriticalPairs}`, r.criticalPairs.length <= q.maxCriticalPairs] as [
                string,
                boolean
            ]]),
        [t("locked"), q.locked.every(d => r.decisions.some(v => decisionKey(v) === decisionKey(d)))],
        [t("excludedMeasureIds"), r.decisions.every(d => !q.excludedMeasureIds.includes(d.measureId))],
        [t("requiredDirections"), (q.requiredDirections ?? []).every(d => r.decisions.some(v => AKIM_DATASET.measures.find(m => m.id === v.measureId)?.direction === d))],
        ...(q.districtFloors ?? []).map(f => [`${td(f.districtId)} в‰Ґ ${f.minScore}`, (r.districts.find(d => d.districtId === f.districtId)?.score ?? -Infinity) >= f.minScore] as [
            string,
            boolean
        ]),
        ...(q.indicatorFloors ?? []).map(f => [`${td(f.districtId)} В· ${ti(f.indicatorId)} в‰Ґ ${f.minValue}`, (r.districts.find(d => d.districtId === f.districtId)?.indicators.find(i => i.indicatorId === f.indicatorId)?.after ?? -Infinity) >= f.minValue] as [
            string,
            boolean
        ])
    ];
    return <ul className="cbw-condition-checks">{checks.map(([label, ok], i) => <li className={ok ? "" : "cbw-warning"} key={i}>{ok ? "вњ“" : "!"} {label} В· {t(ok ? "fulfilled" : "failedCondition")}</li>)}</ul>;
}
export interface ComparisonColumn {
    id: string;
    title: string;
    subtitle?: string;
    evaluation: Evaluation;
    decisions: Decision[];
}
/** One row owns each metric across every variant, so wrapped content cannot shift later metrics. */
export function AlignedComparison({ columns }: {
    columns: ComparisonColumn[];
}) {
    const t = useTranslations("workshop"), td = useTranslations("districts"), tm = useTranslations("measures"), locale = useLocale();
    if (!columns.length)
        return null;
    const baseline = columns[0];
    const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
    const delta = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, signDisplay: "exceptZero" }).format(value);
    const metric = (value: number | null, original: number | null, index: number, bar = false): ReactNode => <>
        <strong className="cbw-aligned-value">{value === null ? "—" : number(value)}</strong>
        {index > 0 && value !== null && original !== null && <span className="cbw-aligned-delta">{t("metricChange")}: {delta(value - original)}</span>}
        {bar && value !== null && <span className="cbw-score-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/>{original !== null && <i style={{ left: `${Math.max(0, Math.min(100, original))}%` }}/>}</span>}
    </>;
    const rows: {
        id: string;
        label: string;
        group?: string;
        cells: ReactNode[];
    }[] = [
        { id: "score", label: "Score", cells: columns.map((c, i) => metric(c.evaluation.score, baseline.evaluation.score, i)) },
        { id: "cost", label: t("cost"), cells: columns.map((c, i) => metric(c.evaluation.cost, baseline.evaluation.cost, i)) },
        { id: "critical", label: t("critical"), cells: columns.map((c, i) => metric(c.evaluation.criticalPairs.length, baseline.evaluation.criticalPairs.length, i)) },
        { id: "weakest", label: t("weakest"), cells: columns.map((c, i) => <>{metric(c.evaluation.minimumDistrictScore, baseline.evaluation.minimumDistrictScore, i)}<span className="cbw-aligned-note">{c.evaluation.weakestDistrictIds.map(d => td(d)).join(", ")}</span></>) },
        { id: "direct", label: t("directDistricts"), cells: columns.map(c => <><strong className="cbw-aligned-value">{c.evaluation.directDistrictIds.length}</strong><span className="cbw-aligned-note">{c.evaluation.directDistrictIds.map(d => td(d)).join(", ") || "—"}</span></>) },
    ];
    for (const district of baseline.evaluation.districts)
        rows.push({ id: district.districtId, label: td(district.districtId), group: "district", cells: columns.map((c, i) => metric(c.evaluation.districts.find(d => d.districtId === district.districtId)?.score ?? null, district.score, i, true)) });
    for (const component of ["population", "weakest", "penalty"] as const)
        rows.push({ id: `component-${component}`, label: t(`component_${component}`), group: "component", cells: columns.map((c, i) => metric(c.evaluation.components[component], baseline.evaluation.components[component], i)) });
    for (const mode of ["added", "removed", "retained"] as const)
        rows.push({ id: mode, label: t(mode), group: "decision", cells: columns.map(c => {
                const decisions = mode === "removed" ? baseline.decisions.filter(d => !c.decisions.some(v => decisionKey(v) === decisionKey(d))) : c.decisions.filter(d => baseline.decisions.some(v => decisionKey(v) === decisionKey(d)) === (mode === "retained"));
                return decisions.length ? <ul className="cbw-aligned-decisions">{decisions.map(d => <li key={decisionKey(d)}><span>{tm(d.measureId)}</span><small>{d.districtId ? td(d.districtId) : t("city")}</small></li>)}</ul> : <span>—</span>;
            }) });
    let previousGroup: string | undefined;
    return <div className="cbw-aligned-wrap"><p className="cbw-aligned-legend">{t("visualLegend")}</p><table className="cbw-aligned-table" style={{ "--comparison-columns": columns.length } as CSSProperties}><caption className="cbw-visually-hidden">{t("comparison")}</caption><thead><tr><th scope="col" className="cbw-metric-heading">{t("metricLabel")}</th>{columns.map((c, i) => <th scope="col" key={`${c.id}:${i}`}><span className="cbw-column-number">{i + 1}</span><span className="cbw-column-title">{c.title}</span>{c.subtitle && <small className="cbw-aligned-note">{c.subtitle}</small>}<span className="cbw-aligned-note">{i === 0 ? t("comparisonBaseline") : t("comparedWithFirst")}</span></th>)}</tr></thead><tbody>{rows.map(row => {
            const startsGroup = row.group !== previousGroup;
            previousGroup = row.group;
            return <tr key={row.id} className={startsGroup ? "cbw-aligned-group-start" : undefined}><th scope="row">{row.label}</th>{row.cells.map((cell, i) => <td key={i}><span className="cbw-mobile-column" aria-hidden="true">{i + 1}</span>{cell}</td>)}</tr>;
        })}</tbody></table></div>;
}
export function Comparison({ view }: {
    view: ComparisonView;
}) {
    const t = useTranslations("workshop");
    return <section aria-label={t("comparison")} className="cbw-comparison"><h3>{t("comparison")}</h3><p>{t("comparisonHint")}</p><AlignedComparison columns={view.snapshots.map((s, index) => ({ id: s.revision.id, title: s.revision.title || `${t("version")} ${index + 1}`, subtitle: s.revision.id.slice(0, 8), evaluation: s.evaluation.result, decisions: s.revision.decisions }))}/></section>;
}
export function SnapshotLabel({ snapshot }: {
    snapshot: RevisionSnapshot;
}) { const t = useTranslations("workshop"); return <>{snapshot.revision.title || t("version")} В· {snapshot.revision.id.slice(0, 8)}</>; }

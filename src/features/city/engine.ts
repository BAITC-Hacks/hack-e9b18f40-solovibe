import { DIRECTIONS, INDICATOR_IDS, decisionSchema, stressAssumptionSchema } from './contracts';
import type { Dataset, Decision, StressAssumption, Validation, Evaluation, EvidenceRef, DomainIssue } from './contracts';
export const canonicalDecisions = (decisions: readonly Decision[]): Decision[] => [...decisions].sort((a, b) => Number(a.measureId.slice(1)) - Number(b.measureId.slice(1)) || (a.districtId ?? '').localeCompare(b.districtId ?? ''));
export const effectiveCost = (cost: number, id: string, a?: StressAssumption) => Math.round(cost * 100 * (a?.measureId === id ? 1 + a.costIncreasePct / 100 : 1)) / 100;
export function validateDecisions(dataset: Dataset, decisions: readonly Decision[], assumptions?: StressAssumption): Validation {
    const issues: DomainIssue[] = [];
    const add = (code: string, params: DomainIssue['params'] = {}) => issues.push({ code, params });
    const directionCounts = Object.fromEntries(DIRECTIONS.map(d => [d, 0])) as Validation['directionCounts'];
    let cents = 0;
    if (!Array.isArray(decisions) || decisions.length > 5) {
        add('DECISION_COUNT');
        return { valid: false, complete: false, issues, cost: 0, remaining: dataset.budget, directionCounts };
    }
    if (assumptions && !stressAssumptionSchema.safeParse(assumptions).success)
        add('INVALID_ASSUMPTION');
    const seen = new Set<string>();
    for (const decision of decisions) {
        if (!decisionSchema.safeParse(decision).success) {
            add('INVALID_DECISION');
            continue;
        }
        const m = dataset.measures.find(m => m.id === decision.measureId);
        if (!m) {
            add('UNKNOWN_MEASURE', { measureId: decision.measureId });
            continue;
        }
        if (seen.has(m.id))
            add('DUPLICATE_MEASURE', { measureId: m.id });
        seen.add(m.id);
        directionCounts[m.direction]++;
        if (m.scope === 'city' ? decision.districtId !== null : !dataset.districts.some(d => d.id === decision.districtId))
            add('INVALID_TARGET', { measureId: m.id });
        cents += Math.round(effectiveCost(m.cost, m.id, assumptions) * 100);
    }
    for (const direction of DIRECTIONS)
        if (directionCounts[direction] > 2)
            add('DIRECTION_LIMIT', { direction });
    for (const x of dataset.exclusions) {
        const a = decisions.find(d => d?.measureId === x.pair[0]), b = decisions.find(d => d?.measureId === x.pair[1]);
        if (a && b && (x.scope === 'any' || a.districtId === b.districtId))
            add('EXCLUDED_PAIR', { first: x.pair[0], second: x.pair[1] });
    }
    if (cents > dataset.budget * 100)
        add('OVER_BUDGET', { cost: cents / 100, budget: dataset.budget });
    return { valid: issues.length === 0, complete: decisions.length === 5, issues, cost: cents / 100, remaining: (dataset.budget * 100 - cents) / 100, directionCounts };
}
/** Indicator eighths, integer weights and population hundredths preserve strict threshold semantics. */
export function calculateNumeric(dataset: Dataset, decisions: readonly Decision[], assumptions?: StressAssumption) {
    const values = dataset.districts.flatMap(d => INDICATOR_IDS.map(k => d.indicators[k] * 8));
    for (const decision of decisions) {
        const m = dataset.measures.find(m => m.id === decision.measureId);
        if (!m)
            continue;
        const realized = 8 - Math.min(8, m.lag + (assumptions?.measureId === m.id ? assumptions.extraLagQuarters : 0));
        for (let d = 0; d < 5; d++)
            if (decision.districtId === null || dataset.districts[d].id === decision.districtId)
                for (let k = 0; k < 10; k++)
                    values[d * 10 + k] += (m.effects[INDICATOR_IDS[k]] ?? 0) * realized;
    }
    for (const s of dataset.synergies) {
        const a = decisions.find(d => d.measureId === s.pair[0]);
        if (a && decisions.some(d => d.measureId === s.pair[1])) {
            const d = dataset.districts.findIndex(d => d.id === a.districtId);
            if (d >= 0)
                values[d * 10 + INDICATOR_IDS.indexOf(s.indicatorId)] += s.amount * 8;
        }
    }
    const sums = Array<number>(5).fill(0);
    let critical = 0;
    for (let d = 0; d < 5; d++)
        for (let k = 0; k < 10; k++) {
            const i = d * 10 + k;
            values[i] = Math.max(0, Math.min(800, values[i]));
            if (values[i] < 320)
                critical++;
            sums[d] += values[i] * Math.round(dataset.weights[INDICATOR_IDS[k]] * 100);
        }
    const meanNumerator = sums.reduce((s, v, i) => s + v * Math.round(dataset.districts[i].populationShare * 100), 0), minimum = Math.min(...sums);
    return { values, scores: sums.map(v => v / 800), populationMean: meanNumerator / 80000, minimumDistrictScore: minimum / 800, critical, score: (7 * meanNumerator + 300 * minimum - 800000 * critical) / 800000 };
}
function evaluateInternal(dataset: Dataset, decisions: readonly Decision[], assumptions: StressAssumption | undefined, baseline: boolean): Evaluation {
    const validation = validateDecisions(dataset, decisions, assumptions);
    const canonical = canonicalDecisions(Array.isArray(decisions) ? decisions.filter(d => decisionSchema.safeParse(d).success) : []);
    if (assumptions && !stressAssumptionSchema.safeParse(assumptions).success)
        assumptions = undefined;
    const numeric = calculateNumeric(dataset, canonical, assumptions);
    const evidence: EvidenceRef[] = [];
    const prefix = `${dataset.version}:${dataset.evaluatorVersion}`;
    const emit = (entry: EvidenceRef) => {
        evidence.push(entry);
        return entry.id;
    };
    const districts = dataset.districts.map((d, di) => {
        const indicators = INDICATOR_IDS.map((k, ki) => {
            const stem = `${prefix}:${d.id}:${k}`, inputs: string[] = [];
            inputs.push(emit({ id: `${stem}:base`, kind: 'base', value: d.indicators[k], inputs: [], districtId: d.id, indicatorId: k }));
            let raw = d.indicators[k];
            for (const dec of canonical) {
                const m = dataset.measures.find(m => m.id === dec.measureId);
                if (!m || (!m.effects[k]) || (dec.districtId !== null && dec.districtId !== d.id))
                    continue;
                const lag = Math.min(8, m.lag + (assumptions?.measureId === m.id ? assumptions.extraLagQuarters : 0));
                const v = m.effects[k]! * (8 - lag) / 8;
                raw += v;
                inputs.push(emit({ id: `${stem}:effect:${m.id}`, kind: 'effect', value: v, inputs: [], districtId: d.id, indicatorId: k, measureId: m.id, params: { fullEffect: m.effects[k]!, lag, realizedFraction: (8 - lag) / 8 } }));
            }
            for (const s of dataset.synergies)
                if (s.indicatorId === k && canonical.some(a => a.measureId === s.pair[0] && a.districtId === d.id) && canonical.some(a => a.measureId === s.pair[1])) {
                    raw += s.amount;
                    inputs.push(emit({ id: `${stem}:synergy:${s.id}`, kind: 'synergy', value: s.amount, inputs: [], districtId: d.id, indicatorId: k }));
                }
            const after = numeric.values[di * 10 + ki] / 8;
            if (raw !== after)
                inputs.push(emit({ id: `${stem}:clip`, kind: 'clipping', value: after - raw, inputs: [], districtId: d.id, indicatorId: k }));
            const evidenceId = emit({ id: stem, kind: 'indicator', value: after, inputs, districtId: d.id, indicatorId: k });
            return { indicatorId: k, before: d.indicators[k], after, delta: after - d.indicators[k], evidenceId };
        });
        const evidenceId = emit({ id: `${prefix}:${d.id}:score`, kind: 'district', value: numeric.scores[di], inputs: indicators.map(i => i.evidenceId), districtId: d.id, params: Object.fromEntries(INDICATOR_IDS.map(k => [k, dataset.weights[k]])) });
        return { districtId: d.id, populationShare: d.populationShare, score: numeric.scores[di], evidenceId, indicators };
    });
    const criticalPairs = districts.flatMap(d => d.indicators.filter(i => i.after < 40).map(i => ({ districtId: d.districtId, indicatorId: i.indicatorId, value: i.after, evidenceId: emit({ id: `${i.evidenceId}:critical`, kind: 'critical', value: -1, inputs: [i.evidenceId], districtId: d.districtId, indicatorId: i.indicatorId }) })));
    const populationId = emit({ id: `${prefix}:population`, kind: 'population', value: numeric.populationMean, inputs: districts.map(d => d.evidenceId), params: Object.fromEntries(districts.map(d => [d.districtId, d.populationShare])) });
    const score = validation.valid && (validation.complete || baseline) ? numeric.score : null;
    if (score !== null)
        emit({ id: `${prefix}:total`, kind: 'total', value: score, inputs: [populationId, ...districts.filter(d => d.score === numeric.minimumDistrictScore).map(d => d.evidenceId), ...criticalPairs.map(p => p.evidenceId)], params: { populationWeight: .7, weakestWeight: .3 } });
    return { ...validation, kind: !validation.valid ? 'invalid' : baseline ? 'baseline-reference' : !validation.complete ? 'draft' : assumptions && (assumptions.costIncreasePct || assumptions.extraLagQuarters) ? 'sensitivity' : 'official', datasetVersion: dataset.version, sourceHash: dataset.sourceHash, rulesVersion: dataset.rulesVersion, evaluatorVersion: dataset.evaluatorVersion, decisions: canonical, assumptions, score, populationMean: numeric.populationMean, minimumDistrictScore: numeric.minimumDistrictScore, districts, criticalPairs, directDistrictIds: dataset.districts.filter(d => canonical.some(c => c.districtId === d.id)).map(d => d.id), affectedDistrictIds: dataset.districts.filter(d => canonical.some(c => c.districtId === null || c.districtId === d.id)).map(d => d.id), weakestDistrictIds: districts.filter(d => d.score === numeric.minimumDistrictScore).map(d => d.districtId), components: { population: .7 * numeric.populationMean, weakest: .3 * numeric.minimumDistrictScore, penalty: criticalPairs.length }, evidence };
}
export const evaluate = (dataset: Dataset, decisions: readonly Decision[], assumptions?: StressAssumption): Evaluation => evaluateInternal(dataset, decisions, assumptions, false);
export const evaluateBaseline = (dataset: Dataset): Evaluation => evaluateInternal(dataset, [], undefined, true);

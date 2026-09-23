import { createHash } from 'node:crypto';
import { AKIM_DATASET, DEFAULT_CONSTRAINTS } from './data/akim-v1';
import { constraintsSchema, stressAssumptionSchema, DIRECTIONS } from './contracts';
import type { Constraints, Decision, DomainIssue, Measure, SearchResult, StressAssumption } from './contracts';
import { calculateNumeric, canonicalDecisions, effectiveCost, evaluate, validateDecisions } from './engine';
const cache = new Map<string, SearchResult>();
export function stableJson(value: unknown): string {
    if (value === undefined)
        return 'null';
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}
function canonicalConstraints(c: Constraints): Constraints {
    return { ...c, locked: canonicalDecisions(c.locked), excludedMeasureIds: [...new Set(c.excludedMeasureIds)].sort(), requiredDirections: c.requiredDirections ? [...new Set(c.requiredDirections)].sort() : undefined, districtFloors: c.districtFloors ? [...c.districtFloors].sort((a, b) => a.districtId.localeCompare(b.districtId)) : undefined, indicatorFloors: c.indicatorFloors ? [...c.indicatorFloors].sort((a, b) => `${a.districtId}:${a.indicatorId}`.localeCompare(`${b.districtId}:${b.indicatorId}`)) : undefined };
}
export async function searchPlans(input: {
    datasetVersion: string;
    constraints: Constraints;
    assumptions?: StressAssumption;
    limit?: number;
    signal?: AbortSignal;
    deadlineMs?: number;
}): Promise<SearchResult> {
    const started = performance.now();
    if (input.datasetVersion !== AKIM_DATASET.version)
        throw new Error('UNKNOWN_DATASET');
    const dataset = AKIM_DATASET;
    const constraints = canonicalConstraints(constraintsSchema.parse({ ...DEFAULT_CONSTRAINTS, ...input.constraints }));
    const assumptions = input.assumptions ? stressAssumptionSchema.parse(input.assumptions) : undefined;
    const limit = input.limit ?? 3;
    if (!Number.isInteger(limit) || limit < 1 || limit > 3)
        throw new Error('SEARCH_LIMIT');
    const inputHash = createHash('sha256').update(stableJson({ datasetVersion: dataset.version, sourceHash: dataset.sourceHash, canonicalHash: dataset.canonicalHash, rulesVersion: dataset.rulesVersion, evaluatorVersion: dataset.evaluatorVersion, constraints, assumptions })).digest('hex');
    const result: SearchResult = { status: 'complete', termination: 'exhausted', inputHash, datasetVersion: dataset.version, sourceHash: dataset.sourceHash, rulesVersion: dataset.rulesVersion, evaluatorVersion: dataset.evaluatorVersion, constraints, assumptions, objective: constraints.objective, evaluatedCount: 0, validCount: 0, feasibleCount: 0, candidates: [], issues: [], elapsedMs: 0, certificate: null };
    const deadline = started + Math.max(0, input.deadlineMs ?? 10000);
    const interrupted = () => input.signal?.aborted ? 'cancelled' : performance.now() >= deadline ? 'deadline' : null;
    const initialStop = interrupted();
    if (initialStop) {
        return { ...result, status: 'incomplete', termination: initialStop };
    }
    const cached = cache.get(inputHash);
    if (cached)
        return { ...structuredClone(cached), candidates: structuredClone(cached.candidates.slice(0, limit)), elapsedMs: performance.now() - started };
    const conflicts: DomainIssue[] = [...validateDecisions(dataset, constraints.locked, assumptions).issues];
    for (const d of constraints.locked)
        if (constraints.excludedMeasureIds.includes(d.measureId))
            conflicts.push({ code: 'LOCK_EXCLUDED', params: { measureId: d.measureId } });
    if (validateDecisions(dataset, constraints.locked, assumptions).cost > constraints.maxSpend)
        conflicts.push({ code: 'LOCK_SPEND', params: { maxSpend: constraints.maxSpend } });
    if (constraints.minDirectDistricts > 5)
        conflicts.push({ code: 'DIRECT_DISTRICTS_IMPOSSIBLE', params: {} });
    type Ranked = {
        decisions: Decision[];
        numeric: ReturnType<typeof calculateNumeric>;
        cost: number;
        key: string;
    };
    const top: Ranked[] = [];
    function compare(a: Ranked, b: Ranked) {
        if (constraints.objective === 'minCost' && a.cost !== b.cost)
            return a.cost - b.cost;
        if (constraints.objective === 'protectDistrict') {
            const i = dataset.districts.findIndex(d => d.id === constraints.priorityDistrictId);
            if (a.numeric.scores[i] !== b.numeric.scores[i])
                return b.numeric.scores[i] - a.numeric.scores[i];
            return b.numeric.score - a.numeric.score || a.key.localeCompare(b.key);
        }
        return b.numeric.score - a.numeric.score || a.cost - b.cost || a.key.localeCompare(b.key);
    }
    const choices = dataset.measures.filter(m => !constraints.excludedMeasureIds.includes(m.id));
    function* combinations(start: number, selected: Measure[], cost: number, counts: Record<string, number>): Generator<Measure[]> {
        if (selected.length === 5) {
            if (constraints.locked.some(d => !selected.some(m => m.id === d.measureId)))
                return;
            if (constraints.requiredDirections?.some(dir => !counts[dir]))
                return;
            yield [...selected];
            return;
        }
        for (let i = start; i <= choices.length - (5 - selected.length); i++) {
            const m = choices[i], nextCost = cost + Math.round(effectiveCost(m.cost, m.id, assumptions) * 100);
            if (nextCost > Math.round(constraints.maxSpend * 100) || (counts[m.direction] ?? 0) >= 2)
                continue;
            if (dataset.exclusions.some(x => x.scope === 'any' && x.pair.includes(m.id) && selected.some(s => x.pair.includes(s.id))))
                continue;
            selected.push(m);
            counts[m.direction] = (counts[m.direction] ?? 0) + 1;
            yield* combinations(i + 1, selected, nextCost, counts);
            selected.pop();
            counts[m.direction]--;
        }
    }
    function* assignments(measures: Measure[], at: number, selected: Decision[]): Generator<Decision[]> {
        if (at === 5) {
            yield selected;
            return;
        }
        const m = measures[at], lock = constraints.locked.find(d => d.measureId === m.id);
        const targets = lock ? [lock.districtId] : m.scope === 'city' ? [null] : dataset.districts.map(d => d.id);
        for (const districtId of targets) {
            if (dataset.exclusions.some(x => x.scope === 'same-district' && x.pair.includes(m.id) && selected.some(s => x.pair.includes(s.measureId) && s.districtId === districtId)))
                continue;
            selected.push({ measureId: m.id, districtId });
            yield* assignments(measures, at + 1, selected);
            selected.pop();
        }
    }
    if (!conflicts.length) {
        outer: for (const measures of combinations(0, [], 0, {})) {
            const cost = measures.reduce((s, m) => s + Math.round(effectiveCost(m.cost, m.id, assumptions) * 100), 0) / 100;
            for (const decisions of assignments(measures, 0, [])) {
                result.validCount++;
                result.evaluatedCount++;
                const numeric = calculateNumeric(dataset, decisions, assumptions);
                const direct = new Set(decisions.flatMap(d => d.districtId ? [d.districtId] : []));
                const feasible = direct.size >= constraints.minDirectDistricts && (constraints.maxCriticalPairs === undefined || numeric.critical <= constraints.maxCriticalPairs) && !constraints.districtFloors?.some(f => numeric.scores[dataset.districts.findIndex(d => d.id === f.districtId)] < f.minScore) && !constraints.indicatorFloors?.some(f => numeric.values[dataset.districts.findIndex(d => d.id === f.districtId) * 10 + Object.keys(dataset.weights).indexOf(f.indicatorId)] / 8 < f.minValue);
                if (feasible) {
                    result.feasibleCount++;
                    const candidate = { decisions, numeric, cost, key: decisions.map(d => `${d.measureId}:${d.districtId ?? 'city'}`).join('|') };
                    if (top.length < 3 || compare(candidate, top[top.length - 1]) < 0) {
                        top.push({ ...candidate, decisions: decisions.map(d => ({ ...d })) });
                        top.sort(compare);
                        if (top.length > 3)
                            top.pop();
                    }
                }
                if (result.evaluatedCount % 2048 === 0) {
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                    const stop = interrupted();
                    if (stop) {
                        result.status = 'incomplete';
                        result.termination = stop;
                        break outer;
                    }
                }
            }
        }
    }
    result.candidates = top.map(c => ({ decisions: c.decisions, evaluation: evaluate(dataset, c.decisions, assumptions) }));
    result.issues = conflicts;
    if (result.status === 'complete') {
        if (!result.feasibleCount && !conflicts.length) {
            result.issues.push({ code: 'NO_FEASIBLE_PLAN', params: { evaluatedCount: result.evaluatedCount } });
            if (DIRECTIONS.every(d => constraints.requiredDirections?.includes(d)) && constraints.maxCriticalPairs === 0)
                result.issues.push({ code: 'NURA_REQUIRES_TWO_SOCIAL', params: { districtId: 'nura', firstIndicator: 'S1', secondIndicator: 'S2', relaxation: 'requiredDirections or maxCriticalPairs' } });
        }
        const best = top[0];
        result.certificate = { exhaustive: true, inputHash, feasibleCount: result.feasibleCount, bestValue: best ? constraints.objective === 'minCost' ? best.cost : constraints.objective === 'protectDistrict' ? best.numeric.scores[dataset.districts.findIndex(d => d.id === constraints.priorityDistrictId)] : best.numeric.score : null };
    }
    result.elapsedMs = performance.now() - started;
    if (result.status === 'complete') {
        cache.set(inputHash, structuredClone(result));
        if (cache.size > 64)
            cache.delete(cache.keys().next().value!);
    }
    return { ...result, candidates: result.candidates.slice(0, limit) };
}

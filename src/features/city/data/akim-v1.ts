import type { Dataset, Decision, Constraints, Measure } from '../contracts';
import { INDICATOR_IDS } from '../contracts';
const rows = [
    ['yesil', .27, [45, 62, 68, 72, 48, 55, 78, 60, 75, 70]],
    ['almaty', .24, [40, 75, 50, 55, 60, 65, 62, 52, 50, 60]],
    ['saryarka', .20, [50, 70, 42, 40, 62, 68, 58, 55, 45, 55]],
    ['baikonur', .13, [52, 68, 55, 50, 58, 60, 52, 58, 55, 58]],
    ['nura', .16, [55, 40, 45, 65, 38, 35, 55, 50, 60, 50]],
] as const;
const measures: Measure[] = [
    { id: 'M1', direction: 'transport', scope: 'district', cost: 18, lag: 2, effects: { T1: 6, T2: 9 } },
    { id: 'M2', direction: 'transport', scope: 'city', cost: 22, lag: 2, effects: { T1: 4, B2: 3 } },
    { id: 'M3', direction: 'transport', scope: 'district', cost: 30, lag: 4, effects: { T1: 16, T2: 20, E2: 4 } },
    { id: 'M4', direction: 'ecology', scope: 'district', cost: 15, lag: 2, effects: { E1: 12, E2: 3, B1: 2 } },
    { id: 'M5', direction: 'ecology', scope: 'district', cost: 25, lag: 3, effects: { E2: 14, C1: 4 } },
    { id: 'M6', direction: 'ecology', scope: 'city', cost: 20, lag: 4, effects: { E1: 5, E2: 3 } },
    { id: 'M7', direction: 'social', scope: 'district', cost: 24, lag: 3, effects: { S1: 16 } },
    { id: 'M8', direction: 'social', scope: 'district', cost: 20, lag: 3, effects: { S2: 14 } },
    { id: 'M9', direction: 'social', scope: 'district', cost: 10, lag: 1, effects: { S1: 3, S2: 3, B1: 3 } },
    { id: 'M10', direction: 'safety', scope: 'district', cost: 12, lag: 1, effects: { B1: 12, B2: 2 } },
    { id: 'M11', direction: 'safety', scope: 'district', cost: 10, lag: 1, effects: { B2: 12, T1: -2 } },
    { id: 'M12', direction: 'services', scope: 'city', cost: 14, lag: 1, effects: { C2: 5 } },
    { id: 'M13', direction: 'services', scope: 'district', cost: 28, lag: 4, effects: { C1: 18, E2: 2 } },
    { id: 'M14', direction: 'services', scope: 'city', cost: 16, lag: 1, effects: { C1: 5, C2: 2 } },
];
export function deepFreeze<T>(value: T): T { if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value))
        deepFreeze(child);
} return value; }
export const AKIM_DATASET: Dataset = deepFreeze({
    version: 'akim-v1', sourceHash: '15901a62d06847095db6bff01da0cebaf54e8d16f6a75bb42ce899dd5c762327', canonicalHash: 'ef1b370ecfcc50d582ad0bbe124dfcdebf8d2b01b99687cb95432234b69d8220', rulesVersion: 'akim-rules-v1', evaluatorVersion: 'akim-evaluator-v1', budget: 100, horizon: 8,
    weights: { T1: .10, T2: .10, E1: .09, E2: .11, S1: .11, S2: .11, B1: .09, B2: .09, C1: .10, C2: .10 },
    districts: rows.map(([id, populationShare, values]) => ({ id, populationShare, indicators: Object.fromEntries(INDICATOR_IDS.map((key, i) => [key, values[i]])) as Dataset['weights'] })), measures,
    synergies: [{ id: 'M1-M2', pair: ['M1', 'M2'], indicatorId: 'T1', amount: 2 }, { id: 'M10-M12', pair: ['M10', 'M12'], indicatorId: 'B1', amount: 2 }, { id: 'M5-M6', pair: ['M5', 'M6'], indicatorId: 'E2', amount: 2 }],
    exclusions: [{ pair: ['M1', 'M3'], scope: 'any' }, { pair: ['M4', 'M7'], scope: 'same-district' }, { pair: ['M5', 'M13'], scope: 'same-district' }],
});
export const EXAMPLE_DECISIONS: Decision[] = [{ measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' }, { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12', districtId: null }, { measureId: 'M5', districtId: 'saryarka' }];
export const DEFAULT_CONSTRAINTS: Constraints = { locked: [], excludedMeasureIds: [], minDirectDistricts: 0, maxSpend: 100, objective: 'maxScore' };

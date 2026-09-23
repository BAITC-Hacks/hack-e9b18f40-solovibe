export const DISTRICT_IDS = ['yesil', 'almaty', 'saryarka', 'baikonur', 'nura'] as const;
export const INDICATOR_IDS = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'] as const;
export const DIRECTIONS = ['transport', 'ecology', 'social', 'safety', 'services'] as const;
export type DistrictId = typeof DISTRICT_IDS[number];
export type IndicatorId = typeof INDICATOR_IDS[number];
export type Direction = typeof DIRECTIONS[number];
export type MeasureId = `M${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14}`;
export interface Decision {
    measureId: MeasureId;
    districtId: DistrictId | null;
}
export interface StressAssumption {
    measureId: MeasureId;
    costIncreasePct: number;
    extraLagQuarters: number;
}
export interface Measure {
    id: MeasureId;
    direction: Direction;
    scope: 'district' | 'city';
    cost: number;
    lag: number;
    effects: Partial<Record<IndicatorId, number>>;
}
export interface Dataset {
    version: string;
    sourceHash: string;
    canonicalHash: string;
    rulesVersion: string;
    evaluatorVersion: string;
    budget: number;
    horizon: number;
    weights: Record<IndicatorId, number>;
    districts: readonly {
        id: DistrictId;
        populationShare: number;
        indicators: Record<IndicatorId, number>;
    }[];
    measures: readonly Measure[];
    synergies: readonly {
        id: string;
        pair: readonly [
            MeasureId,
            MeasureId
        ];
        indicatorId: IndicatorId;
        amount: number;
    }[];
    exclusions: readonly {
        pair: readonly [
            MeasureId,
            MeasureId
        ];
        scope: 'any' | 'same-district';
    }[];
}
export interface DomainIssue {
    code: string;
    params: Record<string, string | number | boolean>;
}
export interface Constraints {
    locked: Decision[];
    excludedMeasureIds: MeasureId[];
    requiredDirections?: Direction[];
    minDirectDistricts: number;
    maxCriticalPairs?: number;
    districtFloors?: {
        districtId: DistrictId;
        minScore: number;
    }[];
    indicatorFloors?: {
        districtId: DistrictId;
        indicatorId: IndicatorId;
        minValue: number;
    }[];
    maxSpend: number;
    objective: 'maxScore' | 'minCost' | 'protectDistrict';
    priorityDistrictId?: DistrictId;
}
export interface EvidenceRef {
    id: string;
    kind: 'base' | 'effect' | 'synergy' | 'clipping' | 'indicator' | 'district' | 'population' | 'critical' | 'total';
    value: number;
    inputs: string[];
    districtId?: DistrictId;
    indicatorId?: IndicatorId;
    measureId?: MeasureId;
    params?: Record<string, string | number>;
}
export interface Validation {
    valid: boolean;
    complete: boolean;
    issues: DomainIssue[];
    cost: number;
    remaining: number;
    directionCounts: Record<Direction, number>;
}
export interface DistrictEvaluation {
    districtId: DistrictId;
    populationShare: number;
    score: number;
    evidenceId: string;
    indicators: {
        indicatorId: IndicatorId;
        before: number;
        after: number;
        delta: number;
        evidenceId: string;
    }[];
}
export interface Evaluation extends Validation {
    kind: 'official' | 'sensitivity' | 'baseline-reference' | 'draft' | 'invalid';
    datasetVersion: string;
    sourceHash: string;
    rulesVersion: string;
    evaluatorVersion: string;
    decisions: Decision[];
    assumptions?: StressAssumption;
    score: number | null;
    populationMean: number;
    minimumDistrictScore: number;
    districts: DistrictEvaluation[];
    criticalPairs: {
        districtId: DistrictId;
        indicatorId: IndicatorId;
        value: number;
        evidenceId: string;
    }[];
    directDistrictIds: DistrictId[];
    affectedDistrictIds: DistrictId[];
    weakestDistrictIds: DistrictId[];
    components: {
        population: number;
        weakest: number;
        penalty: number;
    };
    evidence: EvidenceRef[];
}
export interface SearchCandidate {
    decisions: Decision[];
    evaluation: Evaluation;
}
export interface SearchResult {
    status: 'complete' | 'incomplete';
    termination: 'exhausted' | 'cancelled' | 'deadline';
    inputHash: string;
    datasetVersion: string;
    sourceHash: string;
    rulesVersion: string;
    evaluatorVersion: string;
    constraints: Constraints;
    assumptions?: StressAssumption;
    objective: Constraints['objective'];
    evaluatedCount: number;
    validCount: number;
    feasibleCount: number;
    candidates: SearchCandidate[];
    issues: DomainIssue[];
    elapsedMs: number;
    certificate: null | {
        exhaustive: true;
        inputHash: string;
        bestValue: number | null;
        feasibleCount: number;
    };
}
import { z } from 'zod';
export const decisionSchema = z.object({ measureId: z.enum(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'M14']), districtId: z.enum(DISTRICT_IDS).nullable() }).strict();
export const stressAssumptionSchema = z.object({ measureId: decisionSchema.shape.measureId, costIncreasePct: z.number().min(0).max(50), extraLagQuarters: z.number().int().min(0).max(4) }).strict();
export const constraintsSchema = z.object({ locked: z.array(decisionSchema).max(5).default([]), excludedMeasureIds: z.array(decisionSchema.shape.measureId).max(14).default([]), requiredDirections: z.array(z.enum(DIRECTIONS)).max(5).optional(), minDirectDistricts: z.number().int().min(0).max(5).default(0), maxCriticalPairs: z.number().int().min(0).max(50).optional(), districtFloors: z.array(z.object({ districtId: z.enum(DISTRICT_IDS), minScore: z.number().min(0).max(100) }).strict()).max(5).optional(), indicatorFloors: z.array(z.object({ districtId: z.enum(DISTRICT_IDS), indicatorId: z.enum(INDICATOR_IDS), minValue: z.number().min(0).max(100) }).strict()).max(50).optional(), maxSpend: z.number().min(0).max(100).default(100), objective: z.enum(['maxScore', 'minCost', 'protectDistrict']).default('maxScore'), priorityDistrictId: z.enum(DISTRICT_IDS).optional() }).strict().refine(v => v.objective !== 'protectDistrict' || !!v.priorityDistrictId, { message: 'priorityDistrictId is required' });

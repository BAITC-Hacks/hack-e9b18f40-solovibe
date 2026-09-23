import type { Constraints, Decision, Evaluation, SearchResult, StressAssumption } from './contracts';
import type { EvaluationRecord, RevisionRecord } from './records';

export interface RevisionSnapshot { revision: RevisionRecord; evaluation: EvaluationRecord }
export interface ComparisonView {
  snapshots: RevisionSnapshot[];
  differences: { revisionId: string; retained: Decision[]; added: Decision[]; removed: Decision[]; costDelta: number; scoreDelta: number | null }[];
}
export interface WorkshopSearchView {
  id: string; status: 'queued'|'running'|'completed'|'failed'|'cancelled'; errorCode: string|null;
  searchId: string|null; result: SearchResult|null; inputRevisionId: string; stale: boolean;
  alternatives: RevisionSnapshot[];
  baseline: SearchResult|null;
}
export interface StressRecord {
  id: string; scenarioId: string; sourceRevisionId: string; assumption: StressAssumption;
  baseline: Evaluation; stressed: Evaluation; repairRevisionIds: string[]; createdAt: string;
}
export interface StressView { experiment: StressRecord; stale: boolean; repairs: (RevisionSnapshot & { sensitivity: Evaluation })[]; selectedEvaluation?:Evaluation; selectedRevisionId?:string }
export type PriceCondition = keyof Pick<Constraints,'minDirectDistricts'|'maxCriticalPairs'|'maxSpend'|'requiredDirections'|'locked'|'excludedMeasureIds'|'districtFloors'|'indicatorFloors'>;

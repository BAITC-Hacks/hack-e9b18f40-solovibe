import type { Constraints, Decision, Evaluation } from "./contracts";

export interface ScenarioRecord {
  id: string;
  title: string;
  datasetVersion: string;
  currentRevisionId: string;
  createdAt: string;
  updatedAt: string;
}
export interface RevisionRecord {
  id: string;
  scenarioId: string;
  parentId: string | null;
  sourceRevisionId: string | null;
  decisions: Decision[];
  constraints: Constraints;
  intent: string;
  cause: string;
  title: string | null;
  createdAt: string;
}
export interface EvaluationRecord { id: string; revisionId: string; result: Evaluation }
export interface ScenarioView {
  scenario: ScenarioRecord;
  revision: RevisionRecord;
  evaluation: EvaluationRecord;
  alternatives: { revision: RevisionRecord; evaluation: EvaluationRecord }[];
  principalKind: "guest" | "account";
}
export interface ScenarioSummary extends ScenarioRecord { cost: number; score: number | null; decisionCount: number }
export interface ScenarioList { items: ScenarioSummary[]; nextCursor: string | null; principalKind: "guest" | "account" }
export interface ApiProblem {
  code: string;
  messageKey: string;
  params?: Record<string, string | number>;
  fieldIssues?: { code: string; params: Record<string, string | number | boolean> }[];
  retryAfterSeconds?: number;
  requestId: string;
}

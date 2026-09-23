import { z } from "zod";
import type { EvaluationRecord, RevisionRecord } from "./records";
import { constraintsSchema, stressAssumptionSchema } from "./contracts";

export const runStatuses = ["queued", "running", "waiting_input", "completed", "failed", "cancelled"] as const;
export type RunStatus = typeof runStatuses[number];
export const evidenceLinkSchema = z.object({ evaluationId: z.string().min(1).max(120), evidenceId: z.string().min(1).max(300), compareToEvaluationId: z.string().min(1).max(120).optional() }).strict();
export const analysisBlockSchema = z.object({ kind: z.enum(["benefit", "tradeoff", "risk", "limitation", "infeasible", "noImprovement"]), text: z.string().trim().min(10).max(700), refs: z.array(evidenceLinkSchema).max(8) }).strict();
export const analysisDocumentSchema = z.object({
  blocks: z.array(analysisBlockSchema).min(2).max(6),
  claims: z.array(z.enum(["noCriticalPairs", "allDirections", "optimal", "improvedScore", "preservedLocks"])).max(5),
  candidateRevisionId: z.string().uuid().optional(), searchId: z.string().uuid().optional(),
  relaxation: z.enum(["requiredDirections", "maxCriticalPairs", "locked", "excludedMeasureIds", "minDirectDistricts", "districtFloors", "indicatorFloors", "maxSpend"]).optional(),
}).strict();
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type AnalysisDocument = z.infer<typeof analysisDocumentSchema>;
export type AnalysisBlock = z.infer<typeof analysisBlockSchema>;
export interface AnalysisRecord { id: string; runId: string; sourceRevisionId: string; document: AnalysisDocument; createdAt: string }
export interface RunRecord {
  id: string; scenarioId: string; inputRevisionId: string; parentRunId: string | null;
  procedure: "plan" | "explain"; objective: string; locale: "ru" | "kk" | "en"; status: RunStatus;
  errorCode: string | null; question: string | null; analysisId: string | null; alternativeRevisionIds: string[];
  createdAt: string; updatedAt: string; usage: { inputTokens: number; outputTokens: number };
}
export interface RunEvent { runId: string; seq: number; kind: "status" | "tool" | "result"; status: string; toolName: string | null; payload: Record<string, string | number | boolean | null>; createdAt: string }
export interface RunView { run: RunRecord; events: RunEvent[]; analysis: AnalysisRecord | null; source: { revision: RevisionRecord; evaluation: EvaluationRecord }; alternatives: { revision: RevisionRecord; evaluation: EvaluationRecord }[]; stale: boolean }
export const createRunSchema = z.object({ scenarioId: z.string().uuid(), inputRevisionId: z.string().uuid(), procedure: z.enum(["plan", "explain"]), objective: z.string().trim().min(3).max(2000), locale: z.enum(["ru", "kk", "en"]).default("ru"), clientRequestId: z.string().uuid(), parentRunId: z.string().uuid().optional() }).strict();
export const createSearchSchema = z.object({ scenarioId: z.string().uuid(), inputRevisionId: z.string().uuid(), constraints: constraintsSchema, assumptions: stressAssumptionSchema.optional(), limit: z.number().int().min(1).max(3).default(3), clientRequestId: z.string().uuid() }).strict();
export type SearchJobInput = z.infer<typeof createSearchSchema>;

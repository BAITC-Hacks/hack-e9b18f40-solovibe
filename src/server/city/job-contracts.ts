import type { CityTx } from "@/server/db/core";
import type { cityRuns } from "@/server/db/schema";
export interface JobLease {
  id: string; runId: string; ownerId: string; token: number; workerId: string; deadlineAt: Date; signal: AbortSignal;
}
export type StoredRun = typeof cityRuns.$inferSelect;
export interface ToolExecution {
  lease: JobLease;
  run: StoredRun;
  /** Prepare outside the transaction; commit performs any mutation within the checked lease and receipt transaction. */
  tool<T, P = T>(name: string, input: unknown, prepare: () => Promise<P>, commit?: (tx: CityTx, prepared: P) => Promise<T>): Promise<T>;
  updateUsage(inputTokens: number, outputTokens: number): Promise<void>;
}

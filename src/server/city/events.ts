import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { cityRunEvents, cityRuns } from "@/server/db/schema";
import type { CityTx } from "@/server/db/core";
import type { RunEvent } from "@/features/city/ai-contracts";
export async function appendEvent(tx: CityTx, runId: string, event: Pick<RunEvent, "kind" | "status"> & { toolName?: string; payload?: RunEvent["payload"] }) {
  const [run] = await tx.update(cityRuns).set({ eventSeq: sql`${cityRuns.eventSeq}+1`, updatedAt: new Date() }).where(eq(cityRuns.id, runId)).returning({ seq: cityRuns.eventSeq });
  if (!run) throw new Error("RUN_MISSING");
  await tx.insert(cityRunEvents).values({ id: randomUUID(), runId, seq: run.seq, kind: event.kind, status: event.status, toolName: event.toolName, payload: event.payload ?? {} });
}

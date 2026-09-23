import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { cityRateWindows } from "@/server/db/schema";
import type { CityTx } from "@/server/db/core";
import { CityError } from "./errors";

export function anonymousNetworkKey(ip: string) {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET || "local-development").update(ip.slice(0, 128)).digest("hex");
}
export async function consumeRate(tx: CityTx, key: string, limit: number) {
  const now = Date.now(); const windowStart = new Date(Math.floor(now / 3600000) * 3600000);
  await tx.insert(cityRateWindows).values({ key, windowStart, count: 0 }).onConflictDoNothing();
  const [row] = await tx.select().from(cityRateWindows).where(eq(cityRateWindows.key, key)).for("update");
  const count = row.windowStart.getTime() === windowStart.getTime() ? row.count : 0;
  if (count >= limit) throw new CityError("RATE_LIMITED", 429, undefined, Math.ceil((windowStart.getTime() + 3600000 - now) / 1000));
  await tx.update(cityRateWindows).set({ windowStart, count: count + 1 }).where(eq(cityRateWindows.key, key));
}

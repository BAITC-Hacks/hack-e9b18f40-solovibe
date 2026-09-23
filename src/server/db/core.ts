import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Node-only shared runtime. Next entry points import the guarded ./index module.
const globalDb = globalThis as unknown as { citySql?: ReturnType<typeof postgres> };
export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return globalDb.citySql ??= postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 5 });
}
export function getDb() { return drizzle(getSql(), { schema }); }
export type CityDb = ReturnType<typeof getDb>;
export type CityTx = Parameters<Parameters<CityDb["transaction"]>[0]>[0];

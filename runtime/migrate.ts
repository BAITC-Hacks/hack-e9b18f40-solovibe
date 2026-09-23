import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { AKIM_DATASET } from "../src/features/city/data/akim-v1";

async function main() {
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations");
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
let locked = false;
try {
  await sql.unsafe("SET lock_timeout = '60s'");
  await sql.unsafe("select pg_advisory_lock(853672914)");
  locked = true;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  if (!/^[a-f0-9]{64}$/.test(AKIM_DATASET.canonicalHash)) throw new Error("Dataset canonical hash must be finalized before seeding.");
  await sql`insert into city_datasets (id, source_hash, rules_version, evaluator_version, payload)
    values (${AKIM_DATASET.version}, ${AKIM_DATASET.sourceHash}, ${AKIM_DATASET.rulesVersion},
      ${AKIM_DATASET.evaluatorVersion}, ${JSON.stringify(AKIM_DATASET)}::jsonb)
    on conflict (id) do nothing`;
  const [seed] = await sql`select source_hash, rules_version, evaluator_version, payload->>'canonicalHash' as canonical_hash from city_datasets where id = ${AKIM_DATASET.version}`;
  if (seed.source_hash !== AKIM_DATASET.sourceHash || seed.canonical_hash !== AKIM_DATASET.canonicalHash || seed.rules_version !== AKIM_DATASET.rulesVersion || seed.evaluator_version !== AKIM_DATASET.evaluatorVersion) {
    throw new Error("Dataset version already exists with different content; publish a new version.");
  }
  console.log("Database migrations applied.");
} finally {
  if (locked) await sql.unsafe("select pg_advisory_unlock(853672914)");
  await sql.end();
}
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});

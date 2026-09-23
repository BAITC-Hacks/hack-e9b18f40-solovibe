import "dotenv/config";
import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL || "", { max: 1, connect_timeout: 3 });
  try {
    const rows = await sql`select id from city_worker_heartbeats where id=${process.env.CITY_WORKER_ID || "primary"} and revision=${process.env.APP_REVISION || "local"} and seen_at > now()-interval '35 seconds'`;
    if (!rows.length) process.exitCode = 1;
  } catch { process.exitCode = 1; }
  finally { await sql.end(); }
}
void main();

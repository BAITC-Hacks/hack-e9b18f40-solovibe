import { getSql } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getSql()`select 1`;
    const revision = process.env.APP_REVISION ?? "local";
    let worker = { status: "not_required", revision };
    if (process.env.CITY_REQUIRE_WORKER === "1") {
      const rows = await getSql()`select revision from city_worker_heartbeats where revision=${revision} and seen_at > now()-interval '35 seconds' limit 1`;
      worker = { status: rows.length ? "ok" : "unavailable", revision };
    }
    const ok = worker.status !== "unavailable";
    return Response.json({ status: ok ? "ok" : "unavailable", revision, worker, aiConfigured: !!process.env.OPENAI_API_KEY }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

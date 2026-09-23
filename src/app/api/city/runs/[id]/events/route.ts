import { resolvePrincipal } from "@/server/city/owners";
import { getRunEvents, requireRun } from "@/server/city/runs";
import { CityError, problemResponse } from "@/server/city/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const principal = await resolvePrincipal();
    await requireRun(principal, id);
    const requested = Number(new URL(request.url).searchParams.get("after") || 0);
    const last = Number(request.headers.get("last-event-id") || 0);
    if (![requested, last].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000)) throw new CityError("INVALID_REQUEST");
    let cursor = Math.max(requested, last);
    let stopped = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const started = Date.now();
        const send = (value: string) => { if (!stopped && !request.signal.aborted) controller.enqueue(encoder.encode(value)); };
        send(": connected\n\n");
        try {
          while (!stopped && !request.signal.aborted && Date.now() - started < 30000) {
            // Re-resolve access during replay as well as at connection establishment.
            const activePrincipal = await resolvePrincipal();
            const events = await getRunEvents(activePrincipal, id, cursor);
            for (const event of events) { send(`id: ${event.seq}\nevent: city\ndata: ${JSON.stringify(event)}\n\n`); cursor = event.seq; }
            const run = await requireRun(activePrincipal, id);
            if (!["queued", "running"].includes(run.status)) break;
            if (!events.length) send(": keepalive\n\n");
            await new Promise<void>(resolve => setTimeout(resolve, 650));
          }
        } catch { send("event: unavailable\ndata: {}\n\n"); }
        finally { if (!stopped) { stopped = true; controller.close(); } }
      },
      cancel() { stopped = true; },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" } });
  } catch (error) { return problemResponse(error); }
}

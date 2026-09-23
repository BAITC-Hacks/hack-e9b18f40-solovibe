import { z } from "zod";
import { CityError, problemResponse } from "./errors";
import { trustedAppOrigins } from "@/server/origins";

export function assertSameOrigin(request: Request) {
  if (!trustedAppOrigins().includes(request.headers.get("origin") ?? "") || request.headers.get("sec-fetch-site") === "cross-site") throw new CityError("FORBIDDEN", 403);
}
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new CityError("INVALID_REQUEST", 400);
  if (Number(request.headers.get("content-length")) > 65536) throw new CityError("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CityError("INVALID_REQUEST");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new CityError("BODY_TOO_LARGE", 413); }
    chunks.push(value);
  }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new CityError("INVALID_REQUEST"); }
  const result = schema.safeParse(input);
  if (!result.success) throw new CityError("INVALID_REQUEST");
  return result.data;
}
export function cityRoute(handler: () => Promise<unknown>, status = 200): Promise<Response> {
  return handler().then(data => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } })).catch(problemResponse);
}

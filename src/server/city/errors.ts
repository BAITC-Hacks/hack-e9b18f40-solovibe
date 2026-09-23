import type { ApiProblem } from "@/features/city/records";
import type { DomainIssue } from "@/features/city/contracts";

export class CityError extends Error {
  constructor(public code: string, public status = 400, public fieldIssues?: DomainIssue[], public retryAfterSeconds?: number) {
    super(code);
  }
}
export function problemResponse(error: unknown) {
  const requestId = crypto.randomUUID();
  const known = error instanceof CityError;
  if (!known) {
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code).slice(0, 40) : undefined;
    console.error("city_request_failed", { requestId, name: error instanceof Error ? error.name : "unknown", code });
  }
  const code = known ? error.code : "STORAGE_UNAVAILABLE";
  const problem: ApiProblem = { code, messageKey: `errors.${code}`, requestId,
    ...(known && error.fieldIssues ? { fieldIssues: error.fieldIssues } : {}),
    ...(known && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) };
  return Response.json(problem, { status: known ? error.status : 503, headers: {
    "Cache-Control": "private, no-store", ...(known && error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}) } });
}

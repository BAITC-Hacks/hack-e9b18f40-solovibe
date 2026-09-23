import type { ApiProblem } from "@/features/city/records";
export class ApiFailure extends Error {
  constructor(public problem: ApiProblem) { super(problem.code); }
}
export async function cityApi<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/city${path}`, { method: options.method ?? "GET", headers: options.body === undefined ? {} : { "Content-Type": "application/json" }, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal, cache: "no-store" }); }
  catch (error) { if (options.signal?.aborted) throw error; throw new ApiFailure({ code: "NETWORK", messageKey: "errors.NETWORK", requestId: "" }); }
  const data = await response.json();
  if (!response.ok) throw new ApiFailure(data);
  return data;
}
export function errorCode(error: unknown) { return error instanceof ApiFailure ? error.problem.code : "NETWORK"; }

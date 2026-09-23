import type { RunRecord, RunView } from "../ai-contracts";
import type { ApiProblem, ScenarioView } from "../records";

export interface RunProblem extends ApiProblem {
  run?: RunView;
}

export class AiApiError extends Error {
  readonly status: number;
  readonly problem: RunProblem;

  constructor(status: number, problem: RunProblem) {
    super(problem.code);
    this.name = "AiApiError";
    this.status = status;
    this.problem = problem;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | RunProblem;
  if (!response.ok) throw new AiApiError(response.status, body as RunProblem);
  return body as T;
}

export interface CreateRunInput {
  scenarioId: string;
  inputRevisionId: string;
  procedure: "plan" | "explain" | "brief";
  context?:import('../ai-contracts').RunContext;
  objective: string;
  locale: "ru" | "kk" | "en";
  clientRequestId: string;
  parentRunId?: string;
}

export async function createRun(input: CreateRunInput, signal?: AbortSignal): Promise<RunView> {
  const response = await fetch("/api/city/runs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return readJson<RunView>(response);
}

export interface RunListPage {
  items: RunRecord[];
  nextCursor: string | null;
}

export async function listRuns(scenarioId: string, before?: string, signal?: AbortSignal): Promise<RunListPage> {
  const query = new URLSearchParams({ scenarioId });
  if (before) query.set("before", before);
  const response = await fetch(`/api/city/runs?${query.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readJson<RunListPage>(response);
}

export async function getRun(runId: string, signal?: AbortSignal): Promise<RunView> {
  const response = await fetch(`/api/city/runs/${encodeURIComponent(runId)}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readJson<RunView>(response);
}

export async function cancelRun(runId: string, signal?: AbortSignal): Promise<RunView> {
  const response = await fetch(`/api/city/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal,
  });
  return readJson<RunView>(response);
}

export async function applyAlternative(
  scenarioId: string,
  input: { revisionId: string; expectedRevisionId: string; clientMutationId: string },
  signal?: AbortSignal,
): Promise<ScenarioView> {
  const response = await fetch(`/api/city/scenarios/${encodeURIComponent(scenarioId)}/apply`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return readJson<ScenarioView>(response);
}

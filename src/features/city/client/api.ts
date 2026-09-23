import type { ApiProblem, ScenarioView } from "../records";
import type { Constraints, Decision } from "../contracts";

export class CityApiError extends Error {
  readonly status: number;
  readonly problem: ApiProblem;

  constructor(status: number, problem: ApiProblem) {
    super(problem.code);
    this.name = "CityApiError";
    this.status = status;
    this.problem = problem;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiProblem;
  if (!response.ok) throw new CityApiError(response.status, body as ApiProblem);
  return body as T;
}

export async function getScenario(scenarioId: string, signal?: AbortSignal): Promise<ScenarioView> {
  const response = await fetch(`/api/city/scenarios/${encodeURIComponent(scenarioId)}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readJson<ScenarioView>(response);
}

export interface SaveRevisionInput {
  expectedRevisionId: string;
  decisions: Decision[];
  constraints: Constraints;
  clientMutationId: string;
  intent?: string;
}

export async function saveRevision(scenarioId: string, input: SaveRevisionInput, signal?: AbortSignal): Promise<ScenarioView> {
  const response = await fetch(`/api/city/scenarios/${encodeURIComponent(scenarioId)}/revisions`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return readJson<ScenarioView>(response);
}

export async function renameScenario(scenarioId: string, title: string, signal?: AbortSignal): Promise<ScenarioView> {
  const response = await fetch(`/api/city/scenarios/${encodeURIComponent(scenarioId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
    signal,
  });
  return readJson<ScenarioView>(response);
}

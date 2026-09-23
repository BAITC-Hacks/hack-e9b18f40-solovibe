import type { Constraints, Decision } from "../contracts";
import { canonicalDecisions } from "../engine";
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${stable(v)}`).join(",")}}`;
}
// Decision order and JSON object key order have no domain meaning.
export function draftFingerprint(decisions: readonly Decision[], constraints: Constraints) {
  return stable([canonicalDecisions(decisions), constraints]);
}

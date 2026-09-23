import type { Dataset, Decision, StressAssumption } from './contracts';
import { calculateNumeric, canonicalDecisions, evaluate, validateDecisions } from './engine';

/** Exact Shapley allocation. Subsets are mathematical diagnostics, never submissions. */
export function getAttribution(dataset: Dataset, decisions: readonly Decision[], assumptions?: StressAssumption) {
  const validation = validateDecisions(dataset, decisions, assumptions);
  if (!validation.valid || !validation.complete) throw new Error('ATTRIBUTION_REQUIRES_VALID_COMPLETE_PLAN');
  const ordered = canonicalDecisions(decisions);
  const scores = Array.from({ length: 32 }, (_, mask) => calculateNumeric(dataset, ordered.filter((_, i) => mask & (1 << i)), assumptions).score);
  const factorial = [1, 1, 2, 6, 24, 120];
  const perMeasure = ordered.map((decision, i) => {
    let value = 0;
    for (let mask = 0; mask < 32; mask++) {
      if (mask & (1 << i)) continue;
      const count = mask.toString(2).replaceAll('0', '').length;
      value += factorial[count] * factorial[4 - count] / factorial[5] * (scores[mask | (1 << i)] - scores[mask]);
    }
    return { decision, value };
  });
  return { baseline: scores[0], final: scores[31], perMeasure, method: 'shapley' as const, evidenceRefs: evaluate(dataset, ordered, assumptions).evidence.filter(e => e.kind === 'total' || e.kind === 'effect' || e.kind === 'synergy' || e.kind === 'clipping' || e.kind === 'critical').map(e => e.id) };
}

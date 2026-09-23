import assert from 'node:assert/strict';
import test from 'node:test';
import { getAttribution } from '../attribution';
import { AKIM_DATASET, EXAMPLE_DECISIONS } from '../data/akim-v1';
import { evaluate, evaluateBaseline } from '../engine';
import type { Decision } from '../contracts';

test('exact Shapley conserves total change with synergy and threshold crossings', () => {
  const evaluation = evaluate(AKIM_DATASET, EXAMPLE_DECISIONS);
  const result = getAttribution(AKIM_DATASET, EXAMPLE_DECISIONS);
  assert.equal(result.final, evaluation.score);
  assert.equal(result.baseline, evaluateBaseline(AKIM_DATASET).score);
  assert.ok(evaluation.evidence.some(e => e.kind === 'synergy'));
  assert.ok(evaluation.districts.some(d => d.indicators.some(i => i.before < 40 && i.after >= 40)));
  assert.ok(Math.abs(result.perMeasure.reduce((s, m) => s + m.value, 0) - (result.final - result.baseline)) < 1e-10);
  assert.deepEqual(getAttribution(AKIM_DATASET, [...EXAMPLE_DECISIONS].reverse()), result);
});

test('Shapley equals averaging all 120 orders under delay and clipping', () => {
  const dataset = { ...AKIM_DATASET, districts: AKIM_DATASET.districts.map(d => ({ ...d, indicators: { ...d.indicators, B1: 99 } })) };
  const assumption = { measureId: 'M8' as const, extraLagQuarters: 2, costIncreasePct: 0 };
  const result = getAttribution(dataset, EXAMPLE_DECISIONS, assumption);
  assert.ok(evaluate(dataset, EXAMPLE_DECISIONS, assumption).evidence.some(e => e.kind === 'clipping'));
  const sums = new Map<string, number>();
  let orders = 0;
  // Count each marginal once per completed order, using explicit permutations.
  function permutations(items: Decision[]): Decision[][] { return items.length ? items.flatMap((d, i) => permutations(items.filter((_, j) => i !== j)).map(t => [d, ...t])) : [[]]; }
  for (const order of permutations(EXAMPLE_DECISIONS)) {
    let previous = result.baseline;
    order.forEach((d, i) => {
      const e = evaluate(dataset, order.slice(0, i + 1), assumption);
      const score = e.components.population + e.components.weakest - e.components.penalty;
      sums.set(d.measureId, (sums.get(d.measureId) ?? 0) + score - previous);
      previous = score;
    });
    orders++;
  }
  assert.equal(orders, 120);
  for (const row of result.perMeasure) assert.ok(Math.abs(row.value - sums.get(row.decision.measureId)! / orders) < 1e-10);
});

test('invalid and incomplete submissions have no allocation', () => {
  assert.throws(() => getAttribution(AKIM_DATASET, []), /VALID_COMPLETE/);
  assert.throws(() => getAttribution(AKIM_DATASET, [...EXAMPLE_DECISIONS.slice(0, 4), EXAMPLE_DECISIONS[0]]), /VALID_COMPLETE/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_DECISIONS, DEFAULT_CONSTRAINTS } from "../data/akim-v1";
import { canonicalDecisions } from "../engine";
import { draftFingerprint } from "./draft-key";
test("server canonical order is an acknowledgement, not another-tab conflict", () => {
  const serverConstraints = { objective: DEFAULT_CONSTRAINTS.objective, maxSpend: 100, minDirectDistricts: 0, excludedMeasureIds: [], locked: [] };
  assert.equal(draftFingerprint(EXAMPLE_DECISIONS, DEFAULT_CONSTRAINTS), draftFingerprint(canonicalDecisions(EXAMPLE_DECISIONS), serverConstraints));
  assert.notEqual(draftFingerprint(EXAMPLE_DECISIONS, DEFAULT_CONSTRAINTS), draftFingerprint(EXAMPLE_DECISIONS.slice(0,4), serverConstraints));
});

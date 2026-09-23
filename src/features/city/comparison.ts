import type { ComparisonView, RevisionSnapshot } from './workshop-contracts';
import type { Decision } from './contracts';
const same = (a: Decision, b: Decision) => a.measureId === b.measureId && a.districtId === b.districtId;
export function compareSnapshots(snapshots: RevisionSnapshot[]): ComparisonView {
  if (!snapshots.length || snapshots.length > 3) throw new Error('INVALID_COMPARISON');
  const base = snapshots[0].evaluation.result;
  for (const {evaluation: {result}} of snapshots) {
    if (result.datasetVersion !== base.datasetVersion || result.sourceHash !== base.sourceHash || result.rulesVersion !== base.rulesVersion || result.evaluatorVersion !== base.evaluatorVersion || result.kind !== base.kind || result.assumptions || base.assumptions) throw new Error('INCOMPATIBLE_COMPARISON');
  }
  return { snapshots, differences: snapshots.map(({revision, evaluation: {result}}) => ({
    revisionId: revision.id, retained: result.decisions.filter(d => base.decisions.some(b => same(b,d))),
    added: result.decisions.filter(d => !base.decisions.some(b => same(b,d))), removed: base.decisions.filter(d => !result.decisions.some(b => same(b,d))),
    costDelta: result.cost - base.cost, scoreDelta: result.score === null || base.score === null ? null : result.score - base.score,
  })) };
}

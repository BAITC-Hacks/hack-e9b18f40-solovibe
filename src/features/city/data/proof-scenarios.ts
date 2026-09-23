import type { Decision } from '../contracts';
// Immutable examples, calculated by the production evaluator. An optimum label requires a matching search certificate.
export const PROOF_DECISIONS:Record<'best'|'two-districts',Decision[]> = {
  best:[{measureId:'M2',districtId:null},{measureId:'M3',districtId:'nura'},{measureId:'M8',districtId:'nura'},{measureId:'M9',districtId:'nura'},{measureId:'M14',districtId:null}],
  'two-districts':[{measureId:'M3',districtId:'nura'},{measureId:'M7',districtId:'nura'},{measureId:'M8',districtId:'nura'},{measureId:'M11',districtId:'yesil'},{measureId:'M14',districtId:null}],
};

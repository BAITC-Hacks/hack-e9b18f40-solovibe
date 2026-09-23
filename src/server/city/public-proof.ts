import { AKIM_DATASET } from '@/features/city/data/akim-v1';
import { PROOF_DECISIONS } from '@/features/city/data/proof-scenarios';
import { evaluate } from '@/features/city/engine';
const proof = {best:evaluate(AKIM_DATASET,PROOF_DECISIONS.best),twoDistricts:evaluate(AKIM_DATASET,PROOF_DECISIONS['two-districts'])};
export function publicProof(){return proof;}

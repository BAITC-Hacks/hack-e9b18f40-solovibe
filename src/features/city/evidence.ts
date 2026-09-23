import type { Evaluation, EvidenceRef } from './contracts';
export function readEvidence(evaluation: Evaluation, ids: readonly string[]): EvidenceRef[] {
    if (ids.length > 20)
        throw new Error('EVIDENCE_LIMIT');
    const index = new Map(evaluation.evidence.map(e => [e.id, e]));
    return ids.map(id => {
        const e = index.get(id);
        if (!e)
            throw new Error('UNKNOWN_EVIDENCE');
        return e;
    });
}
/** Resolve the complete dependency graph in topological order, scoped to the supplied evaluation. */
export function evidenceGraph(evaluation: Evaluation, id: string): EvidenceRef[] {
    const index = new Map(evaluation.evidence.map(e => [e.id, e]));
    const seen = new Set<string>(), out: EvidenceRef[] = [];
    function visit(key: string) {
        if (seen.has(key))
            return;
        const e = index.get(key);
        if (!e)
            throw new Error('UNKNOWN_EVIDENCE');
        seen.add(key);
        e.inputs.forEach(visit);
        out.push(e);
    }
    visit(id);
    return out;
}

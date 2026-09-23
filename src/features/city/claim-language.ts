// Explicit uncertainty is not a positive guarantee. Keep positive promises subject to the normal quality gate.
export function withoutNegatedGuarantees(text:string){return text.replace(/не\s+(?:может\s+)?гарантир\p{L}*|not\s+guaranteed|cannot\s+guarantee|does\s+not\s+guarantee/giu,'');}

import type { Evaluation, EvidenceRef } from '../contracts';
import type { BriefView } from './contracts';
import type { RevisionSnapshot } from '../workshop-contracts';
import { AKIM_DATASET } from '../data/akim-v1';
import ru from '../../../../messages/ru.json';
import kk from '../../../../messages/kk.json';
import en from '../../../../messages/en.json';
export type ExportLocale = 'ru' | 'kk' | 'en';
const labels = { ru: { measure: 'Мера', source: 'Источник и модель', version: 'Версия', historical: 'Сохранённый снимок: последующие изменения не включены.', review: 'Текст требует проверки', user: 'Авторский текст', stale: 'Основание изменилось', stress: 'Проверка допущений', notes: 'Числа без округления; стоимость — условные единицы, задержка — кварталы. Десятичный разделитель: точка.' }, kk: { measure: 'Шара', source: 'Дереккөз және модель', version: 'Нұсқа', historical: 'Сақталған көшірме: кейінгі өзгерістер енгізілмеген.', review: 'Мәтінді тексеру қажет', user: 'Автор мәтіні', stale: 'Негіз өзгерді', stress: 'Болжамдарды тексеру', notes: 'Сандар дөңгелектелмеген; құны — шартты бірлік, кідіріс — тоқсан. Ондық бөлгіш: нүкте.' }, en: { measure: 'Measure', source: 'Source and model', version: 'Version', historical: 'Saved snapshot: subsequent changes are not included.', review: 'Text needs review', user: 'Author text', stale: 'Premise changed', stress: 'Assumption test', notes: 'Numbers are unrounded; cost is in virtual units, delay in quarters. Decimal separator: dot.' } };
const sectionLabels = { ru: { goal: 'Цель', benefits: 'Польза', tradeoffs: 'Компромиссы', risks: 'Риски', assumptions: 'Допущения', rationale: 'Обоснование', limits: 'Ограничения' }, kk: { goal: 'Мақсат', benefits: 'Пайда', tradeoffs: 'Ымыралар', risks: 'Тәуекелдер', assumptions: 'Болжамдар', rationale: 'Негіздеме', limits: 'Шектеулер' }, en: { goal: 'Goal', benefits: 'Benefits', tradeoffs: 'Tradeoffs', risks: 'Risks', assumptions: 'Assumptions', rationale: 'Rationale', limits: 'Limits' } };
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function csvCell(value: unknown) { const raw = String(value ?? ''); const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw; return '"' + safe.replaceAll('"', '""') + '"'; }
function dictionary(locale: ExportLocale) { return { ru, kk, en }[locale]; }
export function exportTables(source: RevisionSnapshot, locale: ExportLocale) {
    const d = dictionary(locale), l = labels[locale], e = source.evaluation.result;
    const measures: unknown[][] = [[l.measure, d.common.district, d.common.cost, d.common.lag], ...source.revision.decisions.map(x => { const m = AKIM_DATASET.measures.find(m => m.id === x.measureId)!; return [x.measureId + ' · ' + d.measures[x.measureId], x.districtId ? d.districts[x.districtId] : d.common.city, m.cost, m.lag]; })];
    const indicators: unknown[][] = [[d.common.district, 'ID', d.common.baseline, d.common.after, 'Δ'], ...e.districts.flatMap(x => x.indicators.map(i => [d.districts[x.districtId], i.indicatorId + ' · ' + d.indicators[i.indicatorId], i.before, i.after, i.delta]))];
    const provenance: unknown[][] = [['revisionId', source.revision.id], ['evaluationId', source.evaluation.id], ['datasetVersion', e.datasetVersion], ['sourceHash', e.sourceHash], ['rulesVersion', e.rulesVersion], ['evaluatorVersion', e.evaluatorVersion], ['kind', e.kind], ['Score', e.score], ['cost', e.cost], ['remaining', e.remaining], ['populationMean', e.populationMean], ['minimumDistrictScore', e.minimumDistrictScore], ...Object.entries(e.components).map(([k, v]) => ['component.' + k, v])];
    return { measures, indicators, provenance };
}
export function renderScenarioCsv(source: RevisionSnapshot, locale: ExportLocale) { const t = exportTables(source, locale); return '\uFEFF' + [[labels[locale].notes], ...t.measures, [], ...t.indicators, [], ...t.provenance, [], ['constraints', JSON.stringify(source.revision.constraints)]].map(row => row.map(csvCell).join(',')).join('\r\n'); }
const documentLabels = {
    ru: { result: 'Результат выбранного плана', districts: 'Результаты районов', indicators: 'Изменения показателей', evidence: 'Основание', value: 'Значение', comparison: 'Сравнение', delta: 'Разница', selected: 'Выбранный план при допущении', original: 'Исходный план', stressed: 'Исходный план при допущении', costIncrease: 'Рост стоимости, %', extraLag: 'Дополнительная задержка, кварталы', population: 'Среднее с учётом населения', weakest: 'Минимальный балл района', unavailable: 'Нет подтверждённого значения', sourcePlan: 'Выбранный план', alternative: 'Альтернатива', reference: 'Ссылка на расчёт', numeric: 'Числа приведены без округления. Стоимость в условных единицах, задержка в кварталах. Десятичный разделитель: точка.', kind: { base: 'Исходное значение', effect: 'Эффект меры', synergy: 'Совместный эффект', clipping: 'Поправка к границам', indicator: 'Итоговый показатель', district: 'Балл района', population: 'Среднее с учётом населения', critical: 'Штраф за критический показатель', total: 'Итоговый балл' } },
    kk: { result: 'Таңдалған жоспар нәтижесі', districts: 'Аудандар нәтижелері', indicators: 'Көрсеткіштер өзгерісі', evidence: 'Негіз', value: 'Мәні', comparison: 'Салыстыру', delta: 'Айырма', selected: 'Болжам кезіндегі таңдалған жоспар', original: 'Бастапқы жоспар', stressed: 'Болжам кезіндегі бастапқы жоспар', costIncrease: 'Құнның өсуі, %', extraLag: 'Қосымша кідіріс, тоқсан', population: 'Халық санымен өлшенген орташа мән', weakest: 'Ауданның ең төменгі балы', unavailable: 'Расталған мән жоқ', sourcePlan: 'Таңдалған жоспар', alternative: 'Баламалы жоспар', reference: 'Есепке сілтеме', numeric: 'Сандар дөңгелектелмеген. Құны шартты бірліктермен, кідірісі тоқсанмен берілген. Ондық бөлгіш: нүкте.', kind: { base: 'Бастапқы мән', effect: 'Шара әсері', synergy: 'Бірлескен әсер', clipping: 'Шекараларға түзету', indicator: 'Қорытынды көрсеткіш', district: 'Аудан балы', population: 'Халық санымен өлшенген орташа мән', critical: 'Сындарлы көрсеткіш айыппұлы', total: 'Қорытынды балл' } },
    en: { result: 'Selected plan result', districts: 'District results', indicators: 'Indicator changes', evidence: 'Evidence', value: 'Value', comparison: 'Comparison', delta: 'Difference', selected: 'Selected plan under assumption', original: 'Original plan', stressed: 'Original plan under assumption', costIncrease: 'Cost increase, %', extraLag: 'Additional delay, quarters', population: 'Population weighted mean', weakest: 'Lowest district score', unavailable: 'No verified value', sourcePlan: 'Selected plan', alternative: 'Alternative', reference: 'Calculation reference', numeric: 'Numbers are unrounded. Cost is in virtual units and delay in quarters. Decimal separator: dot.', kind: { base: 'Initial value', effect: 'Measure effect', synergy: 'Combined effect', clipping: 'Boundary correction', indicator: 'Resulting indicator', district: 'District score', population: 'Population weighted mean', critical: 'Critical indicator penalty', total: 'Total score' } },
};
function table(rows: unknown[][], caption?: string) {
    const [header, ...body] = rows;
    return '<table>' + (caption ? `<caption>${escapeHtml(caption)}</caption>` : '') + '<thead><tr>' + header.map(v => `<th scope="col">${escapeHtml(v)}</th>`).join('') + '</tr></thead><tbody>' + body.map(row => '<tr>' + row.map(v => `<td>${escapeHtml(v)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
}
function evaluationSources(view: BriefView, locale: ExportLocale) {
    const l = documentLabels[locale];
    const entries: {
        id: string;
        revisionId: string;
        label: string;
        result: Evaluation;
    }[] = [
        { id: view.source.evaluation.id, revisionId: view.source.revision.id, label: l.sourcePlan, result: view.source.evaluation.result },
        ...view.comparisons.map((s, i) => ({ id: s.evaluation.id, revisionId: s.revision.id, label: `${l.alternative} ${i + 1}`, result: s.evaluation.result })),
    ];
    if (view.stress) {
        const experiment = view.stress.experiment;
        entries.push({ id: `stress:${experiment.id}:baseline`, revisionId: experiment.sourceRevisionId, label: l.original, result: experiment.baseline }, { id: `stress:${experiment.id}:stressed`, revisionId: experiment.sourceRevisionId, label: l.stressed, result: experiment.stressed });
        if (view.stress.selectedEvaluation)
            entries.push({ id: `stress:${experiment.id}:selected`, revisionId: view.stress.selectedRevisionId ?? view.source.revision.id, label: l.selected, result: view.stress.selectedEvaluation });
    }
    return new Map(entries.map(e => [e.id, e]));
}
function evidenceName(ref: EvidenceRef, locale: ExportLocale) {
    const d = dictionary(locale), l = documentLabels[locale];
    return [ref.districtId ? d.districts[ref.districtId] : null, ref.indicatorId ? d.indicators[ref.indicatorId] : null, ref.measureId ? d.measures[ref.measureId] : null, l.kind[ref.kind]].filter(Boolean).join(', ');
}
export function renderBriefHtml(view: BriefView, locale: ExportLocale = view.brief.locale) {
    const { brief, source } = view, l = labels[locale], n = documentLabels[locale], d = dictionary(locale), e = source.evaluation.result;
    const sources = evaluationSources(view, locale), usedSources = new Set<string>([source.evaluation.id]);
    const sections = brief.sections.map(section => {
        const references = section.refs.map(link => {
            const record = sources.get(link.evaluationId), ref = record?.result.evidence.find(r => r.id === link.evidenceId);
            if (!record || !ref)
                return `<p class="evidence">${escapeHtml(n.unavailable)}</p>`;
            usedSources.add(record.id);
            const compared = link.compareToEvaluationId ? sources.get(link.compareToEvaluationId) : undefined;
            const before = compared?.result.evidence.find(r => r.id === link.evidenceId);
            if (compared && before) {
                usedSources.add(compared.id);
                return table([[n.evidence, compared.label, record.label, n.delta], [evidenceName(ref, locale), before.value, ref.value, ref.value - before.value]]);
            }
            return `<p class="evidence">${escapeHtml(record.label)}: ${escapeHtml(evidenceName(ref, locale))}. ${escapeHtml(n.value)}: ${escapeHtml(ref.value)}.</p>`;
        }).join('');
        return `<section class="narrative"><h2>${escapeHtml(sectionLabels[locale][section.id])}</h2>${section.userEdited ? `<p class="annotation">${escapeHtml(l.user)}</p>` : ''}${section.stale ? `<p class="annotation">${escapeHtml(l.stale)}</p>` : ''}<p>${escapeHtml(section.text)}</p>${references}</section>`;
    }).join('');
    const measures = table([[l.measure, d.common.district, d.common.cost, d.common.lag], ...source.revision.decisions.map(decision => {
            const m = AKIM_DATASET.measures.find(x => x.id === decision.measureId)!;
            return [`${decision.measureId}: ${d.measures[decision.measureId]}`, decision.districtId ? d.districts[decision.districtId] : d.common.city, m.cost, m.lag];
        })]);
    const summary = table([[n.result, n.value], [d.common.score, e.score ?? n.unavailable], [d.common.cost, e.cost], [d.common.remaining, e.remaining], [n.population, e.populationMean], [n.weakest, e.minimumDistrictScore], [d.common.critical, e.criticalPairs.length]]);
    const districts = table([[d.common.district, d.common.score], ...e.districts.map(x => [d.districts[x.districtId], x.score])]);
    const indicators = e.districts.map(x => `<section class="district"><h3>${escapeHtml(d.districts[x.districtId])}</h3>${table([[n.indicators, d.common.baseline, d.common.after, n.delta], ...x.indicators.map(i => [`${i.indicatorId}: ${d.indicators[i.indicatorId]}`, i.before, i.after, i.delta])])}</section>`).join('');
    let stress = '';
    if (view.stress) {
        const experiment = view.stress.experiment, assumption = experiment.assumption;
        const entries = [{ label: n.original, result: experiment.baseline }, { label: n.stressed, result: experiment.stressed }, ...(view.stress.selectedEvaluation ? [{ label: n.selected, result: view.stress.selectedEvaluation }] : [])];
        stress = `<section><h2>${escapeHtml(l.stress)}</h2>${table([[l.measure, n.costIncrease, n.extraLag], [`${assumption.measureId}: ${d.measures[assumption.measureId]}`, assumption.costIncreasePct, assumption.extraLagQuarters]])}${table([[n.comparison, d.common.score, d.common.cost, n.weakest, d.common.critical], ...entries.map(x => [x.label, x.result.score ?? n.unavailable, x.result.cost, x.result.minimumDistrictScore, x.result.criticalPairs.length])])}<p class="evidence">${escapeHtml(n.reference)}: ${escapeHtml(experiment.id)}<br>${escapeHtml(n.original)}: ${escapeHtml(experiment.sourceRevisionId)}${view.stress.selectedEvaluation ? `<br>${escapeHtml(n.selected)}: ${escapeHtml(view.stress.selectedRevisionId ?? source.revision.id)}` : ''}</p></section>`;
    }
    const provenance = [['CityBalance', `${l.version} ${brief.version}`], ['briefId', brief.id], ['briefSourceHash', brief.sourceHash], ['datasetVersion', e.datasetVersion], ['rulesVersion', e.rulesVersion], ['evaluatorVersion', e.evaluatorVersion], ['sourceHash', e.sourceHash], ...Array.from(usedSources).flatMap(id => { const record = sources.get(id)!; return [[record.label, record.revisionId], [n.reference, record.id]]; })];
    const footnote = provenance.map(([label, value]) => `<div><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`).join('');
    return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(brief.title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#152721;background:#fff;max-width:960px;margin:40px auto;padding:0 24px}h1{font-size:38px;line-height:1.15}h2{margin-top:30px;font-size:23px}h3{font-size:18px;margin-top:24px}p{white-space:pre-wrap}table{border-collapse:collapse;width:100%;font-size:13px;margin:14px 0 22px}td,th{padding:7px 9px;text-align:left;overflow-wrap:anywhere;vertical-align:top}th{background:#eef5f0}tbody tr:nth-child(even){background:#f6f8f6}.evidence,.annotation{font-size:12px;color:#486454}.annotation{margin:0}.sources{font-size:10px;line-height:1.5;color:#486454;overflow-wrap:anywhere}.sources span{font-weight:600}caption{text-align:left;font-weight:600}h1,h2,h3{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}@media print{body{margin:0;max-width:none;padding:0;font-size:10pt;line-height:1.45}h1{font-size:24pt}h2{font-size:16pt}h3{font-size:13pt}table{font-size:9pt}.district{break-inside:avoid}.sources{font-size:8pt}p{orphans:3;widows:3}}@page{size:A4;margin:17mm}</style></head><body><header><h1>${escapeHtml(brief.title)}</h1><p>${escapeHtml(l.historical)}</p>${brief.status === 'needs_review' ? `<p>${escapeHtml(l.review)}</p>` : ''}<p>${escapeHtml(d.app.modelNote)}</p></header><section><h2>${escapeHtml(n.result)}</h2>${summary}</section><section><h2>${escapeHtml(l.measure)}</h2><p class="evidence">${escapeHtml(n.numeric)}</p>${measures}</section>${sections}${stress}<section><h2>${escapeHtml(n.districts)}</h2>${districts}</section><h2>${escapeHtml(n.indicators)}</h2>${indicators}<footer><h2>${escapeHtml(l.source)}</h2><div class="sources">${footnote}</div></footer></body></html>`;
}

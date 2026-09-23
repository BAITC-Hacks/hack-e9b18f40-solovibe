"use client";

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Decision, DistrictId, Evaluation } from '../../contracts';
import { AKIM_DATASET } from '../../data/akim-v1';
import { getAttribution } from '../../attribution';
import '../../evidence.css';

const number = (v: number) => Number(v.toFixed(4)).toString();
const signed = (v: number) => `${v > 0 ? '+' : ''}${number(v)}`;

export function EvidencePanel({ evaluation, decisions, districtId }: { evaluation: Evaluation; decisions: readonly Decision[]; districtId: DistrictId }) {
  const t = useTranslations('evidence');
  const ti = useTranslations('indicators');
  const td = useTranslations('districts');
  const tm = useTranslations('measures');
  const district = evaluation.districts.find(d => d.districtId === districtId);
  const attribution = useMemo(() => evaluation.valid && evaluation.complete ? getAttribution(AKIM_DATASET, decisions, evaluation.assumptions) : null, [evaluation.valid, evaluation.complete, evaluation.assumptions, decisions]);
  if (!district) return null;
  return <div className="cb-evidence">
    <details className="cb-evidence-formula">
      <summary>{t('formula')}</summary>
      <p>{t('formulaExplanation')}</p>
      <p className="cb-equation">0.7 × {number(evaluation.populationMean)} + 0.3 × {number(evaluation.minimumDistrictScore)} − {evaluation.criticalPairs.length} = {evaluation.score === null ? t('noScore') : number(evaluation.score)}</p>
      <dl className="cb-evidence-facts"><div><dt>{t('populationTerm')}</dt><dd>{number(evaluation.components.population)}</dd></div><div><dt>{t('weakestTerm')}</dt><dd>{number(evaluation.components.weakest)}</dd></div><div><dt>{t('penaltyTerm')}</dt><dd>−{evaluation.components.penalty}</dd></div></dl>
      <p>{t('weakest')}: {evaluation.weakestDistrictIds.map(d => td(d)).join(', ')}. {t('ties')}</p>
      <p>{t('districtFormula')}</p>
      <p>{t('populationWeights')}: {evaluation.districts.map(d => `${td(d.districtId)} ${number(d.populationShare * 100)}%`).join(' · ')}</p>
    </details>
    <section aria-labelledby="indicator-evidence-title">
      <h3 id="indicator-evidence-title">{td(districtId)} · {t('indicators')}</h3>
      <p>{t('horizon')} {t('thresholdRule')}</p>
      <div className="cb-evidence-indicators">
        {district.indicators.map(indicator => {
          const source = evaluation.evidence.find(e => e.id === indicator.evidenceId);
          const inputs = source?.inputs.map(id => evaluation.evidence.find(e => e.id === id)).filter(e => !!e) ?? [];
          const status = indicator.after < 40 ? 'critical' : indicator.before < 40 ? 'crossed' : indicator.after < 42 ? 'nearThreshold' : indicator.delta === 0 ? 'unchanged' : 'changed';
          return <details key={indicator.indicatorId} id={`evidence-${districtId}-${indicator.indicatorId}`} className="cb-indicator-evidence">
            <summary><span>{ti(indicator.indicatorId)} <small>{indicator.indicatorId}</small></span><strong>{number(indicator.before)} → {number(indicator.after)}</strong><span className={`cb-evidence-status cb-evidence-${status}`}>{t(status)}</span></summary>
            <div className="cb-evidence-detail">
              <p>{t('weight')}: {number(AKIM_DATASET.weights[indicator.indicatorId] * 100)}% · {t('delta')}: {signed(indicator.delta)} {t('points')}</p>
              <ul>{inputs.map(input => <li key={input.id}>
                <span>{input.kind === 'base' ? t('sourceValue') : input.kind === 'effect' && input.measureId ? tm(input.measureId) : input.kind === 'synergy' ? `${t('synergy')} ${input.id.split(':').at(-1)}` : t('clipping')}</span>
                <strong>{input.kind === 'base' ? number(input.value) : signed(input.value)}</strong>
                {input.params && input.kind === 'effect' ? <small>{t('effectDetail', { full: Number(input.params.fullEffect), lag: Number(input.params.lag), share: Number(input.params.realizedFraction) * 100 })}</small> : null}
              </li>)}</ul>
              <p>{t('clippingRule')}</p>
              <small className="cb-evidence-source">{t('source')}: {evaluation.datasetVersion} · {indicator.evidenceId}</small>
            </div>
          </details>;
        })}
      </div>
    </section>
    <details className="cb-evidence-attribution">
      <summary>{t('attribution')}</summary>
      <p>{t('attributionExplanation')}</p>
      {attribution ? <><p>{t('reference')}: {number(attribution.baseline)} → {number(attribution.final)} · Δ {signed(attribution.final - attribution.baseline)}</p><ul>{attribution.perMeasure.map(row => <li key={row.decision.measureId}><span>{tm(row.decision.measureId)}{row.decision.districtId ? ` · ${td(row.decision.districtId)}` : ''}</span><strong>{signed(row.value)}</strong></li>)}</ul><small>{t('rounding')}</small></> : <p>{t('attributionUnavailable')}</p>}
    </details>
  </div>;
}

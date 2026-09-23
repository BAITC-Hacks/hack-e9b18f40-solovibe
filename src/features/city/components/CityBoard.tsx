"use client";
import { ArrowRight, ChevronRight, MapPin } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { Decision, DistrictId, Evaluation } from '../contracts';
import { AKIM_DATASET } from '../data/akim-v1';
import { evaluateBaseline } from '../engine';
import { CitySculpture } from '@/components/brand';
import { EvidencePanel, openIndicatorEvidence } from './evidence/EvidencePanel';
import { cn } from '@/components/ui';
const baseline = evaluateBaseline(AKIM_DATASET);
export interface CityBoardProps {
  evaluation: Evaluation;
  decisions: readonly Decision[];
  selectedDistrictId: DistrictId;
  onSelectedDistrictChange: (districtId: DistrictId) => void;
}
export function CityBoard({ evaluation, decisions, selectedDistrictId, onSelectedDistrictChange }: CityBoardProps) {
  const t = useTranslations('planOverview'), td = useTranslations('districts'), ti = useTranslations('indicators'), tm = useTranslations('measures'), te = useTranslations('evidence'), tb = useTranslations('board');
  const f = useFormatter();
  const num = (n: number) => f.number(n, { maximumFractionDigits: 1 });
  const delta = (n: number) => f.number(n, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const selected = evaluation.districts.find(d => d.districtId === selectedDistrictId);
  const weakIndicators = selected ? [...selected.indicators].sort((a, b) => a.after - b.after).slice(0, 2) : [];
  const local = decisions.filter(d => d.districtId === selectedDistrictId), city = decisions.filter(d => d.districtId === null);
  return <section className="cb-panel cb-board cb-plan-overview" aria-labelledby="city-board-title">
    <div className="cb-section-heading"><div><h2 id="city-board-title">{t('title')}</h2><p>{t('description')}</p></div><span className={cn('cb-result-kind', evaluation.valid && evaluation.complete ? 'cb-result-official' : 'cb-result-draft')}>{evaluation.valid && evaluation.complete ? tb('officialResult') : tb('draftResult')}</span></div>
    <div className="cb-city-at-a-glance">
      <div className="cb-district-ledger" role="group" aria-label={t('selectDistrict')}>
        <div className="cb-district-ledger-labels" aria-hidden="true"><span>{t('district')}</span><span>{t('score')}</span><span>{t('direct')}</span></div>
        {evaluation.districts.map(d => {
          const before = baseline.districts.find(b => b.districtId === d.districtId)!.score;
          const count = decisions.filter(item => item.districtId === d.districtId).length;
          return <button key={d.districtId} type="button" aria-pressed={d.districtId === selectedDistrictId} onClick={() => onSelectedDistrictChange(d.districtId)}>
            <span className="cb-ledger-name"><span className="cb-ledger-dot" aria-hidden="true" />{td(d.districtId)}</span>
            <span className="cb-ledger-result"><strong>{num(d.score)}</strong><small className={cn(d.score > before && 'cb-value-positive', d.score < before && 'cb-value-negative')} aria-label={`${te('delta')}: ${delta(d.score - before)}`}>{delta(d.score - before)}</small></span>
            <span className={cn('cb-ledger-allocation', count > 0 && 'cb-ledger-allocation-active')}>{count}<span className="sr-only"> {t('direct')}</span></span>
          </button>;
        })}
      </div>
      <div className="cb-overview-sculpture"><CitySculpture districtValues={evaluation.districts.map(d => d.score / 100)} selectedDistrictIndex={AKIM_DATASET.districts.findIndex(d => d.id === selectedDistrictId)} label={tb('sculptureLabel')} className="cb-overview-city-art" /><p>{t('allocationHint')}</p></div>
    </div>
    {selected ? <div className="cb-selected-district">
      <header><h3><MapPin size={17} aria-hidden="true" />{td(selectedDistrictId)}</h3><span>{t('modelPoints')}</span></header>
      <p className="cb-weak-caption">{t('needsAttention')}</p>
      <div className="cb-weak-indicators">{weakIndicators.map(indicator => <button type="button" key={indicator.indicatorId} onClick={() => openIndicatorEvidence(selectedDistrictId, indicator.indicatorId)}>
        <span>{ti(indicator.indicatorId)}<small>{indicator.after < 40 ? te('critical') : indicator.delta === 0 ? te('unchanged') : te('changed')}</small></span><span className="cb-weak-values"><span>{num(indicator.before)}</span><ArrowRight size={14} aria-hidden="true" /><strong>{num(indicator.after)}</strong><ChevronRight size={16} aria-hidden="true" /></span>
      </button>)}</div>
      <details className="cb-district-actions"><summary>{t('measuresHere', { direct: local.length, city: city.length })}</summary>{local.length ? <p><strong>{t('directMeasures')}</strong> {local.map(d => tm(d.measureId)).join(' · ')}</p> : <p>{t('noDirect')}</p>}{city.length ? <p><strong>{t('cityMeasures')}</strong> {city.map(d => tm(d.measureId)).join(' · ')}</p> : null}</details>
    </div> : null}
    <EvidencePanel evaluation={evaluation} decisions={decisions} districtId={selectedDistrictId} />
  </section>;
}

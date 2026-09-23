"use client";
import { Building2, LockKeyhole, MapPin, Plus, Replace, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Constraints, Decision } from '../contracts';
import { AKIM_DATASET } from '../data/akim-v1';
import { cn } from '@/components/ui';
import '../evidence.css';
export interface DecisionTrayProps {
  decisions: readonly Decision[];
  constraints?: Constraints;
  replacementSlot: number | null;
  onReplacementSlotChange: (slot: number | null) => void;
  onBrowseCatalogue: () => void;
  onRemove: (slot: number) => void;
  onToggleLock?: (decision:Decision)=>void;
}
export function DecisionTray({ decisions, constraints, replacementSlot, onReplacementSlotChange, onBrowseCatalogue, onRemove,onToggleLock }: DecisionTrayProps) {
  const t = useTranslations('planOverview'), te = useTranslations('evidence'), tm = useTranslations('measures'), td = useTranslations('districts'), tc = useTranslations('common'), tb = useTranslations('board');
  return <section className="cb-panel cb-plan-choices" aria-labelledby="decision-tray-title">
    <div className="cb-section-heading"><div><h2 id="decision-tray-title" tabIndex={-1}>{t('choices')}</h2><p>{t('choicesHint')}</p></div><span className="cb-count">{decisions.length} / 5</span></div>
    <ol className="cb-choices-list">{Array.from({ length: 5 }, (_, slot) => {
      const decision = decisions[slot], measure = decision ? AKIM_DATASET.measures.find(m => m.id === decision.measureId) : null;
      const locked = !!decision && !!constraints?.locked.some(d => d.measureId === decision.measureId && d.districtId === decision.districtId);
      return <li key={slot} className={cn('cb-choice-row', replacementSlot === slot && 'cb-choice-row-selected', !decision && 'cb-choice-row-empty')}>
        <span className="cb-choice-number" aria-hidden="true">{slot + 1}</span>
        {decision && measure ? <><div className="cb-choice-copy"><strong>{tm(decision.measureId)}</strong><span>{decision.districtId ? <MapPin size={13} aria-hidden="true" /> : <Building2 size={13} aria-hidden="true" />}{decision.districtId ? td(decision.districtId) : tc('city')}<span aria-hidden="true">·</span>{measure.cost} {tc('units')}</span>{onToggleLock?<button type="button" className="cb-choice-pin" aria-pressed={locked} onClick={()=>onToggleLock(decision)}><LockKeyhole size={13} aria-hidden="true"/>{t(locked?'choiceKept':'keepChoice')}</button>:locked?<small className="cb-choice-lock">{te('locked')}</small>:null}</div>
          <div className="cb-choice-controls"><button type="button" disabled={locked} className="cb-choice-replace" aria-label={`${tb('replace')}: ${tm(decision.measureId)}`} title={locked ? te('unlockFirst') : undefined} onClick={() => { onReplacementSlotChange(slot); }}><Replace size={15} aria-hidden="true" /><span>{tb('replace')}</span></button><button type="button" disabled={locked} className="cb-choice-remove" aria-label={`${tb('removeMeasure')}: ${tm(decision.measureId)}`} title={locked ? te('unlockFirst') : undefined} onClick={() => onRemove(slot)}><Trash2 size={16} aria-hidden="true" /></button></div>
        </> : <button className="cb-choice-add" type="button" onClick={onBrowseCatalogue}><Plus size={18} aria-hidden="true" />{tb('emptySlotAction')}</button>}
      </li>;
    })}</ol>
    {constraints?.locked.length ? <p className="cb-choice-lock-hint">{te('unlockFirst')}</p> : null}
  </section>;
}

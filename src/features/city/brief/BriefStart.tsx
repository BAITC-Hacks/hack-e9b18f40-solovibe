'use client';
import {useRef,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {Button,Alert} from '@/components/ui';
import {cityApi,errorCode} from '@/lib/city-api';
import {useRouter} from '@/i18n/navigation';
import type {BriefView} from './contracts';
export function BriefStart({scenarioId,sourceRevisionId,experiments=[]}:{scenarioId:string;sourceRevisionId:string;experiments?:import('../workshop-contracts').StressRecord[]}){
 const t=useTranslations('workflow'),te=useTranslations('errors'),locale=useLocale(),router=useRouter(),id=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState<string|null>(null);
 const [stressId,setStressId]=useState('');const ts=useTranslations('stress'),tm=useTranslations('measures');
 async function create(){setBusy(true);setProblem(null);id.current??=crypto.randomUUID();try{const view=await cityApi<BriefView>('/briefs',{method:'POST',body:{sourceRevisionId,locale,...(stressId?{stressId}:{}),clientMutationId:id.current}});router.replace(`/city/${scenarioId}/brief?briefId=${view.brief.id}`);}catch(e){setProblem(te.has(errorCode(e))?te(errorCode(e)):te('NETWORK'));}finally{setBusy(false);}}
 return <section className="surface p-6"><p>{t('briefIntro')}</p>{experiments.length>0&&<label className="mb-5 block">{ts('history')}<select className="ml-3 rounded-xl border p-3" value={stressId} disabled={busy} onChange={e=>{setStressId(e.target.value);id.current=null;}}><option value="">{t('withoutStress')}</option>{experiments.map(s=><option value={s.id} key={s.id}>{tm(s.assumption.measureId)}: +{s.assumption.costIncreasePct}%, +{s.assumption.extraLagQuarters} {ts('quarters')}</option>)}</select></label>}<Button loading={busy} onClick={()=>void create()}>{t('createBrief')}</Button>{problem&&<Alert tone="danger">{problem}</Alert>}</section>;
}

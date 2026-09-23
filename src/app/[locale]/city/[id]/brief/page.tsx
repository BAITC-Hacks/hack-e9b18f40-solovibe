import {getTranslations} from 'next-intl/server';
import {AppHeader} from '@/components/app/AppHeader';
import {Link} from '@/i18n/navigation';
import {resolvePrincipal} from '@/server/city/owners';
import {getScenario} from '@/server/city/scenarios';
import {getBrief,listBriefs} from '@/server/city/briefs';
import {BriefEditor} from '@/features/city/brief/components/BriefEditor';
import {BriefStart} from '@/features/city/brief/BriefStart';
import {CityError} from '@/server/city/errors';
import {Alert} from '@/components/ui';
import {listStress} from '@/server/city/stress';
import type {BriefView} from '@/features/city/brief/contracts';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{briefId?:string;version?:string}>}){
 const {id}=await params,q=await searchParams,t=await getTranslations();
 let view:BriefView|null=null,scenario,experiments;
 try {
  const p=await resolvePrincipal();scenario=await getScenario(p,id);
  const list=await listBriefs(p,id),selected=q.briefId??list.items[0]?.id;
  if(selected){view=await getBrief(p,selected,q.version?Number(q.version):undefined);if(view.brief.scenarioId!==id)throw new CityError('NOT_FOUND',404);}
  else experiments=(await listStress(p,id)).items;
 }catch(e){const code=e instanceof CityError?e.code:'STORAGE_UNAVAILABLE';return <main className="page-shell"><AppHeader/><Alert tone="danger">{t(`errors.${code}`)}</Alert><Link href="/scenarios">{t('app.goLibrary')}</Link></main>;}
 if(view)return <main className="page-shell"><AppHeader/><nav className="my-5 flex flex-wrap gap-5"><Link href={`/city/${id}`}>{t('workflow.backToPlan')}</Link><Link href={`/city/${id}/present?briefId=${view.brief.id}&version=${view.brief.version}`}>{t('workflow.present')}</Link></nav><BriefEditor initial={view}/></main>;
 return <main className="page-shell"><AppHeader/><Link href={`/city/${id}`} className="my-5 block">{t('workflow.backToPlan')}</Link><h1>{t('workflow.brief')}</h1>{scenario.evaluation.result.complete?<BriefStart scenarioId={id} sourceRevisionId={scenario.revision.id} experiments={experiments}/>:<Alert>{t('workflow.completeFirst')}</Alert>}</main>;
}

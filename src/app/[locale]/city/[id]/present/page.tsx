import {getTranslations} from 'next-intl/server';
import {AppHeader} from '@/components/app/AppHeader';
import {Link} from '@/i18n/navigation';
import {resolvePrincipal} from '@/server/city/owners';
import {getBrief,listBriefs} from '@/server/city/briefs';
import {BriefPresentation} from '@/features/city/brief/components/BriefPresentation';
import {CityError} from '@/server/city/errors';
import {Alert} from '@/components/ui';
export const dynamic='force-dynamic';export const metadata={robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{briefId?:string;version?:string}>}){
 const {id}=await params,q=await searchParams,t=await getTranslations();let view;
 try{const p=await resolvePrincipal(),selected=q.briefId??(await listBriefs(p,id)).items[0]?.id;if(!selected)throw new CityError('NOT_FOUND',404);view=await getBrief(p,selected,q.version?Number(q.version):undefined);if(view.brief.scenarioId!==id)throw new CityError('NOT_FOUND',404);}
 catch(e){return <main className="page-shell"><AppHeader/><Alert tone="danger">{t(`errors.${e instanceof CityError?e.code:'STORAGE_UNAVAILABLE'}`)}</Alert><Link href={`/city/${id}/brief`}>{t('workflow.brief')}</Link></main>;}
 return <main className="page-shell"><div className="print:hidden"><AppHeader/><Link className="my-5 block" href={`/city/${id}/brief?briefId=${view.brief.id}`}>{t('workflow.brief')}</Link></div><BriefPresentation initial={view}/></main>;
}

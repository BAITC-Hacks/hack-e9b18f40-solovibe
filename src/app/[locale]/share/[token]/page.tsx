import {getTranslations} from 'next-intl/server';
import {AppHeader} from '@/components/app/AppHeader';
import {getPublicSnapshot} from '@/server/city/shares';
import {SharedSnapshot} from '@/features/city/components/sharing/SharedSnapshot';
import {Alert} from '@/components/ui';
import {Link} from '@/i18n/navigation';
export const dynamic='force-dynamic';export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params,t=await getTranslations();let snapshot;
 try{snapshot=await getPublicSnapshot(token);}catch{return <main className="page-shell"><AppHeader/><Alert tone="warning">{t('workflow.shareUnavailable')}</Alert><Link href="/">{t('board.home')}</Link></main>;}
 return <main className="page-shell"><AppHeader/><SharedSnapshot initial={snapshot} token={token}/></main>;
}

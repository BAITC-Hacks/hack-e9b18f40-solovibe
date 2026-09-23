import {setRequestLocale} from 'next-intl/server';
import {Landing} from '@/components/landing';
import {publicProof} from '@/server/city/public-proof';
export default async function Page({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;setRequestLocale(locale);
  return <Landing {...publicProof()} />;
}

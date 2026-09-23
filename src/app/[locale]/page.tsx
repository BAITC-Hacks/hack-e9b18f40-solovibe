import {setRequestLocale} from 'next-intl/server';
import {Landing} from '@/components/landing';
import {publicProof} from '@/server/city/public-proof';
import {DeliveryProof} from '@/components/landing/DeliveryProof';
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>,searchParams:Promise<{variant?:string}>}) {
  const {locale}=await params;setRequestLocale(locale);
  const query=await searchParams,variant=query.variant==='best'?'best':'two-districts';
  return <Landing key={variant} {...publicProof()} initialVariant={variant} deliveryProof={<DeliveryProof/>} />;
}

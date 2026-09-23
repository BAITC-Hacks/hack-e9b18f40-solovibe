import {getLocale,getTranslations} from 'next-intl/server';
import proof from '@/features/city/data/proof-delivery.json';
export async function DeliveryProof(){
 const locale=await getLocale(),t=await getTranslations('landing');
 return <article className="landing-delivery-proof"><h3>{t('savedExample')}</h3><p className="landing-delivery-language">{t('savedLanguage')}</p><p lang="ru">{proof.benefit}</p><div className="landing-delivery-risk"><strong>{t('testedChange')}</strong><p>{t('testedResult',{before:proof.cost,after:proof.stressCost,repair:proof.repairCost})}</p></div><p>{t('useDocument')}</p><a className="landing-delivery-primary" href={`/examples/citybalance-two-districts-${locale}.html`} download>{t('downloadHtml')}</a><details className="landing-delivery-data"><summary>{t('dataFiles')}</summary><p>{t('dataFilesHint')}</p><div className="landing-delivery-files"><a href="/examples/citybalance-two-districts.json" download>JSON</a><a href={`/examples/citybalance-two-districts-${locale}.csv`} download>CSV</a></div></details></article>;
}

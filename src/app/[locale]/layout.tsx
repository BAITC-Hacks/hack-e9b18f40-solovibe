
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SessionBoundary } from "@/components/app/SessionBoundary";
import "../globals.css";

export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;
  const t=await getTranslations({locale,namespace:"app"});
  return { title: "CityBalance", description: t("intro") };
}

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <html lang={locale}><body><NextIntlClientProvider><SessionBoundary />{children}</NextIntlClientProvider></body></html>;
}

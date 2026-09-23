import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { redirect } from "@/i18n/navigation";
import { AccountProfile } from "@/components/app/AccountProfile";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{next?:string}>}) {
  const {locale}=await params; const {next}=await searchParams;
  const session=await getAuth().api.getSession({headers:await headers()});
  if(!session)return redirect({href:"/sign-in?next=/account",locale});
  return <AccountProfile user={{name:session.user.name,email:session.user.email}} returnTo={next&&/^\/(city\/[a-f0-9-]+|scenarios)$/.test(next)?next:"/scenarios"}/>;
}

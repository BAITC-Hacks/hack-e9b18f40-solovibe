import { AuthForm } from "@/components/app/AuthForm";
export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const {next}=await searchParams;
  return <AuthForm mode="sign-up" next={next && /^\/(city\/[a-f0-9-]+|scenarios)$/.test(next)?next:"/scenarios"}/>;
}

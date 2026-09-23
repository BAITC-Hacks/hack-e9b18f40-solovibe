import { headers } from "next/headers";
import { cityRoute, parseBody } from "@/server/city/http";
import { problemResponse } from "@/server/city/errors";
import { resolvePrincipal } from "@/server/city/owners";
import { createRunSchema } from "@/features/city/ai-contracts";
import { createRun, listRuns } from "@/server/city/runs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(r:Request) { return cityRoute(async()=>{const url=new URL(r.url);return listRuns(await resolvePrincipal(),url.searchParams.get("scenarioId")??"",url.searchParams.get("before")??undefined);}); }
export async function POST(r:Request) {
  try {
    const body=await parseBody(r,createRunSchema);
    const h=await headers();
    const network=h.get("x-real-ip")??h.get("x-forwarded-for")?.split(",").at(-1)?.trim()??"local";
    const result=await createRun(await resolvePrincipal({refresh:true}),body,network);
    if(result.run.status==="failed"&&result.run.errorCode==="AI_UNAVAILABLE") return Response.json({code:"AI_UNAVAILABLE",messageKey:"errors.AI_UNAVAILABLE",requestId:crypto.randomUUID(),run:result},{status:503,headers:{"Cache-Control":"private, no-store"}});
    return Response.json(result,{status:202,headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return problemResponse(error); }
}

import {z} from "zod";
import {cityRoute,parseBody} from "@/server/city/http";
import {claimGuest} from "@/server/city/owners";
export const runtime="nodejs";
export function POST(r:Request) {return cityRoute(async()=>{await parseBody(r,z.object({}).strict());return claimGuest();});}

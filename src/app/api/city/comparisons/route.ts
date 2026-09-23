import { cityRoute,parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { comparePlans,comparisonSchema } from '@/server/city/comparisons';
export function POST(r:Request) { return cityRoute(async()=>{const body=await parseBody(r,comparisonSchema);return comparePlans(await resolvePrincipal({refresh:true}),body.revisionIds);}); }

import { refreshBriefSchema } from '@/features/city/brief/contracts';
import { refreshBrief } from '@/server/city/briefs';
import { cityRoute, parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
export function POST(request: Request, context: { params: Promise<{ id: string }> }) { return cityRoute(async () => { const input = await parseBody(request, refreshBriefSchema); return refreshBrief(await resolvePrincipal({ refresh: true }), (await context.params).id, input); }); }

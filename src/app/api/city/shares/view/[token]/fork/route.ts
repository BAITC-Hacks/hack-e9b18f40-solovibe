import { forkShareSchema, forkSharedScenario, publicShareRoute } from '@/server/city/shares';
import { parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
export function POST(request: Request, context: { params: Promise<{ token: string }> }) { return publicShareRoute(async () => { const input = await parseBody(request, forkShareSchema); return forkSharedScenario(await resolvePrincipal({ create: true, refresh: true }), (await context.params).token, input); }, 201); }

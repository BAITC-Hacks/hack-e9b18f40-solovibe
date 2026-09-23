import { cityRoute, assertSameOrigin } from '@/server/city/http';
import { revokeShare } from '@/server/city/shares';
import { resolvePrincipal } from '@/server/city/owners';
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return cityRoute(async () => { assertSameOrigin(request); return revokeShare(await resolvePrincipal({ refresh: true }), (await context.params).id); }); }

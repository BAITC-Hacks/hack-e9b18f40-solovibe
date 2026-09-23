import { cityRoute, assertSameOrigin } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { getArtifact } from '@/server/city/artifact-access';
import { deleteArtifact } from '@/server/city/cleanup';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = {
    params: Promise<{
        id: string;
    }>;
};
export function GET(_request: Request, context: Context) { return cityRoute(async () => getArtifact(await resolvePrincipal({ refresh: true }), (await context.params).id)); }
export function DELETE(request: Request, context: Context) { return cityRoute(async () => { assertSameOrigin(request); return deleteArtifact(await resolvePrincipal({ refresh: true }), (await context.params).id); }); }

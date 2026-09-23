import { createArtifactSchema } from '@/features/city/artifact-contracts';
import { cityRoute, parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { createArtifact } from '@/server/city/exports';
import { listArtifacts } from '@/server/city/artifact-access';
import { CityError } from '@/server/city/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return cityRoute(async () => { const input = await parseBody(request, createArtifactSchema); return createArtifact(await resolvePrincipal({ refresh: true }), input); }); }
export function GET(request: Request) { return cityRoute(async () => { const id = new URL(request.url).searchParams.get('scenarioId'); if (!id)
    throw new CityError('INVALID_REQUEST'); return listArtifacts(await resolvePrincipal({ refresh: true }), id); }); }

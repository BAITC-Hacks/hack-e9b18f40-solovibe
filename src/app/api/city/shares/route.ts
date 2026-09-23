import { z } from 'zod';
import { createShareSchema } from '@/features/city/sharing-contracts';
import { createShare, listShares } from '@/server/city/shares';
import { cityRoute, parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
import { CityError } from '@/server/city/errors';
export function GET(request: Request) { return cityRoute(async () => { const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('scenarioId')); if (!id.success) throw new CityError('INVALID_REQUEST'); return listShares(await resolvePrincipal({ refresh: true }), id.data); }); }
export function POST(request: Request) { return cityRoute(async () => { const body = await parseBody(request, createShareSchema); return createShare(await resolvePrincipal({ refresh: true }), body); }, 201); }

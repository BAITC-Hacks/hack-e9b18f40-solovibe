import { z } from 'zod';
import { createBriefSchema } from '@/features/city/brief/contracts';
import { createBrief, listBriefs } from '@/server/city/briefs';
import { CityError } from '@/server/city/errors';
import { cityRoute, parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
export function GET(request: Request) { return cityRoute(async () => { const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get('scenarioId')); if (!parsed.success) throw new CityError('INVALID_REQUEST'); return listBriefs(await resolvePrincipal({ refresh: true }), parsed.data); }); }
export function POST(request: Request) { return cityRoute(async () => { const input = await parseBody(request, createBriefSchema); return createBrief(await resolvePrincipal({ refresh: true }), input); }, 201); }

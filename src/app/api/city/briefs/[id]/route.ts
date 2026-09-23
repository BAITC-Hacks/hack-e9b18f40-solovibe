import { z } from 'zod';
import { editBriefSchema } from '@/features/city/brief/contracts';
import { editBrief, getBrief } from '@/server/city/briefs';
import { CityError } from '@/server/city/errors';
import { cityRoute, parseBody } from '@/server/city/http';
import { resolvePrincipal } from '@/server/city/owners';
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) { return cityRoute(async () => { const raw = new URL(request.url).searchParams.get('version'); const version = raw === null ? undefined : z.coerce.number().int().positive().safeParse(raw); if (version && !version.success) throw new CityError('INVALID_REQUEST'); return getBrief(await resolvePrincipal({ refresh: true }), (await context.params).id, version?.data); }); }
export function PATCH(request: Request, context: Context) { return cityRoute(async () => { const input = await parseBody(request, editBriefSchema); return editBrief(await resolvePrincipal({ refresh: true }), (await context.params).id, input); }); }

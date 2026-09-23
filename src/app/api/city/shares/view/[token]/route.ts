import { getPublicSnapshot, publicShareRoute } from '@/server/city/shares';
export function GET(_request: Request, context: { params: Promise<{ token: string }> }) { return publicShareRoute(async () => getPublicSnapshot((await context.params).token)); }

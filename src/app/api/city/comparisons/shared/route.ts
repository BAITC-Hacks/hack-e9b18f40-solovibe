import { compareSharedPlans, publicShareRoute, sharedComparisonSchema } from '@/server/city/shares';
import { parseBody } from '@/server/city/http';
export function POST(request: Request) { return publicShareRoute(async () => compareSharedPlans((await parseBody(request, sharedComparisonSchema)).shareTokens)); }

import { publicShareRoute, sharedArtifactResponse } from '@/server/city/shares';
export function GET(_request: Request, context: { params: Promise<{ token: string; artifactId: string }> }) { return publicShareRoute(async () => { const { token, artifactId } = await context.params; return sharedArtifactResponse(token, artifactId); }); }

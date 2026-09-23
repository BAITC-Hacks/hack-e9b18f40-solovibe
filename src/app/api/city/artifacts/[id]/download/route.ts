import { resolvePrincipal } from '@/server/city/owners';
import { readArtifact, artifactDownloadResponse } from '@/server/city/artifact-access';
import { problemResponse } from '@/server/city/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    return artifactDownloadResponse(await readArtifact(await resolvePrincipal({ refresh: true }), (await context.params).id));
}
catch (error) {
    return problemResponse(error);
} }

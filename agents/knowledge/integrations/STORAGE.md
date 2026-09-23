# Private Cloudflare R2

Use the configured private bucket with public access disabled. R2 stores files; PostgreSQL stores metadata/relations. One bucket supports slash-separated prefixes without physical folders.

`@/server/storage`: putStoredObject(key, bytes, contentType), readStoredObject(key), headStoredObject(key), deleteStoredObject(key), getStorageBackend(). Both backends return the same key/contentType/size metadata; reads include Uint8Array bytes and missing reads/heads return null. Deletion is idempotent. R2 operations have a 60-second deadline including download body consumption and at most two SDK attempts. Operations buffer complete objects, so enforce upload limits at the request boundary. Env for R2: R2_ACCOUNT_ID or R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Region auto. Use bucket-scoped Object Read & Write credentials.

STORAGE_BACKEND accepts local or r2. When unset, completely absent R2 settings select local; complete settings select R2 and partial settings fail clearly. Local files use STORAGE_LOCAL_DIR (default storage), mounted at /app/storage in Compose. Private atomic object files preserve bytes and content type together. Keep the volume writable only by the application. An R2 outage never silently switches to local. Product routes must authenticate and check ownership for both backends; storage keys alone grant no user authorization. Use the common operations behind authorized application upload/download routes so installations without R2 retain file features.

Optional direct-to-R2 upload flow (signUpload/signDownload default to 300 seconds and require R2; getStorage exposes its S3 client):
1. Authenticate; validate purpose/type/declared size; generate `users/{session.user.id}/{feature}/{uuid}` on the server.
2. Insert pending metadata: id, ownerId, key, originalName, contentType, expectedSize, status, timestamps. Return fileId and signed PUT URL.
3. Browser PUTs raw File/Blob with the exact signed Content-Type. No multipart encoding or app cookies to R2.
4. Upload into a pending key. A signed PUT remains reusable until expiry, so HEAD followed by marking that same key ready is insufficient: the bytes can change after validation. Finalize into a new server-only final key by reading and validating the exact bytes that are saved. Check actual size and feature-specific content, delete rejected objects, and mark ready only after verification. Prefer the common server upload route when direct transfer adds no material benefit.
5. Download checks ownership/ready state and signs a short-lived GET. Persist keys/IDs, not expiring URLs. Coordinate object deletion and metadata state with recoverable retries.

Server output: `putStoredObject(key, bytes, contentType)`, then save relational metadata. No large base64 blobs in database rows. Prefixes are conventions, not access control.

Configure CORS for the exact localhost/127.0.0.1:3000 and deployed HTTPS origins: GET/HEAD/PUT, content-type and AWS checksum headers, exposed ETag. Update exact origins when deployment changes. Signed URLs grant access until expiry. User file lists come from authorized metadata queries, not listing the entire bucket. Multipart is optional for genuinely large files and needs abandoned-upload cleanup.

References: [signed URLs/CORS](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [S3 setup](https://developers.cloudflare.com/r2/get-started/s3/), [keys](https://developers.cloudflare.com/r2/api/tokens/).

# Email/password authentication

Reuse getAuth() from `@/server/auth` and src/lib/auth-client.ts. Better Auth owns email/password sessions (minimum password length 10), Drizzle storage, nextCookies and `/api/auth` routes.

Server: `await getAuth().api.getSession({headers: await headers()})` using next/headers. Reject missing sessions for every protected operation. Fetch entities using both their ID and session.user.id. Layout redirects and hidden controls do not authorize mutations. Keep Better Auth cookies; do not copy tokens into localStorage.

Client: authClient.signUp.email({name,email,password}), signIn.email({email,password}), signOut(), useSession(). Handle returned error/data and localized pending/failure states. Rename preparation appName SoloVibe to the approved product during implementation.

APP_URL is the current environment origin and BETTER_AUTH_SECRET is server-only. Local development and hosted runtime have separate configuration. Email verification/password recovery need an actual mail delivery setup if selected later; do not show a successful sent-email message without it.

Better Auth's protections cover its own endpoints. Custom cookie-authenticated mutations also need same-origin/CSRF protection; never mutate through GET or assume CORS authenticates a request. On logout or account/workspace change, cancel in-flight private requests, clear account-scoped client caches and prevent late responses from repopulating the previous account's data. Verify ownership with two different users, including downloads, exports and AI tools, not just the main detail page.

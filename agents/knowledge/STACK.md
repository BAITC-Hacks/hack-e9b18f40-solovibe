# Prepared application

The root repository already contains the technical foundation. Reuse it; choose product-specific modules after concept approval. package.json and pnpm-lock.yaml are authoritative for versions.

Use Node >=22.22.3 and pnpm 10.32.1. Verify the active runtime with `node --version` before running pnpm; use a compatible installed runtime. Docker uses the current Node 22 release.

## Structure and defaults
One TypeScript application, Next.js App Router with Node server runtime, React and PostgreSQL 17. Drizzle owns schema and migrations; Better Auth owns email/password accounts/sessions.
AI SDK plus @ai-sdk/openai use OpenAI Responses. The server adapter is src/server/ai.ts. API credentials are runtime environment values, not browser variables. No application AI workflow has been invented before the case.
Tailwind CSS, Motion, Radix primitives, next-intl and Onest are available. Use existing dependencies instead of adding competing frameworks. The visual principles live in agents/knowledge/design/SYSTEM.md and DIRECTION.md. The application starts with blank localized product routes and technical infrastructure. Build original product components and compositions from the text specifications.

| Area | Path |
| --- | --- |
| Localized routes | src/app/[locale]/ |
| API/auth/health | src/app/api/ |
| Shared UI | src/components/; create product primitives in src/components/ui/ |
| Database schema/client | src/server/db/schema.ts, src/server/db/index.ts |
| Auth provider | src/server/auth.ts, src/lib/auth-client.ts |
| AI provider | src/server/ai.ts |
| Localization | src/i18n/, src/proxy.ts, messages/{ru,kk,en}.json |
| SQL migrations | drizzle/ |
| Container and local/server services | Dockerfile, compose.yaml, compose.production.yaml |
| Manual SSH delivery after every push | agents/scripts/manual-deploy.mjs, agents/scripts/deploy-ssh.sh, agents/ops/SETUP.md (workspace-relative) |
| Files | src/server/storage.ts; knowledge/integrations/STORAGE.md |

Create feature modules around the approved domain. Server components may read services/database directly; avoid HTTP requests to the same application. Use client components for interaction, not the whole tree. Await Next request APIs/route params. Authorize every server operation and validate its inputs, even when called from a protected screen.
Keep private/request-specific data out of shared caches. Revalidate deliberately after mutations. Add indexes/pagination for actual access patterns and parallelize independent I/O. Lazy-load heavy editors/previews rather than adding their cost to every screen.

## Commands from the workspace root
For a finished implementation block, use `node agents/scripts/checkpoint.mjs "Concrete message" -- ready/path another/path`: it verifies, commits, pushes and deploys. Do not repeat checks or deployment after its successful completion. Before invoking it, finish all active writers and include every intended change so the commit leaves a clean tree; deployment rejects uncommitted changes. If a push already succeeded but deployment failed, retry only `node agents/scripts/manual-deploy.mjs`.

`context.mjs` and `quiet.mjs` are shared internals; `deploy-ssh.sh` is invoked by manual-deploy. The implementation MAIN normally uses only the checkpoint command.

- First dependency setup: pnpm install --frozen-lockfile
- Create local .env only if absent: pnpm env:init
- Local Postgres: pnpm infra:up
- Apply migrations: pnpm db:migrate
- Interactive development: pnpm dev
- Whole local Docker app and database: pnpm local:up
- Stop local containers without deleting data: pnpm local:stop
- Focused static checks: pnpm check
- Domain/state/queue checks: pnpm test:domain, pnpm test:state, pnpm test:worker
- Actual HTTP persistence/rights checks: pnpm test:integration against a running local app
- Bounded configured-provider acceptance: pnpm verify:ai (CITY_TEST_URL, optional CITY_VERIFY_CASE=V3 or V4)
- Development worker: pnpm worker; pnpm worker:build creates the Node bundle used by the image
- Integrated Git milestone: node agents/scripts/checkpoint.mjs "Concrete message" -- ready/path another/path
Use either the native dev app or container app on port 3000 at a time. Local Postgres binds only to 127.0.0.1:15432. Volumes preserve data.

checkpoint is MAIN-only. It runs typecheck, lint and build, then commits/pushes exactly the named package. "." means the entire completed tree and requires all writers to have handed over. CHECKPOINT_NO_PUSH=1 allows a deliberately local checkpoint. No force push or automatic cleanup of unrelated changes. The checkpoint performs deployment itself; do not deploy a second time after it succeeds. If a helper breaks, repair the specific fault and retry only the failed operation, preserving any successful commit/push.
Implementation MAIN starts and finishes with a clean code tree; never discard unrelated changes to achieve this.

## Credentials and deployment
.env.example lists variables; .env stays ignored. Local database/password and auth secret are generated by setup. Keep provider keys in runtime environment variables. Changing APP_URL requires a server restart and updating configured external callback URLs when applicable.
R2 configuration uses a private bucket and scoped credentials. Store file metadata/ownership in PostgreSQL and use authorized expiring URLs; read integrations/STORAGE.md for the actual upload/finalize contract. OpenAI uses the configured model; the adapter default is gpt-6-luna. Relevant API notes live in integrations/.
The Docker image contains the standalone app, migration runner and CityBalance worker. Delivery is local verification → commit/push → manual SSH deployment of that exact revision → server build → migrate → replace app and worker → verify matching revisions. The checkpoint command runs manual deployment after its push; after a standalone push, run node agents/scripts/manual-deploy.mjs. This command updates local Docker and the SSH server concurrently and waits for app/worker health. Production Compose keeps persistent PostgreSQL and a loopback app port. The public Brev Secure Link terminates HTTPS; Nginx passes streaming responses without buffering. Read agents/ops/SETUP.md for the provisioning and release procedure.

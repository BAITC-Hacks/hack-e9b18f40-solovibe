# Manual SSH delivery

Run the checkpoint from the workspace root for a completed block. It checks, commits, pushes and deploys locally and remotely. After a standalone successful push, or to retry a failed deployment, run `node agents/scripts/manual-deploy.mjs`.

## Configured target

Public origin: https://solovibe-5k5wvv7zo.gobrev.dev. The Brev Secure Link accepts public traffic without NVIDIA sign-in and terminates TLS. Nginx listens on port 80 and proxies to the application on 127.0.0.1:3000. PostgreSQL has no public port. Keep proxy buffering/cache disabled and preserve the HTTPS public origin for cookies and callbacks. The certificate is managed by the Secure Link.

SSH uses the Brev configuration in WSL Ubuntu. `brev refresh` updates the SSH alias if the instance endpoint changes. The deployment command uses that alias noninteractively with strict host-key verification; do not disable host verification to work around a connection error.

The ignored `.private/deploy.json` holds:

```json
{
  "host": "conservation-pink-squirrel",
  "user": "ubuntu",
  "port": 49778,
  "root": "/opt/solovibe",
  "origin": "https://solovibe-5k5wvv7zo.gobrev.dev",
  "wslDistribution": "Ubuntu"
}
```

For ordinary SSH, omit wslDistribution and supply key and knownHosts paths. The machine needs Docker Compose, Bash, tar and flock. Runtime settings are stored in `/opt/solovibe/runtime.env` with mode 600, outside release directories. Preserve database/session secrets and persistent volumes across releases. Local env edits do not automatically change the server env. APP_URL must equal the public HTTPS origin; configure storage CORS for that exact origin.

## Release and recovery

The helper requires a clean working tree and HEAD equal to pushed origin/main. It archives that exact commit locally and streams the archive over SSH, without a server GitHub credential or local archive file. The server unpacks into a new release directory, deletes the uploaded archive, builds the shared image, starts PostgreSQL, runs migrations, replaces app and worker, and checks both revisions. Local Docker deployment runs concurrently with APP_REVISION set to the same Git SHA. The current symlink moves only after server success.

Build or migration failure leaves the previous app and worker running. Rollback is attempted only when runtime.env explicitly has APP_ROLLBACK_COMPATIBLE=1 and a previous release exists; migrations are not reversed. It restores app and worker from the same previous image and checks the worker heartbeat. A pre-worker release stops the new worker before restoring its app. Keep migrations backward-compatible where required and preserve backups. Never delete volumes or migration history to force a release.

CityBalance uses a separate worker service from the same image: node city-worker.cjs, health node worker-health.cjs, shared DB and persistent file volume. pnpm build bundles both helpers; pnpm local:up starts them together with the app. Native pnpm start starts app and worker together; pnpm worker is the separate development command. city_jobs leases last30s, renew every10s, use fencing tokens and at most2 attempts within120s. Two global slots and one account/guest quota key apply across worker processes. AI tools execute domain search directly inside their existing job; the public search endpoint uses the same queue independently. Hourly queued retention removes expired guest owners.

Compose sets CITY_REQUIRE_WORKER=1. /api/health requires a heartbeat no older than35s with the app's exact APP_REVISION, and returns both app/worker revision. Missing OPENAI_API_KEY is reported as aiConfigured:false while manual use and the worker remain healthy. A dead/mismatched worker fails readiness. Both manual deployment scripts verify worker health and public matching revisions. Keep Nginx streaming buffering disabled; /api/city/runs/:id/events supports durable replay with Last-Event-ID or after.

Full diagnostic logs are in `.checks/logs`; normal output is concise. Retry the failed step without repeating a successful commit. Keep secrets out of Git and build arguments; inspect Compose with `config --quiet`. README must also document standalone deployment from repository files, independently of this private connection configuration.

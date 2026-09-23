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

The helper requires a clean working tree and HEAD equal to pushed origin/main. It archives that exact commit locally and streams the archive over SSH, without a server GitHub credential or local archive file. The server unpacks into a new release directory, deletes the uploaded archive, builds the image, starts PostgreSQL, runs migrations, replaces the app and checks health/revision. Local Docker deployment runs concurrently. The current symlink moves only after server success.

Build or migration failure leaves the previous app running. Application rollback is attempted only when runtime.env explicitly has APP_ROLLBACK_COMPATIBLE=1 and a previous release exists; migrations are not reversed. Keep migrations backward-compatible where required and preserve backups. Never delete volumes or migration history to force a release.

Full diagnostic logs are in `.checks/logs`; normal output is concise. Retry the failed step without repeating a successful commit. Keep secrets out of Git and build arguments; inspect Compose with `config --quiet`. README must also document standalone deployment from repository files, independently of this private connection configuration.

# Integration quick references

Read only the provider needed by the active feature. These are prepared contracts, not product scope. Installed types/lockfile are authoritative; consult linked official docs for options absent here or changed later. Do not load all API documentation at startup.

| Need | Read | Existing entry |
| --- | --- | --- |
| Model, streaming, tools, artifacts | AI.md | src/server/ai.ts |
| Uploads and generated files | STORAGE.md | src/server/storage.ts |
| Email/password sessions | AUTH.md | src/server/auth.ts |
| Data and migrations | DATABASE.md | src/server/db/ |
| Deployment | agents/ops/SETUP.md | agents/scripts/deploy-ssh.sh |

Provider adapters do not establish working product routes/UI. Implement validation, ownership, persistence and useful recovery for actual product workflows, and verify the real integration path.

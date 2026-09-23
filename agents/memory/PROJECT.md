# Project facts

## Workspace

The workspace root is the application repository. HackAlem is the event; SoloVibe is the team. Product identity and scope follow the supplied case and user-approved concept.

## Technical foundation

Next.js App Router, React, TypeScript, PostgreSQL and Drizzle; Better Auth email/password sessions; next-intl ru/kk/en with Russian initially. Exact versions and commands are in agents/knowledge/STACK.md and package.json. Provider contracts are in agents/knowledge/integrations/. Local application uses port 3000 and local PostgreSQL uses 15432. Runtime settings come from environment configuration.

Deployment origin is https://solovibe-5k5wvv7zo.gobrev.dev, through the public Brev Secure Link and Nginx. Connection and release procedure: agents/ops/SETUP.md. Product AI defaults to gpt-6-luna via OPENAI_MODEL.

File storage has a shared local/R2 adapter in src/server/storage.ts, with persistent local volume support. Both backends preserve bytes and content-type metadata; application routes supply ownership checks and upload limits. Configuration and direct R2 transfers are documented in knowledge/integrations/STORAGE.md.

## Product decisions

Record the approved name, slogan, description, logo direction, users, scope, architecture, chosen integration roles and durable feature status here once decided. Use HACKATHON.md for supplied criteria, PLAN for executable steps and STATE for current progress. Report requests receive a short answer from current knowledge without another audit.

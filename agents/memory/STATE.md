# Current state

Approved CityBalance stage01 active; finish01.1–01.3, then hand off02 only.
01.1 committed/pushed/deployed0c2c83e; domain V1/V2/V4, source seed and brand/primitives verified.
01.2 complete package ready for checkpoint: owned board/catalogue,400ms save queue, revisions/CAS/conflict recovery, library/create/rename/fork/delete, auth/claim, localized functional entry.
Workers /root/domain and /root/visual_foundation handed over and stopped. MAIN integrated locale catalogs and safe navigation flush, retained intent and superseded-idempotent-save conflict handling.
HTTP+PostgreSQL8-group integration passed on localhost:3001 and127.0.0.1:3001; unique test rows cleaned. Covers real saves/score/privacy/CAS/idempotency/invalid-no-write/fork/search/delete/auth-claim-revocation.
SSR entry/board/auth/library locale probes passed; origin403 and oversized413 verified. Pure preview median0.117ms/p950.192ms (Node, not browser performance claim).
TESTING local origin/registration issue reproduced and fixed via exact loopback aliases at configured port, then marked verified. Production origin remains strict.
Native dev session9394 stopped before checkpoint. Container3000 still serves01.1. No native app or active writers. next typegen normalized generated types.
MAIN next: checkpoint01.2 and verify delivery; then create durable AI contracts/schema/jobs, delegate tools/prompts and AI panel, implement worker/runtime/routes and actual provider acceptance01.3.
Shared records src/features/city/records.ts; services src/server/city/; Node DB core src/server/db/core.ts. Board context useScenario() exposes live view/flush/refresh/acceptCanonical(view,true) for AI integration.
Bundled Node24.19.0 must lead PATH. No live provider call yet; configured key/model available. No material decision pending.

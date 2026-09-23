# PostgreSQL and Drizzle

Reuse getDb() from `@/server/db` and src/server/db/schema.ts. Local PostgreSQL 17 uses loopback 15432; hosted runtime uses the internal Compose db:5432 service. Keep environments distinct; production PostgreSQL is not publicly exposed.

The existing schema and initial migration contain only Better Auth identity/session tables, not the product domain model. Design the complete case-specific entities, user profile, relationships, permissions and constraints from the approved scenarios; extend the schema through new migrations. The auth baseline does not limit product scope or prescribe how domain data is represented.

MAIN owns schema/dependencies/migrations. `pnpm db:generate`, inspect SQL, then `pnpm db:migrate`. Commit generated SQL and Drizzle metadata with schema changes. Do not use schema push instead of deployment migrations or edit already applied migrations.

Use bound Drizzle expressions, including ownership: `and(eq(table.id, id), eq(table.ownerId, session.user.id))`. Select needed columns, index actual queries, paginate lists, add meaningful foreign keys/unique constraints. `db.transaction(async tx => ...)` groups dependent writes. Enforce retry idempotency in the database. Remote AI/tool calls should not hold long DB transactions: persist operation state, call provider, then save results transactionally.

Long operations need pending/running/ready/failed state and real recovery. File rows reference storage keys independent of the backend; artifacts record owner/source/version. Conditional updates must include the expected version and check the affected row count so concurrent edits cannot silently overwrite each other. Never manufacture completed results when a remote step failed.

Startup migrations use an advisory lock and the Drizzle ledger schema. The prepared Compose database uses POSTGRES_USER for bootstrap and application access; that bootstrap user is a PostgreSQL superuser, not a restricted application role. If separating runtime and migration roles, grant their required privileges explicitly and verify both paths. Do not delete the ledger or database to repair deployment.

Hosted probes use uniquely identified temporary records and delete only those from the same database where they were created.

References: [select](https://orm.drizzle.team/docs/select), [transactions](https://orm.drizzle.team/docs/transactions), [migrations](https://orm.drizzle.team/docs/migrations).

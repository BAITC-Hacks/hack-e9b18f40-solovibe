import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Constraints, Decision, Evaluation } from "@/features/city/contracts";
import type { SearchResult } from "@/features/city/contracts";
import type { AnalysisDocument, RunStatus, RunEvent, SearchJobInput,RunContext } from "@/features/city/ai-contracts";
import type {StressAssumption} from '@/features/city/contracts';
import type {BriefRecord} from '@/features/city/brief/contracts';
import type {ArtifactRecord} from '@/features/city/artifact-contracts';
import type {PublicSnapshot} from '@/features/city/sharing-contracts';

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("account_user_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

// Dataset versions are append-only. Startup verifies an existing hash rather than replacing it.
export const cityDatasets = pgTable("city_datasets", {
  id: text("id").primaryKey(),
  sourceHash: text("source_hash").notNull(),
  rulesVersion: text("rules_version").notNull(),
  evaluatorVersion: text("evaluator_version").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cityOwners = pgTable("city_owners", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  guestTokenHash: text("guest_token_hash").unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("city_owners_user_idx").on(t.userId), index("city_owners_expiry_idx").on(t.expiresAt)]);

export const cityScenarios = pgTable("city_scenarios", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => cityOwners.id, { onDelete: "cascade" }),
  datasetVersion: text("dataset_version").notNull().references(() => cityDatasets.id),
  rulesVersion: text("rules_version").notNull(),
  title: text("title").notNull(),
  currentRevisionId: text("current_revision_id"),
  clientMutationId: text("client_mutation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, t => [index("city_scenarios_owner_list_idx").on(t.ownerId, t.updatedAt, t.id), uniqueIndex("city_scenario_mutation_unique").on(t.ownerId, t.clientMutationId)]);

export const cityRevisions = pgTable("city_revisions", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id").notNull().references(() => cityScenarios.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => cityRevisions.id),
  sourceRevisionId: text("source_revision_id").references((): AnyPgColumn => cityRevisions.id),
  decisions: jsonb("decisions").$type<Decision[]>().notNull(),
  constraints: jsonb("constraints").$type<Constraints>().notNull(),
  intent: text("intent").notNull().default(""),
  cause: text("cause").notNull(),
  title: text("title"),
  clientMutationId: text("client_mutation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("city_revisions_scenario_idx").on(t.scenarioId, t.createdAt), uniqueIndex("city_revision_mutation_unique").on(t.scenarioId, t.clientMutationId)]);

export const cityEvaluations = pgTable("city_evaluations", {
  id: text("id").primaryKey(),
  revisionId: text("revision_id").notNull().unique().references(() => cityRevisions.id, { onDelete: "cascade" }),
  result: jsonb("result").$type<Evaluation>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cityRuns = pgTable("city_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => cityOwners.id, { onDelete: "cascade" }),
  quotaKey: text("quota_key").notNull(),
  scenarioId: text("scenario_id").notNull().references(() => cityScenarios.id, { onDelete: "cascade" }),
  inputRevisionId: text("input_revision_id").notNull().references(() => cityRevisions.id, { onDelete: "cascade" }),
  parentRunId: text("parent_run_id"),
  procedure: text("procedure").$type<"plan" | "explain" | "brief">().notNull(),
  context:jsonb('context').$type<RunContext>().notNull().default({}),
  objective: text("objective").notNull(),
  locale: text("locale").$type<"ru" | "kk" | "en">().notNull(),
  inputHash: text("input_hash").notNull(),
  clientRequestId: text("client_request_id").notNull(),
  status: text("status").$type<RunStatus>().notNull(),
  errorCode: text("error_code"),
  question: text("question"),
  analysisId: text("analysis_id"),
  alternativeRevisionIds: jsonb("alternative_revision_ids").$type<string[]>().notNull().default([]),
  eventSeq: integer("event_seq").notNull().default(0),
  toolCount: integer("tool_count").notNull().default(0),
  searchCount: integer("search_count").notNull().default(0),
  usage: jsonb("usage").$type<{ inputTokens: number; outputTokens: number }>().notNull().default({ inputTokens: 0, outputTokens: 0 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
}, t => [uniqueIndex("city_runs_request_unique").on(t.ownerId, t.clientRequestId), index("city_runs_scenario_idx").on(t.scenarioId, t.createdAt), index("city_runs_quota_idx").on(t.quotaKey, t.status)]);

export const cityJobs = pgTable("city_jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"analysis" | "search" | "retention">().notNull(),
  input: jsonb("input").$type<SearchJobInput>(),
  clientRequestId: text("client_request_id"),
  resultId: text("result_id"),
  errorCode: text("error_code"),
  runId: text("run_id").unique().references(() => cityRuns.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").references(() => cityOwners.id, { onDelete: "cascade" }),
  quotaKey: text("quota_key").notNull(),
  status: text("status").$type<"queued" | "running" | "completed" | "failed" | "cancelled">().notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  leaseToken: integer("lease_token").notNull().default(0),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  workerId: text("worker_id"),
  notBefore: timestamp("not_before", { withTimezone: true }).defaultNow().notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("city_jobs_claim_idx").on(t.status, t.notBefore), index("city_jobs_owner_idx").on(t.quotaKey, t.status), uniqueIndex("city_jobs_request_unique").on(t.ownerId, t.clientRequestId)]);

export const cityRunEvents = pgTable("city_run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => cityRuns.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  kind: text("kind").$type<RunEvent["kind"]>().notNull(),
  status: text("status").notNull(), toolName: text("tool_name"),
  payload: jsonb("payload").$type<RunEvent["payload"]>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("city_run_events_seq_unique").on(t.runId, t.seq)]);

export const cityToolReceipts = pgTable("city_tool_receipts", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().references(() => cityRuns.id, { onDelete: "cascade" }),
  logicalStepId: text("logical_step_id").notNull(), argumentHash: text("argument_hash").notNull(), toolName: text("tool_name").notNull(),
  input: jsonb("input").$type<unknown>(),
  status: text("status").$type<"started" | "completed">().notNull(), output: jsonb("output").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("city_tool_receipt_unique").on(t.runId, t.logicalStepId, t.argumentHash)]);

export const citySearches = pgTable("city_searches", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => cityOwners.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id").notNull().references(() => cityScenarios.id, { onDelete: "cascade" }),
  inputRevisionId: text("input_revision_id").notNull().references(() => cityRevisions.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => cityRuns.id, { onDelete: "cascade" }),
  inputHash: text("input_hash").notNull(), result: jsonb("result").$type<SearchResult>().notNull(),
  baselineResult: jsonb("baseline_result").$type<SearchResult>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("city_searches_owner_idx").on(t.ownerId, t.createdAt)]);

export const cityAnalyses = pgTable("city_analyses", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().unique().references(() => cityRuns.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => cityOwners.id, { onDelete: "cascade" }),
  sourceRevisionId: text("source_revision_id").notNull().references(() => cityRevisions.id, { onDelete: "cascade" }),
  document: jsonb("document").$type<AnalysisDocument>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const cityRateWindows = pgTable("city_rate_windows", {
  key: text("key").primaryKey(), windowStart: timestamp("window_start", { withTimezone: true }).notNull(), count: integer("count").notNull(),
});
export const cityWorkerHeartbeats = pgTable("city_worker_heartbeats", {
  id: text("id").primaryKey(), revision: text("revision").notNull(), seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cityStressTests=pgTable('city_stress_tests',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>cityOwners.id,{onDelete:'cascade'}),scenarioId:text('scenario_id').notNull().references(()=>cityScenarios.id,{onDelete:'cascade'}),sourceRevisionId:text('source_revision_id').notNull().references(()=>cityRevisions.id),assumption:jsonb('assumption').$type<StressAssumption>().notNull(),baseline:jsonb('baseline').$type<Evaluation>().notNull(),stressed:jsonb('stressed').$type<Evaluation>().notNull(),repairRevisionIds:jsonb('repair_revision_ids').$type<string[]>().notNull().default([]),clientMutationId:text('client_mutation_id').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('city_stress_mutation_unique').on(t.ownerId,t.clientMutationId),index('city_stress_scenario_idx').on(t.scenarioId,t.createdAt)]);
export const cityBriefs=pgTable('city_briefs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>cityOwners.id,{onDelete:'cascade'}),scenarioId:text('scenario_id').notNull().references(()=>cityScenarios.id,{onDelete:'cascade'}),sourceRevisionId:text('source_revision_id').notNull().references(()=>cityRevisions.id),version:integer('version').notNull(),content:jsonb('content').$type<BriefRecord>().notNull(),clientMutationId:text('client_mutation_id').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('city_brief_mutation_unique').on(t.ownerId,t.clientMutationId),index('city_brief_scenario_idx').on(t.scenarioId,t.updatedAt)]);
export const cityBriefVersions=pgTable('city_brief_versions',{
 id:text('id').primaryKey(),briefId:text('brief_id').notNull().references(()=>cityBriefs.id,{onDelete:'cascade'}),version:integer('version').notNull(),content:jsonb('content').$type<BriefRecord>().notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('city_brief_version_unique').on(t.briefId,t.version)]);
export const cityArtifacts=pgTable('city_artifacts',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>cityOwners.id),scenarioId:text('scenario_id').notNull().references(()=>cityScenarios.id),revisionId:text('revision_id').notNull().references(()=>cityRevisions.id),briefId:text('brief_id').references(()=>cityBriefs.id),briefVersion:integer('brief_version'),kind:text('kind').$type<ArtifactRecord['kind']>().notNull(),locale:text('locale').$type<ArtifactRecord['locale']>().notNull(),backend:text('backend').$type<'local'|'r2'>().notNull(),key:text('key').notNull().unique(),mime:text('mime').notNull(),size:integer('size'),sha256:text('sha256'),state:text('state').$type<ArtifactRecord['state']>().notNull(),errorCode:text('error_code'),cacheKey:text('cache_key').notNull(),clientMutationId:text('client_mutation_id').notNull(),attempts:integer('attempts').notNull().default(0),retryAt:timestamp('retry_at',{withTimezone:true}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('city_artifact_cache_unique').on(t.ownerId,t.cacheKey),index('city_artifact_cleanup_idx').on(t.state,t.retryAt),index('city_artifact_scenario_idx').on(t.scenarioId,t.createdAt)]);
export const cityShares=pgTable('city_shares',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>cityOwners.id,{onDelete:'cascade'}),scenarioId:text('scenario_id').notNull().references(()=>cityScenarios.id,{onDelete:'cascade'}),revisionId:text('revision_id').notNull().references(()=>cityRevisions.id),briefId:text('brief_id').references(()=>cityBriefs.id),briefVersion:integer('brief_version'),artifactIds:jsonb('artifact_ids').$type<string[]>().notNull().default([]),teamName:text('team_name').notNull(),tokenHash:text('token_hash').notNull().unique(),snapshot:jsonb('snapshot').$type<PublicSnapshot>().notNull(),clientMutationId:text('client_mutation_id').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),revokedAt:timestamp('revoked_at',{withTimezone:true}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('city_share_mutation_unique').on(t.ownerId,t.clientMutationId),index('city_share_scenario_idx').on(t.scenarioId,t.createdAt)]);

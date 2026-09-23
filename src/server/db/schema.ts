import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Constraints, Decision, Evaluation } from "@/features/city/contracts";

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

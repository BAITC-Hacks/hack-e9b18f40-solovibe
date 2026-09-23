CREATE TABLE "city_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"brief_id" text,
	"brief_version" integer,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"backend" text NOT NULL,
	"key" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer,
	"sha256" text,
	"state" text NOT NULL,
	"error_code" text,
	"cache_key" text NOT NULL,
	"client_mutation_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_artifacts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "city_brief_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"source_revision_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"client_mutation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_stress_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"source_revision_id" text NOT NULL,
	"assumption" jsonb NOT NULL,
	"baseline" jsonb NOT NULL,
	"stressed" jsonb NOT NULL,
	"repair_revision_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_mutation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "city_runs" ADD COLUMN "context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "city_artifacts" ADD CONSTRAINT "city_artifacts_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_artifacts" ADD CONSTRAINT "city_artifacts_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_artifacts" ADD CONSTRAINT "city_artifacts_revision_id_city_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_artifacts" ADD CONSTRAINT "city_artifacts_brief_id_city_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."city_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_brief_versions" ADD CONSTRAINT "city_brief_versions_brief_id_city_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."city_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_briefs" ADD CONSTRAINT "city_briefs_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_briefs" ADD CONSTRAINT "city_briefs_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_briefs" ADD CONSTRAINT "city_briefs_source_revision_id_city_revisions_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_stress_tests" ADD CONSTRAINT "city_stress_tests_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_stress_tests" ADD CONSTRAINT "city_stress_tests_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_stress_tests" ADD CONSTRAINT "city_stress_tests_source_revision_id_city_revisions_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "city_artifact_cache_unique" ON "city_artifacts" USING btree ("owner_id","cache_key");--> statement-breakpoint
CREATE INDEX "city_artifact_cleanup_idx" ON "city_artifacts" USING btree ("state","retry_at");--> statement-breakpoint
CREATE INDEX "city_artifact_scenario_idx" ON "city_artifacts" USING btree ("scenario_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "city_brief_version_unique" ON "city_brief_versions" USING btree ("brief_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "city_brief_mutation_unique" ON "city_briefs" USING btree ("owner_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "city_brief_scenario_idx" ON "city_briefs" USING btree ("scenario_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "city_stress_mutation_unique" ON "city_stress_tests" USING btree ("owner_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "city_stress_scenario_idx" ON "city_stress_tests" USING btree ("scenario_id","created_at");
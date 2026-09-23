CREATE TABLE "city_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"source_revision_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_analyses_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "city_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"run_id" text,
	"owner_id" text,
	"quota_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"worker_id" text,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_jobs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "city_rate_windows" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_run_events" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"tool_name" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"quota_key" text NOT NULL,
	"scenario_id" text NOT NULL,
	"input_revision_id" text NOT NULL,
	"parent_run_id" text,
	"procedure" text NOT NULL,
	"objective" text NOT NULL,
	"locale" text NOT NULL,
	"input_hash" text NOT NULL,
	"client_request_id" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"question" text,
	"analysis_id" text,
	"alternative_revision_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"event_seq" integer DEFAULT 0 NOT NULL,
	"tool_count" integer DEFAULT 0 NOT NULL,
	"search_count" integer DEFAULT 0 NOT NULL,
	"usage" jsonb DEFAULT '{"inputTokens":0,"outputTokens":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"input_revision_id" text NOT NULL,
	"run_id" text,
	"input_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_tool_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"logical_step_id" text NOT NULL,
	"argument_hash" text NOT NULL,
	"tool_name" text NOT NULL,
	"status" text NOT NULL,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_worker_heartbeats" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "city_analyses" ADD CONSTRAINT "city_analyses_run_id_city_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."city_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_analyses" ADD CONSTRAINT "city_analyses_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_analyses" ADD CONSTRAINT "city_analyses_source_revision_id_city_revisions_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_jobs" ADD CONSTRAINT "city_jobs_run_id_city_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."city_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_jobs" ADD CONSTRAINT "city_jobs_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_run_events" ADD CONSTRAINT "city_run_events_run_id_city_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."city_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_runs" ADD CONSTRAINT "city_runs_input_revision_id_city_revisions_id_fk" FOREIGN KEY ("input_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_searches" ADD CONSTRAINT "city_searches_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_searches" ADD CONSTRAINT "city_searches_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_searches" ADD CONSTRAINT "city_searches_input_revision_id_city_revisions_id_fk" FOREIGN KEY ("input_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_searches" ADD CONSTRAINT "city_searches_run_id_city_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."city_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_tool_receipts" ADD CONSTRAINT "city_tool_receipts_run_id_city_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."city_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_jobs_claim_idx" ON "city_jobs" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "city_jobs_owner_idx" ON "city_jobs" USING btree ("quota_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX "city_run_events_seq_unique" ON "city_run_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "city_runs_request_unique" ON "city_runs" USING btree ("owner_id","client_request_id");--> statement-breakpoint
CREATE INDEX "city_runs_scenario_idx" ON "city_runs" USING btree ("scenario_id","created_at");--> statement-breakpoint
CREATE INDEX "city_runs_quota_idx" ON "city_runs" USING btree ("quota_key","status");--> statement-breakpoint
CREATE INDEX "city_searches_owner_idx" ON "city_searches" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "city_tool_receipt_unique" ON "city_tool_receipts" USING btree ("run_id","logical_step_id","argument_hash");
CREATE TABLE "city_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_evaluations_revision_id_unique" UNIQUE("revision_id")
);
--> statement-breakpoint
CREATE TABLE "city_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"guest_token_hash" text,
	"expires_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_owners_guest_token_hash_unique" UNIQUE("guest_token_hash")
);
--> statement-breakpoint
CREATE TABLE "city_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"parent_id" text,
	"source_revision_id" text,
	"decisions" jsonb NOT NULL,
	"constraints" jsonb NOT NULL,
	"intent" text DEFAULT '' NOT NULL,
	"cause" text NOT NULL,
	"title" text,
	"client_mutation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"dataset_version" text NOT NULL,
	"rules_version" text NOT NULL,
	"title" text NOT NULL,
	"current_revision_id" text,
	"client_mutation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "city_evaluations" ADD CONSTRAINT "city_evaluations_revision_id_city_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_owners" ADD CONSTRAINT "city_owners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_revisions" ADD CONSTRAINT "city_revisions_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_revisions" ADD CONSTRAINT "city_revisions_parent_id_city_revisions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_revisions" ADD CONSTRAINT "city_revisions_source_revision_id_city_revisions_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_scenarios" ADD CONSTRAINT "city_scenarios_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_scenarios" ADD CONSTRAINT "city_scenarios_dataset_version_city_datasets_id_fk" FOREIGN KEY ("dataset_version") REFERENCES "public"."city_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_owners_user_idx" ON "city_owners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "city_owners_expiry_idx" ON "city_owners" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "city_revisions_scenario_idx" ON "city_revisions" USING btree ("scenario_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "city_revision_mutation_unique" ON "city_revisions" USING btree ("scenario_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "city_scenarios_owner_list_idx" ON "city_scenarios" USING btree ("owner_id","updated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "city_scenario_mutation_unique" ON "city_scenarios" USING btree ("owner_id","client_mutation_id");
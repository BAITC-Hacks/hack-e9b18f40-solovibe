CREATE TABLE "city_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"brief_id" text,
	"brief_version" integer,
	"artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"team_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"client_mutation_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_shares_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "city_shares" ADD CONSTRAINT "city_shares_owner_id_city_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."city_owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_shares" ADD CONSTRAINT "city_shares_scenario_id_city_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."city_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_shares" ADD CONSTRAINT "city_shares_revision_id_city_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_shares" ADD CONSTRAINT "city_shares_brief_id_city_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."city_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "city_share_mutation_unique" ON "city_shares" USING btree ("owner_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "city_share_scenario_idx" ON "city_shares" USING btree ("scenario_id","created_at");
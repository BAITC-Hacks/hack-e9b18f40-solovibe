ALTER TABLE "city_revisions" DROP CONSTRAINT "city_revisions_source_revision_id_city_revisions_id_fk";
--> statement-breakpoint
ALTER TABLE "city_revisions" ADD CONSTRAINT "city_revisions_source_revision_id_city_revisions_id_fk" FOREIGN KEY ("source_revision_id") REFERENCES "public"."city_revisions"("id") ON DELETE set null ON UPDATE no action;
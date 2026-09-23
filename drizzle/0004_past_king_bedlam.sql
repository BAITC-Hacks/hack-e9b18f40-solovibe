ALTER TABLE "city_jobs" ADD COLUMN "input" jsonb;--> statement-breakpoint
ALTER TABLE "city_jobs" ADD COLUMN "client_request_id" text;--> statement-breakpoint
ALTER TABLE "city_jobs" ADD COLUMN "result_id" text;--> statement-breakpoint
ALTER TABLE "city_jobs" ADD COLUMN "error_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "city_jobs_request_unique" ON "city_jobs" USING btree ("owner_id","client_request_id");
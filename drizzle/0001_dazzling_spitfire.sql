CREATE TABLE "city_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"source_hash" text NOT NULL,
	"rules_version" text NOT NULL,
	"evaluator_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

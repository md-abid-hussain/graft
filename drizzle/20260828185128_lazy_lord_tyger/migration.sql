DROP TABLE IF EXISTS "findings";--> statement-breakpoint
DROP TABLE IF EXISTS "run_steps";--> statement-breakpoint
DROP TABLE IF EXISTS "runs";--> statement-breakpoint
ALTER TABLE "hackathon_products" DROP COLUMN IF EXISTS "is_required";--> statement-breakpoint
ALTER TABLE "hackathons" DROP COLUMN IF EXISTS "source_format";

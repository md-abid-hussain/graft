ALTER TABLE "hackathons" ADD COLUMN "challenge" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "project_ideas" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "best_practices" jsonb DEFAULT '[]' NOT NULL;
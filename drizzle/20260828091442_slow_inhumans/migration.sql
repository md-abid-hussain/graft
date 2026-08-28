ALTER TABLE "hackathons" ADD COLUMN "source_format" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "mode" text;--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "registration_url" text;
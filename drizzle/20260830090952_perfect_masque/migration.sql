CREATE TABLE "builds" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"targets" jsonb DEFAULT '[]' NOT NULL,
	"summary" text,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "builds_status_idx" ON "builds" ("status");--> statement-breakpoint
CREATE INDEX "builds_kind_idx" ON "builds" ("kind");--> statement-breakpoint
CREATE INDEX "builds_targets_idx" ON "builds" USING gin ("targets");
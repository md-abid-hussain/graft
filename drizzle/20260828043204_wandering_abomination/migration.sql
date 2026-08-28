CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" bigserial PRIMARY KEY,
	"source_id" text NOT NULL,
	"product_id" text,
	"hackathon_id" text,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"doc_title" text,
	"heading_path" text,
	"ord" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"embedding" vector(1536) NOT NULL,
	"tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" bigserial PRIMARY KEY,
	"hackathon_id" text,
	"product_id" text,
	"kind" text NOT NULL,
	"title" text,
	"url" text NOT NULL,
	"relevance" real,
	"verdict" text,
	"evidence" text,
	"found_by" text,
	"source_page" text,
	"verified" boolean DEFAULT false NOT NULL,
	"http_status" integer,
	"verified_at" timestamp with time zone,
	"ingested" boolean DEFAULT false NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_url_uniq" UNIQUE("hackathon_id","url")
);
--> statement-breakpoint
CREATE TABLE "hackathons" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"tagline" text,
	"description" text,
	"host" text DEFAULT 'WeMakeDevs',
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"timezone" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"source_url" text NOT NULL,
	"prizes" jsonb DEFAULT '[]' NOT NULL,
	"tracks" jsonb DEFAULT '[]' NOT NULL,
	"rules" jsonb DEFAULT '[]' NOT NULL,
	"judging" jsonb DEFAULT '[]' NOT NULL,
	"requirements" jsonb DEFAULT '[]' NOT NULL,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"company" text,
	"category" text NOT NULL,
	"summary" text,
	"hackathon_id" text,
	"role" text DEFAULT 'main_sponsor' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"ingest_policy" text DEFAULT 'full' NOT NULL,
	"homepage_url" text,
	"docs_url" text,
	"llms_txt_url" text,
	"sitemap_url" text,
	"github_url" text,
	"blog_url" text,
	"socials" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" bigserial PRIMARY KEY,
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"phase" text NOT NULL,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"citations" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_steps_seq_uniq" UNIQUE("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"agent_name" text NOT NULL,
	"input" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY,
	"product_id" text,
	"hackathon_id" text,
	"url" text NOT NULL UNIQUE,
	"title" text,
	"kind" text NOT NULL,
	"discovery_method" text,
	"content_hash" text,
	"byte_size" integer DEFAULT 0,
	"page_count" integer DEFAULT 0,
	"chunk_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"stale_reason" text,
	"fetched_at" timestamp with time zone,
	"indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chunks_product_idx" ON "chunks" ("product_id");--> statement-breakpoint
CREATE INDEX "chunks_hackathon_idx" ON "chunks" ("hackathon_id");--> statement-breakpoint
CREATE INDEX "chunks_kind_idx" ON "chunks" ("kind");--> statement-breakpoint
CREATE INDEX "chunks_tsv_idx" ON "chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "findings_hackathon_idx" ON "findings" ("hackathon_id");--> statement-breakpoint
CREATE INDEX "findings_relevance_idx" ON "findings" ("relevance");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" ("category");--> statement-breakpoint
CREATE INDEX "products_hackathon_idx" ON "products" ("hackathon_id");--> statement-breakpoint
CREATE INDEX "run_steps_session_idx" ON "run_steps" ("session_id","seq");--> statement-breakpoint
CREATE INDEX "sources_status_idx" ON "sources" ("status");--> statement-breakpoint
CREATE INDEX "sources_product_idx" ON "sources" ("product_id");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_hackathon_id_hackathons_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "hackathons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_source_id_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_hackathon_id_hackathons_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "hackathons"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_hackathon_id_hackathons_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "hackathons"("id") ON DELETE CASCADE;

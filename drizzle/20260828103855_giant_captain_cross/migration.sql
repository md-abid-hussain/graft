CREATE TABLE "hackathon_products" (
	"hackathon_id" text NOT NULL,
	"product_id" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hackathon_products_pk" UNIQUE("hackathon_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_hackathon_id_hackathons_id_fkey";--> statement-breakpoint
DROP INDEX "products_hackathon_idx";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "hackathon_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_required";--> statement-breakpoint
CREATE INDEX "hackathon_products_product_idx" ON "hackathon_products" ("product_id");--> statement-breakpoint
ALTER TABLE "hackathon_products" ADD CONSTRAINT "hackathon_products_hackathon_id_hackathons_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "hackathons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "hackathon_products" ADD CONSTRAINT "hackathon_products_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
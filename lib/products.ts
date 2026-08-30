import "server-only";
import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, hackathonProducts, hackathons, products, sources } from "@/lib/db/schema";

/**
 * Products as the site reads them.
 *
 * Read from `products` outward rather than from a hackathon inward, because a product
 * does not belong to one: the join table carries the relation, and a product with no
 * row there is a perfectly ordinary record. That is the whole reason the corpus
 * outlives the event it was met at — and until this page existed, an unlinked product
 * was queryable over MCP but invisible in the app.
 */

/**
 * How many products are on record.
 *
 * Separate from `listProducts` because the landing page wants one integer, and that
 * function loads every product, source and hackathon link plus a grouped scan of the
 * whole chunks table to build cards nobody is rendering there. The landing page is
 * `force-dynamic`, so it would pay that on every request.
 */
export async function countProducts(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
  return row?.n ?? 0;
}

/** Chunks are counted from `chunks`, not `sources.chunk_count`, so the number is what
 *  retrieval can actually return rather than what ingestion reported. */
export async function listProducts() {
  const [productRows, links, hackathonRows, sourceRows, chunkRows] = await Promise.all([
    db.select().from(products).orderBy(asc(products.name)),
    db.select().from(hackathonProducts),
    db.select().from(hackathons),
    db.select().from(sources),
    db
      .select({ productId: chunks.productId, n: sql<number>`count(*)::int` })
      .from(chunks)
      .groupBy(chunks.productId),
  ]);

  const hackathonById = new Map(hackathonRows.map((h) => [h.id, h]));
  const chunksByProduct = new Map(chunkRows.map((c) => [c.productId, c.n]));

  return productRows.map((p) => {
    const own = sourceRows.filter((s) => s.productId === p.id);

    return {
      slug: p.slug,
      name: p.name,
      company: p.company,
      category: p.category,
      summary: p.summary,

      homepageUrl: p.homepageUrl,
      docsUrl: p.docsUrl,
      githubUrl: p.githubUrl,
      llmsFullUrl: p.llmsFullUrl,
      sitemapUrl: p.sitemapUrl,
      socials: (p.socials ?? {}) as Record<string, string | undefined>,

      chunks: chunksByProduct.get(p.id) ?? 0,
      sources: {
        total: own.length,
        indexed: own.filter((s) => s.status === "indexed").length,
        pending: own.filter((s) => s.status === "pending").length,
        failed: own.filter((s) => s.status === "failed").length,
      },

      hackathons: links
        .filter((l) => l.productId === p.id)
        .map((l) => hackathonById.get(l.hackathonId))
        .filter((h): h is NonNullable<typeof h> => Boolean(h))
        .map((h) => ({ slug: h.slug, title: h.title, status: h.status }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    };
  });
}

export type ProductCard = Awaited<ReturnType<typeof listProducts>>[number];

/**
 * Why a product is or is not searchable.
 *
 * Kept as a derived state rather than a stored column: it is a reading of the source
 * rows, and a column would be one more thing to keep true. `unindexed` is the state
 * that matters — a product recorded with no way in is exactly what sitemap ingestion
 * exists to rescue, and it should be visible rather than look like a normal entry with
 * a zero next to it.
 */
export function indexStateOf(p: ProductCard) {
  if (p.chunks > 0) return "indexed" as const;
  if (p.sources.pending > 0) return "pending" as const;
  if (p.sources.failed > 0) return "failed" as const;
  return "unindexed" as const;
}

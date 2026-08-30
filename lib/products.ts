import "server-only";
import { cache } from "react";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
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

/**
 * One product, with everything indexed for it.
 *
 * Scoped rather than filtered: `listProducts` loads every product, source and link plus
 * a grouped scan of the whole chunks table, which is the right shape for the grid and
 * the wrong one for a page about a single record. Here the chunk count is a `where` on
 * one product id, so the cost tracks that product rather than the corpus.
 *
 * Sources come back worst-first: a failed one is the only row on this page anybody has
 * to act on, and a product like signoz carries nine hundred of them, so burying the
 * failure at position 847 by sorting on size would hide the one thing worth seeing.
 */
export const getProduct = cache(async (slug: string) => {
  const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!row) return null;

  const [sourceRows, links, chunkRows] = await Promise.all([
    db
      .select()
      .from(sources)
      .where(eq(sources.productId, row.id))
      .orderBy(desc(sources.chunkCount)),
    db.select().from(hackathonProducts).where(eq(hackathonProducts.productId, row.id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.productId, row.id)),
  ]);

  const events = links.length
    ? await db
        .select({
          slug: hackathons.slug,
          title: hackathons.title,
          status: hackathons.status,
          id: hackathons.id,
        })
        .from(hackathons)
        .where(
          inArray(
            hackathons.id,
            links.map((l) => l.hackathonId),
          ),
        )
    : [];

  const notesByHackathon = new Map(links.map((l) => [l.hackathonId, l.notes]));
  const rank = { failed: 0, pending: 1, stale: 2, indexed: 3, skipped: 4 } as const;

  return {
    ...row,
    socials: (row.socials ?? {}) as Record<string, string | undefined>,

    // Counted from `chunks`, not summed from `sources.chunk_count`, for the same reason
    // `listProducts` does: this is what retrieval can actually return.
    chunks: chunkRows[0]?.n ?? 0,

    sources: sourceRows.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9)),

    appearances: events
      .map((e) => ({ ...e, notes: notesByHackathon.get(e.id) ?? null }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/**
 * How the sources for one product break down.
 *
 * A count of "1004 sources" says nothing a reader can use. What matters is how they got
 * here and whether any of them did not make it.
 */
export function coverageOf(p: ProductDetail) {
  const byStatus = new Map<string, number>();
  const byMethod = new Map<string, number>();
  for (const s of p.sources) {
    byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    // Nullable in the schema: a source recorded before discovery was tracked has none.
    const method = s.discoveryMethod ?? "unknown";
    byMethod.set(method, (byMethod.get(method) ?? 0) + 1);
  }
  return {
    total: p.sources.length,
    failed: byStatus.get("failed") ?? 0,
    byStatus: [...byStatus].sort((a, b) => b[1] - a[1]),
    byMethod: [...byMethod].sort((a, b) => b[1] - a[1]),
  };
}

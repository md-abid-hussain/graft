import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { searchDocs } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retrieval, without an agent in front of it.
 *
 * The same `searchDocs` the MCP tool calls, reachable from the product page. Until this
 * existed the only way to see the index answer anything was to open a chat and spend a
 * model call on it — which demonstrates the agent, not the corpus.
 *
 * There is no model in the answer path, but there is one in the question path: the
 * vector half has to embed the query, so a search costs one embedding round-trip and
 * lands between roughly 0.4s and 2.5s. The retrieval itself is a few milliseconds. That
 * is why the client debounces rather than searching per keystroke.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const slug = searchParams.get("product")?.trim();

  if (!query || !slug) return NextResponse.json({ hits: [] });

  try {
    // `searchDocs` filters on `chunks.product_id`, so a slug passed straight through
    // would match nothing and read as "no coverage" rather than as the mistake it is.
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    if (!row) return NextResponse.json({ hits: [] });

    return NextResponse.json({
      hits: await searchDocs({ query, productId: row.id, limit: 8 }),
    });
  } catch {
    // A failed search is not worth a 500 on a page that renders fine without it.
    return NextResponse.json({ hits: [], failed: true });
  }
}

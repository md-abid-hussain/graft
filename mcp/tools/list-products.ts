import type { McpServer } from "@modelcontextprotocol/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/connection";
import * as s from "../schemas";
import { READ, reply } from "../shared";

export function registerListProducts(server: McpServer) {
  server.registerTool(
    "list_products",
    {
      title: "List products",
      description:
        "Every product in the corpus, with its category and how much of it " +
        "is indexed. Takes no arguments.\n\n" +
        "Call this first. search_docs requires a product slug and this is where those " +
        "slugs come from — they are frequently not what you would guess from the " +
        "product name.\n\n" +
        "A product showing 0 chunks is on record but has no searchable documentation: " +
        "search_docs will return nothing for it. Use get_product for its links and go " +
        "to the source yourself.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        products: z.array(s.productSummary),
        count: z.number().int(),
      }),
      annotations: READ,
    },
    async () => {
      // Counted from `chunks` rather than read off `sources.chunk_count`, so the
      // number reflects what retrieval can actually return.
      const { rows } = await db.execute<{
        product: string;
        name: string;
        category: string;
        homepage_url: string | null;
        docs_url: string | null;
        sources: string;
        chunks: string;
      }>(sql`
        SELECT p.slug         AS product,
               p.name         AS name,
               p.category     AS category,
               p.homepage_url AS homepage_url,
               p.docs_url     AS docs_url,
               (SELECT count(*) FROM sources sc
                 WHERE sc.product_id = p.id AND sc.status = 'indexed') AS sources,
               (SELECT count(*) FROM chunks ch WHERE ch.product_id = p.id) AS chunks
        FROM products p
        ORDER BY p.name ASC
      `);

      const products = rows.map((r) => ({
        product: r.product,
        name: r.name,
        category: r.category,
        homepageUrl: r.homepage_url,
        docsUrl: r.docs_url,
        indexed: { sourceCount: Number(r.sources), chunkCount: Number(r.chunks) },
      }));

      return reply({ products, count: products.length });
    },
  );
}

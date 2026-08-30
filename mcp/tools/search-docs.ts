import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { searchDocs } from "@/lib/search";
import * as s from "../schemas";
import { READ, reply, slug, unknownSlug } from "../shared";

export function registerSearchDocs(server: McpServer) {
  server.registerTool(
    "search_docs",
    {
      title: "Search product documentation",
      description:
        "Search one product's indexed documentation and get back cited passages. " +
        "This is the tool that replaces reading a documentation site.\n\n" +
        "Retrieval is hybrid — vector search and full-text search run in parallel and " +
        "their rankings are fused — so it handles both an exact identifier like " +
        "`OTEL_EXPORTER_OTLP_ENDPOINT` and a question that shares no words with the " +
        "page that answers it.\n\n" +
        "Two things make it work much better:\n" +
        "• Ask a whole question, not a keyword list. 'how do I stop the agent before " +
        "it does something irreversible' beats 'approval gate' — the vector half " +
        "needs something to match meaning against.\n" +
        "• One product per call. `product` is required and filtered before retrieval " +
        "runs, which is what stops a question about one tool returning another's " +
        "docs. Get the slug from list_products.\n\n" +
        "Every hit carries the URL it came from — cite it. Long passages are cut with " +
        "a trailing ellipsis and `truncated: true`; fetch the URL if you need the rest.",
      inputSchema: z.object({
        query: z.string().min(1).describe("A question or phrase, not a keyword list"),
        product: slug.describe("Slug from list_products — required"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      outputSchema: z.object({
        product: z.string(),
        query: z.string(),
        hits: z.array(s.searchHit),
        count: z.number().int(),
      }),
      annotations: READ,
    },
    async ({ query, product, limit }) => {
      const [row] = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.slug, product))
        .limit(1);

      if (!row) return unknownSlug("product", product);

      const hits = await searchDocs({ query, productId: row.id, limit });
      return reply({ product, query, hits, count: hits.length });
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { ingestSources } from "@/lib/ingest/ingest";
import { sourceInput } from "../inputs";
import { WRITE, fail, reply, unknownSlug, unknownSlugToWrite } from "../shared";

export function registerIngestSource(server: McpServer) {
  server.registerTool(
    "ingest_source",
    {
      title: "Index documentation sources",
      description:
        "Fetch, chunk, embed and index documentation. Step 3 of a research run, and " +
        "what makes search_docs able to answer anything at all.\n\n" +
        "**Pass URLs, never file contents.** This server does the fetching. Downloading " +
        "a multi-megabyte documentation file to paste it in here spends your entire " +
        "context doing badly what the pipeline does well, and skips the content hashing " +
        "that makes a re-run take milliseconds instead of minutes.\n\n" +
        "**One call per product.** `urls` is a list, and every URL in it is indexed " +
        "against the single `product` this call names. Batch a product's pages together " +
        "— each call stops for human approval, so fifty pages one at a time asks a " +
        "person to click fifty times — but never mix two products in one call: their " +
        "docs would be stored under whichever product you named, and `search_docs` " +
        "filters on exactly that, so the rest become unfindable. Two products means two " +
        "calls. Within a call the URLs are fetched concurrently and each becomes its " +
        "own source with its own content hash, so a re-run only re-embeds what " +
        "changed.\n\n" +
        "**Prefer llms-full.txt where it exists** — it is one URL for a whole docs set. " +
        "Do not pass llms.txt: it is an index of links, so indexing it produces chunks " +
        "that are nothing but link lists, which match queries confidently and answer " +
        "none of them. Read llms.txt yourself to discover the pages, then pass those " +
        "page URLs here. Plenty of products serve markdown per page instead — SigNoz " +
        "appends `.md` to a docs URL, Datadog nests an llms.txt per section — and that " +
        "is exactly the case this tool takes a list for.\n\n" +
        "Inside an llms-full.txt, two layouts are handled: documents delimited by " +
        "`Source:` lines that give each one its canonical URL, and documents split on " +
        "top-level headings where the publisher omits them. An ordinary markdown page " +
        "indexes as one document, titled from its own first heading.\n\n" +
        "**Markdown only — an HTML page is refused, not indexed.** The file extension " +
        "is irrelevant; what comes back has to be prose. Most docs sites serve a " +
        "markdown twin of every page, so when a URL is refused try appending `.md` to " +
        "it, requesting it with `Accept: text/markdown`, or use the llms-full.txt.\n\n" +
        "`product` must already be saved. Chunks are filtered by product at query " +
        "time, so anything indexed against an unknown product could never be " +
        "retrieved.\n\n" +
        "One bad URL does not sink the batch: every result carries its own status, and " +
        "a failure reports why. Re-running on unchanged content is free and reports " +
        "`skipped`.",
      inputSchema: sourceInput,
      outputSchema: z.object({
        product: z.string(),
        requested: z.number().int(),
        indexed: z.number().int(),
        skipped: z.number().int(),
        failed: z.number().int(),
        chunkCount: z.number().int(),
        tookMs: z.number().int(),
        results: z.array(
          z.object({
            url: z.string(),
            status: z.enum(["indexed", "skipped", "failed"]),
            pageCount: z.number().int(),
            chunkCount: z.number().int(),
            reason: z.string().nullable(),
          }),
        ),
      }),
      annotations: { ...WRITE, idempotentHint: false },
    },
    async ({ urls, product, kind, title, hackathon, force }) => {
      const [row] = await db
        .select({
          id: schema.products.id,
          name: schema.products.name,
        })
        .from(schema.products)
        .where(eq(schema.products.slug, product))
        .limit(1);

      if (!row)
        return unknownSlugToWrite(
          "product",
          product,
          "Indexing against an unsaved product would write chunks that search_docs " +
            "can never return.",
        );

      let hackathonId: string | undefined;
      if (hackathon) {
        const [h] = await db
          .select({ id: schema.hackathons.id })
          .from(schema.hackathons)
          .where(eq(schema.hackathons.slug, hackathon))
          .limit(1);
        if (!h) return unknownSlug("hackathon", hackathon);
        hackathonId = h.id;
      }

      const batch = await ingestSources(urls, {
        kind,
        productId: row.id,
        productName: row.name,
        hackathonId,
        // One override across a batch would stamp the same title on every page, so it
        // is only honoured when the batch is a single URL.
        title: urls.length === 1 ? (title ?? undefined) : undefined,
        force,
      });

      // Every URL failing is a failure, not a result. Reporting it as a successful
      // call full of zeroes reads as "indexed nothing, all good" — and the usual
      // causes (wrong host, docs behind auth) are worth surfacing as an error the
      // agent has to handle.
      if (batch.failed === batch.results.length) {
        return fail(
          `Ingestion failed for all ${batch.results.length} URL(s).\n` +
            batch.results.map((r) => `  ${r.url}: ${r.reason}`).join("\n"),
        );
      }

      return reply({
        product,
        requested: batch.results.length,
        indexed: batch.indexed,
        skipped: batch.skipped,
        failed: batch.failed,
        chunkCount: batch.chunkCount,
        tookMs: batch.tookMs,
        results: batch.results,
      });
    },
  );
}

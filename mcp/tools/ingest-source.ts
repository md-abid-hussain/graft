import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { ingestSource } from "@/lib/ingest/ingest";
import { sourceInput } from "../inputs";
import { WRITE, fail, reply, unknownSlug, unknownSlugToWrite } from "../shared";

export function registerIngestSource(server: McpServer) {
  server.registerTool(
    "ingest_source",
    {
      title: "Index a documentation source",
      description:
        "Fetch, chunk, embed and index one llms-full.txt file. Step 3 of a research " +
        "run, and what makes search_docs able to answer anything at all.\n\n" +
        "**Pass the URL, never the file's contents.** This server does the fetching. " +
        "Downloading a multi-megabyte documentation file to paste it in here spends " +
        "your entire context doing badly what the pipeline does well, and skips the " +
        "content hashing that makes a re-run take milliseconds instead of minutes.\n\n" +
        "**llms-full.txt, not llms.txt.** They are different files and only one is " +
        "worth indexing. llms-full.txt concatenates the entire documentation set — " +
        "that is the whole point of it. llms.txt is an index of links to pages, so " +
        "indexing it produces chunks that are nothing but link lists: they match " +
        "queries confidently and answer none of them, which is worse than having no " +
        "coverage at all. Open the URL and confirm it contains prose before passing " +
        "it here.\n\n" +
        "Inside an llms-full.txt, two layouts are handled: documents delimited by " +
        "`Source:` lines that give each one its canonical URL, and documents split on " +
        "top-level headings where the publisher omits them. A single ordinary " +
        "markdown page also works but indexes as one document. HTML is not supported " +
        "at all. If a product publishes no llms-full.txt, record its links with " +
        "save_product and leave the corpus alone.\n\n" +
        "`product` must already be saved. Chunks are filtered by product at query " +
        "time, so anything indexed against an unknown product could never be " +
        "retrieved.\n\n" +
        "Re-running on unchanged content is free and returns `skipped: true`. If a " +
        "call fails, read `error` on the source in get_product before retrying — the " +
        "same call will usually fail the same way.",
      inputSchema: sourceInput,
      outputSchema: z.object({
        url: z.string(),
        product: z.string(),
        skipped: z.boolean(),
        reason: z.string().nullable(),
        pageCount: z.number().int(),
        chunkCount: z.number().int(),
        tookMs: z.number().int(),
      }),
      annotations: { ...WRITE, idempotentHint: false },
    },
    async ({ url: target, product, kind, title, hackathon, force }) => {
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
        if (!h)
          return unknownSlug("hackathon", hackathon);
        hackathonId = h.id;
      }

      try {
        const result = await ingestSource({
          url: target,
          kind,
          productId: row.id,
          productName: row.name,
          hackathonId,
          title: title ?? undefined,
          force,
        });

        return reply({
          url: target,
          product,
          skipped: result.skipped,
          reason: result.reason ?? null,
          pageCount: result.pageCount,
          chunkCount: result.chunkCount,
          tookMs: result.tookMs,
        });
      } catch (error) {
        return fail(
          `Ingestion failed for ${target}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
}

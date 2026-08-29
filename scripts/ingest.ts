import "dotenv/config";
import { parseArgs } from "node:util";
import { db, pool, schema } from "../lib/db/connection";
import { ingestSource } from "../lib/ingest/ingest";
import type { SourceKind } from "../lib/db/schema";

/**
 * Manual ingestion, for building the corpus while Scout's instructions are still
 * being written.
 *
 * This is NOT seeding — there is no hardcoded product data here. It calls the same
 * `ingestSource()` the MCP tool will call; Scout simply automates the calls later.
 *
 * Imports ../lib/db/connection rather than ../lib/db because the latter carries the
 * `server-only` guard, which throws outside a React Server Component graph.
 *
 *   pnpm ingest --url https://trueforge.dev/llms-full.txt \
 *               --product trueforge --name TrueForge \
 *               --category harness --company TrueFoundry
 */

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    product: { type: "string" },
    hackathon: { type: "string" },
    name: { type: "string" },
    category: { type: "string", default: "other" },
    company: { type: "string" },
    kind: { type: "string", default: "docs" },
    force: { type: "boolean", default: false },
  },
});

if (!values.url) {
  console.error("usage: pnpm ingest --url <url> [--product <slug>] [--name <name>] ...");
  process.exit(1);
}

try {
  if (values.product) {
    // Minimal upsert so the FK resolves. Scout fills in the rest properly later.
    // onConflictDoNothing: an existing product's stored record wins over CLI flags.
    await db
      .insert(schema.products)
      .values({
        id: values.product,
        slug: values.product,
        name: values.name ?? values.product,
        company: values.company ?? null,
        category: values.category!,
      })
      .onConflictDoNothing();
  }

  const result = await ingestSource({
    url: values.url,
    kind: values.kind as SourceKind,
    productId: values.product,
    hackathonId: values.hackathon,
    productName: values.name ?? values.product,
    force: values.force,
    onProgress: (m) => console.log(`  ${m}`),
  });

  console.log(
    result.skipped
      ? `\nskipped (${result.reason}) — ${result.chunkCount} chunks indexed (${result.tookMs}ms)`
      : `\nindexed ${result.pageCount} pages as ${result.chunkCount} chunks ` +
          `via ${result.method} · ${(result.byteSize / 1024).toFixed(0)}KB · ${result.tookMs}ms`,
  );
} finally {
  await pool.end();
}

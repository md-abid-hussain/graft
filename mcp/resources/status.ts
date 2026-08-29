import type { McpServer } from "@modelcontextprotocol/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/connection";

/**
 * `corpus://status` — live coverage.
 *
 * Unlike the guide, this one hits the database on every read. It exists so an agent
 * can see what is actually here without spending a tool call, and so a research
 * agent can tell at a glance whether a hackathon has already been done.
 */

export function registerStatus(server: McpServer) {
  server.registerResource(
    "corpus-status",
    "corpus://status",
    {
      title: "What is currently indexed",
      description:
        "Live coverage: every product with its indexed source and chunk counts, and " +
        "every hackathon on record. Read this to see what exists before asking for it.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: await renderCorpusStatus() }],
    }),
  );
}

/** Exported so the `how_to_use` tool can append it without a second round trip. */
export async function renderCorpusStatus(): Promise<string> {
  const { rows: products } = await db.execute<{
    product: string;
    name: string;
    category: string;
    sources: string;
    chunks: string;
  }>(sql`
    SELECT p.slug          AS product,
           p.name          AS name,
           p.category      AS category,
           (SELECT count(*) FROM sources sc
             WHERE sc.product_id = p.id AND sc.status = 'indexed') AS sources,
           (SELECT count(*) FROM chunks ch WHERE ch.product_id = p.id) AS chunks
    FROM products p
    ORDER BY p.name ASC
  `);

  const { rows: hackathons } = await db.execute<{
    hackathon: string;
    title: string;
    status: string;
    products: string;
  }>(sql`
    SELECT h.slug   AS hackathon,
           h.title  AS title,
           h.status AS status,
           (SELECT count(*) FROM hackathon_products hp
             WHERE hp.hackathon_id = h.id) AS products
    FROM hackathons h
    ORDER BY h.starts_at DESC NULLS LAST
  `);

  const totalChunks = products.reduce((n, p) => n + Number(p.chunks), 0);

  const productLines = products.length
    ? products
        .map(
          (p) =>
            `| \`${p.product}\` | ${p.name} | ${p.category} | ${p.sources} | ${p.chunks} |`,
        )
        .join("\n")
    : "| — | _nothing indexed yet_ | | | |";

  const hackathonLines = hackathons.length
    ? hackathons
        .map((h) => `| \`${h.hackathon}\` | ${h.title} | ${h.status} | ${h.products} |`)
        .join("\n")
    : "| — | _no hackathons on record_ | | |";

  return `# Corpus status

${products.length} product(s), ${hackathons.length} hackathon(s), ${totalChunks} searchable chunk(s).

## Products

| product | name | category | sources | chunks |
|---|---|---|---|---|
${productLines}

A product with 0 chunks is on record but not searchable — \`search_docs\` will
return nothing for it. Either nothing has been ingested yet, or the product
publishes no llms-full.txt to ingest.

## Hackathons

| hackathon | title | status | products |
|---|---|---|---|
${hackathonLines}
`;
}

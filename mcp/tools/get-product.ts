import type { McpServer } from "@modelcontextprotocol/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import * as s from "../schemas";
import { READ, iso, reply, slug, unknownSlug } from "../shared";

export function registerGetProduct(server: McpServer) {
  server.registerTool(
    "get_product",
    {
      title: "Get a product",
      description:
        "The full record for one product: what it is, its canonical links, its social " +
        "accounts, every documentation source indexed for it, and which hackathons it " +
        "appeared in.\n\n" +
        "Use this to orient — what is this thing, where does its documentation live, " +
        "is any of it actually indexed. Use search_docs to answer a specific question " +
        "about how it works.\n\n" +
        "A source with status 'failed' carries the reason in `error`; one with " +
        "`discoveryMethod: manual` indexed as a single page rather than a full " +
        "documentation set.",
      inputSchema: z.object({
        product: slug.describe("Slug from list_products, e.g. 'trueforge'"),
      }),
      outputSchema: s.productRecord,
      annotations: READ,
    },
    async ({ product }) => {
      const [row] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.slug, product))
        .limit(1);

      if (!row) return unknownSlug("product", product);

      const sources = await db
        .select({
          url: schema.sources.url,
          title: schema.sources.title,
          kind: schema.sources.kind,
          status: schema.sources.status,
          discoveryMethod: schema.sources.discoveryMethod,
          pageCount: schema.sources.pageCount,
          chunkCount: schema.sources.chunkCount,
          error: schema.sources.error,
          indexedAt: schema.sources.indexedAt,
        })
        .from(schema.sources)
        .where(eq(schema.sources.productId, row.id))
        .orderBy(asc(schema.sources.url));

      const appearances = await db
        .select({
          hackathon: schema.hackathons.slug,
          title: schema.hackathons.title,
          status: schema.hackathons.status,
          notes: schema.hackathonProducts.notes,
        })
        .from(schema.hackathonProducts)
        .innerJoin(
          schema.hackathons,
          eq(schema.hackathons.id, schema.hackathonProducts.hackathonId),
        )
        .where(eq(schema.hackathonProducts.productId, row.id))
        .orderBy(asc(schema.hackathons.title));

      const [counts] = await db
        .select({ chunks: sql<string>`count(*)` })
        .from(schema.chunks)
        .where(eq(schema.chunks.productId, row.id));

      const social = row.socials ?? {};

      return reply({
        product: row.slug,
        name: row.name,
        company: row.company,
        category: row.category,
        summary: row.summary,
        homepageUrl: row.homepageUrl,
        docsUrl: row.docsUrl,
        llmsFullUrl: row.llmsFullUrl,
        sitemapUrl: row.sitemapUrl,
        githubUrl: row.githubUrl,
        blogUrl: row.blogUrl,
        // Explicit nulls for all three: "this product has no X account" is a fact
        // worth transmitting, and an absent key would read as "not looked into".
        socials: {
          x: social.x ?? null,
          linkedin: social.linkedin ?? null,
          youtube: social.youtube ?? null,
        },
        indexed: {
          sourceCount: sources.filter((x) => x.status === "indexed").length,
          chunkCount: Number(counts?.chunks ?? 0),
        },
        sources: sources.map((x) => ({
          url: x.url,
          title: x.title,
          kind: x.kind,
          status: x.status,
          discoveryMethod: x.discoveryMethod ?? null,
          pageCount: x.pageCount ?? 0,
          chunkCount: x.chunkCount ?? 0,
          error: x.error,
          indexedAt: iso(x.indexedAt),
        })),
        appearances,
        updatedAt: iso(row.updatedAt),
      });
    },
  );
}

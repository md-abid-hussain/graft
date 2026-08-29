import type { McpServer } from "@modelcontextprotocol/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import * as s from "../schemas";
import { READ, iso, reply } from "../shared";

export function registerListHackathons(server: McpServer) {
  server.registerTool(
    "list_hackathons",
    {
      title: "List hackathons",
      description:
        "Every hackathon on record — slug, title, tagline, dates and status, without " +
        "the tracks, rules and judging that get_hackathon carries. Takes no " +
        "arguments.\n\n" +
        "**Call this before researching anything.** Researching a hackathon is slow " +
        "and expensive, and it only has to happen once; if the hackathon is already " +
        "listed here, read it with get_hackathon instead of doing the work again. " +
        "Match on the slug rather than the title — titles are thematic and vary " +
        "('Into the Scrape-Verse' is `scrape-verse`).\n\n" +
        "Status travels with each record rather than being something you filter on, " +
        "so one call shows the whole picture. Each hackathon lists its products as " +
        "slugs you can pass straight to get_product or search_docs.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        hackathons: z.array(s.hackathonSummary),
        count: z.number().int(),
      }),
      annotations: READ,
    },
    async () => {
      const rows = await db
        .select()
        .from(schema.hackathons)
        .orderBy(sql`${schema.hackathons.startsAt} DESC NULLS LAST`);

      const links = await db
        .select({
          hackathonId: schema.hackathonProducts.hackathonId,
          product: schema.products.slug,
        })
        .from(schema.hackathonProducts)
        .innerJoin(
          schema.products,
          eq(schema.products.id, schema.hackathonProducts.productId),
        );

      const byHackathon = new Map<string, string[]>();
      for (const l of links) {
        const list = byHackathon.get(l.hackathonId) ?? [];
        list.push(l.product);
        byHackathon.set(l.hackathonId, list);
      }

      const hackathons = rows.map((h) => ({
        hackathon: h.slug,
        title: h.title,
        status: h.status,
        tagline: h.tagline,
        startsAt: iso(h.startsAt),
        endsAt: iso(h.endsAt),
        timezone: h.timezone,
        mode: h.mode ?? null,
        sourceUrl: h.sourceUrl,
        products: (byHackathon.get(h.id) ?? []).sort(),
      }));

      return reply({ hackathons, count: hackathons.length });
    },
  );
}

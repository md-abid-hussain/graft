import type { McpServer } from "@modelcontextprotocol/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import * as s from "../schemas";
import { READ, iso, reply, slug, unknownSlug } from "../shared";

export function registerGetHackathon(server: McpServer) {
  server.registerTool(
    "get_hackathon",
    {
      title: "Get a hackathon",
      description:
        "The full record for one hackathon: dates, mode, every track and what it " +
        "wins, judging criteria, project ideas, best practices, rules, submission " +
        "requirements, and the products it ran on.\n\n" +
        "This is what you would otherwise get by pasting the hackathon page into " +
        "your context. Read it once here instead.\n\n" +
        "Take the slug from list_hackathons rather than guessing it from the title — " +
        "they frequently differ.",
      inputSchema: z.object({
        hackathon: slug.describe("Slug from list_hackathons, e.g. 'agents-of-signoz'"),
      }),
      outputSchema: s.hackathonRecord,
      annotations: READ,
    },
    async ({ hackathon }) => {
      const [row] = await db
        .select()
        .from(schema.hackathons)
        .where(eq(schema.hackathons.slug, hackathon))
        .limit(1);

      if (!row) return unknownSlug("hackathon", hackathon);

      const products = await db
        .select({
          product: schema.products.slug,
          name: schema.products.name,
          category: schema.products.category,
          notes: schema.hackathonProducts.notes,
        })
        .from(schema.hackathonProducts)
        .innerJoin(schema.products, eq(schema.products.id, schema.hackathonProducts.productId))
        .where(eq(schema.hackathonProducts.hackathonId, row.id))
        .orderBy(asc(schema.products.name));

      return reply({
        hackathon: row.slug,
        title: row.title,
        status: row.status,
        tagline: row.tagline,
        description: row.description,
        startsAt: iso(row.startsAt),
        endsAt: iso(row.endsAt),
        timezone: row.timezone,
        mode: row.mode ?? null,
        location: row.location,
        sourceUrl: row.sourceUrl,
        registrationUrl: row.registrationUrl,
        challenge: row.challenge,
        tracks: row.tracks,
        judging: row.judging,
        projectIdeas: row.projectIdeas,
        bestPractices: row.bestPractices,
        rules: row.rules,
        requirements: row.requirements,
        products,
        fetchedAt: iso(row.fetchedAt),
        updatedAt: iso(row.updatedAt),
      });
    },
  );
}

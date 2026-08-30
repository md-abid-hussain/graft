import "server-only";
import { cache } from "react";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { hackathonProducts, hackathons, products, sources } from "@/lib/db/schema";

/**
 * Hackathons as the site reads them.
 *
 * Sponsors come from the `hackathon_products` join rather than a column, because a
 * hackathon's sponsor *is* the product an entrant has to build on — the same row the
 * corpus serves to agents over MCP.
 */

/** Live first, then what is coming, then the archive. */
const STATUS_ORDER: Record<string, number> = { active: 0, upcoming: 1, past: 2, unknown: 3 };

export async function listHackathons() {
  const [rows, links, productRows] = await Promise.all([
    db.select().from(hackathons).orderBy(desc(hackathons.updatedAt)),
    db.select().from(hackathonProducts),
    db.select().from(products),
  ]);

  const byId = new Map(productRows.map((p) => [p.id, p]));

  return rows
    .map((h) => ({
      slug: h.slug,
      title: h.title,
      tagline: h.tagline,
      description: h.description,
      status: h.status,
      mode: h.mode,
      location: h.location,
      startsAt: h.startsAt,
      endsAt: h.endsAt,
      registrationUrl: h.registrationUrl,
      sourceUrl: h.sourceUrl,
      counts: {
        tracks: h.tracks.length,
        challenge: h.challenge.length,
        judging: h.judging.length,
        projectIdeas: h.projectIdeas.length,
        bestPractices: h.bestPractices.length,
        rules: h.rules.length,
        requirements: h.requirements.length,
      },
      sponsors: links
        .filter((l) => l.hackathonId === h.id)
        .map((l) => byId.get(l.productId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          company: p.company,
          category: p.category,
          homepageUrl: p.homepageUrl,
          docsUrl: p.docsUrl,
          githubUrl: p.githubUrl,
          socials: p.socials ?? {},
        })),
    }))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
}

export type HackathonCard = Awaited<ReturnType<typeof listHackathons>>[number];

/**
 * Resolve a hackathon by slug, falling back to the id built from that slug.
 *
 * A record can be renamed after a session referenced it — slugs moved from the
 * sponsor's name to the title, while ids stayed put — so an old session asking for
 * `cognee` should still find the row now slugged `hangover-part-ai` at `hk_cognee`.
 */
export const getHackathon = cache(async (slug: string) => {
  const [row] =
    (await db.select().from(hackathons).where(eq(hackathons.slug, slug)).limit(1)) ?? [];
  const resolved =
    row ??
    (
      await db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, `hk_${slug}`))
        .limit(1)
    )[0];
  if (!resolved) return null;

  const links = await db
    .select()
    .from(hackathonProducts)
    .where(eq(hackathonProducts.hackathonId, resolved.id));

  const productRows = links.length
    ? await db
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            links.map((l) => l.productId),
          ),
        )
    : [];

  const sourceRows = productRows.length
    ? await db
        .select()
        .from(sources)
        .where(
          inArray(
            sources.productId,
            productRows.map((p) => p.id),
          ),
        )
    : [];

  const notesByProduct = new Map(links.map((l) => [l.productId, l.notes]));

  return {
    ...resolved,
    sponsors: productRows.map((p) => ({
      ...p,
      socials: p.socials ?? {},
      notes: notesByProduct.get(p.id) ?? null,
      sources: sourceRows.filter((s) => s.productId === p.id),
    })),
  };
});

export type HackathonDetail = NonNullable<Awaited<ReturnType<typeof getHackathon>>>;

/**
 * Which sub-pages this hackathon actually has.
 *
 * Source pages vary a lot — most publish no machine-readable dates, and a hackathon
 * whose sponsor was never researched has nothing under Resources. Routing off the
 * record rather than a fixed tab list keeps the shell honest: no tab leads to an
 * empty page, and an empty sub-route 404s instead of rendering a hole.
 */
export function sectionsFor(h: HackathonDetail) {
  return {
    overview: Boolean(
      h.description || h.challenge.length || h.tracks.length || h.judging.length,
    ),
    rules: h.rules.length > 0 || h.requirements.length > 0,
    schedule: Boolean(h.startsAt || h.endsAt),
    resources:
      h.sponsors.length > 0 || h.projectIdeas.length > 0 || h.bestPractices.length > 0,
  };
}

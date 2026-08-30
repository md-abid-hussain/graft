import { z } from "zod";
import { url } from "./shared";

/**
 * The contract — one field name per column, everywhere.
 *
 * Every tool declares an `outputSchema` built from these and returns
 * `structuredContent` matching it. That is the point of serving this corpus over MCP
 * rather than as a REST API a prompt has to describe: the caller gets typed records
 * it can index into, and nobody writes per-agent output instructions.
 *
 * Two rules hold the whole surface together, and both exist so that reading a record
 * and writing it back is a no-op rather than a translation exercise:
 *
 * 1. **A column has one name.** `homepageUrl` is `homepageUrl` on the way in, on the
 *    way out, and in the database. An earlier cut of this file had that one column
 *    appearing as `homepageUrl`, `links.homepage` and `site` depending on which tool
 *    you asked, which meant an agent could not round-trip a product without a
 *    hand-written mapping table.
 * 2. **The identifier is named after its entity.** `list_products` returns
 *    `product`, and `search_docs` takes `product` — the value moves between tools
 *    without being renamed. Same for `hackathon`.
 *
 * Reads emit `null` for an empty field rather than omitting the key: "we have no
 * GitHub URL for this product" is a fact worth transmitting. Writes therefore accept
 * `null` as well as absence — see `changed()` in `shared.ts`, where omitting a field
 * leaves it alone and passing `null` clears it.
 */

/** Timestamps cross the wire as ISO 8601. */
export const isoDate = z.string().nullable();

// Every column with a TS union in `lib/db/schema.ts` gets an enum here, so the
// contract names the valid values instead of saying "string".
export const hackathonStatus = z.enum(["upcoming", "active", "past", "unknown"]);
export const eventMode = z.enum(["online", "in_person", "hybrid"]);
export const sourceKind = z.enum(["docs", "rules", "blog", "repo", "announcement"]);
export const sourceStatus = z.enum(["pending", "indexed", "failed", "stale", "skipped"]);
export const discoveryMethod = z.enum(["llms-full", "llms", "sitemap", "crawl", "manual"]);

/**
 * URL groups, declared once and projected two ways.
 *
 * The read shape wants every key present and possibly null; the write shape wants
 * keys omittable. Writing both out by hand meant nine fields declared eighteen
 * times, in two files, with nothing but a test keeping the names aligned — so the
 * names live here once and both shapes are derived.
 */
const nullableAll = <T extends Record<string, z.ZodType>>(shape: T) =>
  Object.fromEntries(
    Object.entries(shape).map(([k, v]) => [k, v.nullable()]),
  ) as { [K in keyof T]: z.ZodNullable<T[K]> };

const nullishAll = <T extends Record<string, z.ZodType>>(shape: T) =>
  Object.fromEntries(
    Object.entries(shape).map(([k, v]) => [k, v.nullish()]),
  ) as { [K in keyof T]: z.ZodOptional<z.ZodNullable<T[K]>> };

/** Canonical links, named exactly as the write tool accepts them. */
const LINKS = {
  homepageUrl: url,
  docsUrl: url,
  llmsFullUrl: url,
  sitemapUrl: url,
  githubUrl: url,
  blogUrl: url,
};

/**
 * The three platforms that carry product news. All optional, and a product may have
 * none — plenty of good tools have no X account, and recording that absence honestly
 * beats inventing a plausible handle.
 */
const SOCIALS = { x: url, linkedin: url, youtube: url };

export const productLinks = nullableAll(LINKS);
export const productLinksInput = nullishAll(LINKS);
export const socials = z.object(nullableAll(SOCIALS));
export const socialsInput = z.object(nullishAll(SOCIALS));

/**
 * How much of a product is actually searchable right now.
 *
 * `sourceCount`/`chunkCount` rather than `sources`/`chunks`: `productRecord` already
 * has a `sources` key holding the array of source records, and one object carrying
 * both a `sources` number and a `sources` array is a trap. The `Count` suffix also
 * matches `sourceSummary`, where the same quantities are `pageCount`/`chunkCount`.
 */
export const indexed = z.object({
  sourceCount: z.number().int(),
  chunkCount: z.number().int(),
});

/** One row of `list_products`. Enough to choose a product and then search it. */
export const productSummary = z.object({
  product: z.string(),
  name: z.string(),
  category: z.string(),
  homepageUrl: productLinks.homepageUrl,
  docsUrl: productLinks.docsUrl,
  indexed,
});

/**
 * One indexed document set.
 *
 * `pageCount`/`chunkCount` keep the column names rather than shortening to
 * pages/chunks: rule 1 above applies to nested records too, and `chunks` is already
 * taken by the `indexed` aggregate, where it means something else.
 *
 * `error` is surfaced because a research agent that gets `status: "failed"` back
 * needs to know whether the URL 404'd or the file parsed to nothing — otherwise its
 * only recourse is to retry the same call. `discoveryMethod` says how the file
 * actually parsed, which is how you tell a real llms-full.txt from a single page
 * that merely lives at that URL.
 *
 * Deliberately absent: `byteSize`, `fetchedAt`, `staleReason`, `contentHash`. They
 * are ingestion bookkeeping and nothing reads them.
 */
export const sourceSummary = z.object({
  url: z.string(),
  title: z.string().nullable(),
  kind: sourceKind,
  status: sourceStatus,
  discoveryMethod: discoveryMethod.nullable(),
  pageCount: z.number().int(),
  chunkCount: z.number().int(),
  error: z.string().nullable(),
  indexedAt: isoDate,
});

/**
 * A product's appearance at one hackathon, from the product's side.
 *
 * Carries the hackathon's `status` the way `hackathonProduct` carries the product's
 * `category` — each side names the other's defining attribute, so neither needs a
 * second lookup to be useful. `title` rather than `name` because that is the column:
 * hackathons have titles, products have names.
 */
export const productAppearance = z.object({
  hackathon: z.string(),
  title: z.string(),
  status: hackathonStatus,
  notes: z.string().nullable(),
});

/** The same relation from the hackathon's side. */
export const hackathonProduct = z.object({
  product: z.string(),
  name: z.string(),
  category: z.string(),
  notes: z.string().nullable(),
});

export const productRecord = z.object({
  product: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  category: z.string(),
  summary: z.string().nullable(),
  ...productLinks,
  socials,
  indexed,
  sources: z.array(sourceSummary),
  appearances: z.array(productAppearance),
  updatedAt: isoDate,
});

/** One row of `list_hackathons`. Status travels with the record, never filtered on. */
export const hackathonSummary = z.object({
  hackathon: z.string(),
  title: z.string(),
  status: hackathonStatus,
  tagline: z.string().nullable(),
  startsAt: isoDate,
  endsAt: isoDate,
  timezone: z.string().nullable(),
  mode: eventMode.nullable(),
  sourceUrl: z.string(),
  products: z.array(z.string()),
});

/**
 * The sections of a hackathon page.
 *
 * These were untyped objects once, on the theory that page layouts vary too much to
 * pin down. They do not: a hackathon page is mostly one shape repeated — a heading
 * and a paragraph — and leaving it untyped meant the research agent had to invent
 * key names, so the same fact arrived as `criterion` at one event and `title` at the
 * next and nothing downstream could read either.
 *
 * Optional fields are `.nullish()` rather than `.nullable()` on purpose. That accepts
 * both an absent key and an explicit null, so one definition serves as the input
 * schema AND the output schema and a record round-trips through save_hackathon
 * without a normalisation pass in between.
 */

/** A heading and a paragraph. Most of a hackathon page is made of these. */
export const titledItem = z.object({
  title: z.string(),
  description: z.string(),
});

/**
 * One prize category — judged tracks and open prizes alike.
 *
 * There is no separate `prizes` list. A page presents the two as different sections,
 * but they are the same record: "Best UI, an iPad, judged on X" and "Best blog post,
 * a keyboard, open to everyone" differ only in who may enter. Carrying both meant
 * every judged track was stored twice, in two different shapes.
 */
export const track = z.object({
  name: z.string(),
  prize: z.string().nullish().describe("What is won, e.g. 'NVIDIA DGX Spark'"),
  criteria: z.string().nullish().describe("What it is awarded for"),
});

/** Rules and requirements stay plain strings: they are already one sentence each. */
export const strings = z.array(z.string());

export const hackathonRecord = z.object({
  hackathon: z.string(),
  title: z.string(),
  status: hackathonStatus,
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  startsAt: isoDate,
  endsAt: isoDate,
  timezone: z.string().nullable(),
  mode: eventMode.nullable(),
  location: z.string().nullable(),
  sourceUrl: z.string(),
  registrationUrl: z.string().nullable(),

  // One per section of the page, in page order. An empty array means the page has no
  // such section; rules and requirements come last because they live on a subpage.
  challenge: z.array(titledItem),
  tracks: z.array(track),
  judging: z.array(titledItem),
  projectIdeas: z.array(titledItem),
  bestPractices: z.array(titledItem),
  rules: strings,
  requirements: strings,

  products: z.array(hackathonProduct),
  /** When the hackathon page was last read, as against when the row last changed. */
  fetchedAt: isoDate,
  updatedAt: isoDate,
});

export const searchHit = z.object({
  url: z.string(),
  docTitle: z.string().nullable(),
  headingPath: z.string().nullable(),
  kind: sourceKind,
  content: z.string(),
  score: z.number(),
  truncated: z.boolean(),
});

/**
 * Build records.
 *
 * `status` is bounded and `kind` is not, for the same reason the table is: a reader has
 * to be able to trust what `proposed` means, but nobody can enumerate in advance every
 * kind of work an agent might be asked to do.
 */
export const buildStatus = z.enum(["in_progress", "proposed", "done", "blocked", "failed"]);

export const buildTarget = z.object({
  type: z.enum(["repository", "product", "url", "other"]),
  name: z
    .string()
    .min(1)
    .describe("The identifier a reader recognises — 'owner/repo', or a product slug"),
  url: z.httpUrl().nullish(),
  note: z.string().nullish().describe("What was done to this one, in a few words"),
});

export const buildSummary = z.object({
  build: z.string(),
  title: z.string(),
  kind: z.string(),
  status: buildStatus,
  targets: z.array(buildTarget),
  summary: z.string().nullable(),
  updatedAt: isoDate,
});

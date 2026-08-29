import { z } from "zod";
import * as s from "./schemas";
import { date, slug, url } from "./shared";

/**
 * What the write tools accept.
 *
 * Separated from the tools themselves for one reason: while each tool declared its
 * input inline, nothing could compare a write against the matching read, and the two
 * drifted — `socials` existed twice, once here with URL validation and once in
 * `schemas.ts` without it. Keeping both directions in one place is what makes that
 * divergence visible.
 *
 * Optional fields are `.nullish()` throughout, never `.optional()`. Reads emit
 * `null` for an empty column, so a caller that reads a record, edits one field and
 * sends it back must be able to hand `null` straight back. The two are given
 * distinct meanings by `changed()` in `shared.ts`:
 *
 *   omitted  →  leave the stored value alone
 *   null     →  clear the stored value
 *
 * "Clear" has to mean something the column can actually hold. The page sections and
 * `status` are NOT NULL with a default, so a literal null reached Postgres as a
 * constraint violation and the agent got a raw `Failed query: insert into ...` dump
 * back. `cleared()` and `section()` below map null onto the column's own empty
 * value instead, which is what clearing a list or a status was always supposed to
 * mean.
 */

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** An array section: omit to leave it, null to empty it. */
const section = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((v) => (v === null ? [] : v));

/** A NOT NULL column with a default: null resets it rather than failing. */
const cleared = <T extends z.ZodTypeAny>(schema: T, empty: z.infer<T>) =>
  schema.nullish().transform((v: unknown) => (v === null ? empty : v));

export const hackathonInput = z.object({
  hackathon: slug.describe(
    "Identifier for this hackathon, slugified from its TITLE — not from the sponsor " +
      "and not from the page URL. 'Agents of SigNoz' is 'agents-of-signoz'. A sponsor " +
      "runs more than one event over time, so keying on their name overwrites the " +
      "earlier one; the title is what stays unique. Keep it short: drop a leading " +
      "'the', drop punctuation, and stop at the distinctive part — 'The Hangover Part " +
      "AI: Where's My Context?' is 'hangover-part-ai'. Re-saving this slug updates in place.",
  ),
  title: z.string().min(1).describe("Display title exactly as the page prints it"),
  sourceUrl: url.describe("The hackathon page this was read from"),
  tagline: z.string().nullish(),
  description: z.string().nullish(),
  startsAt: date.nullish().describe("ISO 8601 with offset"),
  endsAt: date.nullish().describe("ISO 8601 with offset — the submission deadline"),
  timezone: z
    .string()
    // Checked against Intl rather than described as IANA and hoped for: this value is
    // handed straight to a date formatter, and an unrecognised zone throws there.
    .refine(isTimeZone, "not a time zone this runtime recognises")
    .nullish()
    .describe("IANA zone the hackathon publishes its times in, e.g. 'Europe/London'"),
  status: cleared(s.hackathonStatus, "unknown"),
  mode: s.eventMode.nullish().describe("Online, in person, or both"),
  location: z.string().nullish(),
  registrationUrl: url.nullish(),

  // One per section of the page, in page order.
  challenge: section(s.titledItem).describe(
    "'The challenge' — what the problem needs, one entry per point",
  ),
  tracks: section(s.track).describe(
    "Every prize category — judged tracks AND open prizes, one list",
  ),
  judging: section(s.titledItem).describe(
    "One entry per judging criterion: title + what it asks",
  ),
  projectIdeas: section(s.titledItem).describe(
    "'Project ideas' — one entry per suggested project",
  ),
  bestPractices: section(s.titledItem).describe(
    "'How to spend the week' — one entry per piece of advice",
  ),
  rules: section(z.string()).describe("One string per rule"),
  requirements: section(z.string()).describe(
    "'What every submission needs' — one string each",
  ),
});

export const productInput = z.object({
  product: slug.describe(
    "Identifier for this product, slugified from its NAME — 'TrueForge' is " +
      "'trueforge', 'FalkorDB' is 'falkordb'. Not the vendor's URL path and not the " +
      "hackathon it sponsors. Re-saving this slug updates in place.",
  ),
  name: z.string().min(1).describe("Display name, e.g. 'TrueForge'"),
  category: z
    .string()
    .min(1)
    .describe("Free text — 'agent harness', 'observability', whatever fits"),
  company: z.string().nullish(),
  summary: z.string().nullish().describe("One or two sentences on what it does"),
  ...s.productLinksInput,
  llmsFullUrl: s.productLinksInput.llmsFullUrl.describe(
    "The llms-full.txt file — the whole docs set, not the llms.txt index",
  ),
  socials: s.socialsInput
    .nullish()
    .describe(
      "Only these three, all optional. Plenty of products have none — record the " +
        "absence rather than guessing a handle.",
    ),

  // The relation, not the product. Read back as `appearances` on get_product.
  hackathon: slug
    .nullish()
    .describe(
      "Link this product to a hackathon. Use the slug save_hackathon returned or one " +
        "from list_hackathons — never re-derive it, and never pass the product's own " +
        "slug here. An unknown slug is rejected rather than linked to nothing.",
    ),
  notes: z
    .string()
    .nullish()
    .describe("Specific to that appearance: credits, track, whether it was required"),
});

export const sourceInput = z.object({
  url: url.describe("Direct link to the llms-full.txt file — not the llms.txt link index"),
  product: slug.describe("Slug from list_products — must already be saved"),
  kind: s.sourceKind.default("docs"),
  title: z.string().nullish().describe("Overrides the title parsed from the file"),
  hackathon: slug
    .nullish()
    .describe(
      "Also attribute this source to a hackathon, by the slug from list_hackathons.",
    ),
  force: z.boolean().default(false).describe("Re-index even when the content hash is unchanged"),
});

/** Columns the write tool sets from a caller-supplied field, in `changed()` order. */
export const HACKATHON_FIELDS = [
  "tagline",
  "description",
  "timezone",
  "status",
  "mode",
  "location",
  "registrationUrl",
  "challenge",
  "tracks",
  "judging",
  "projectIdeas",
  "bestPractices",
  "rules",
  "requirements",
] as const;

export const PRODUCT_FIELDS = [
  "company",
  "summary",
  "homepageUrl",
  "docsUrl",
  "llmsFullUrl",
  "sitemapUrl",
  "githubUrl",
  "blogUrl",
] as const;

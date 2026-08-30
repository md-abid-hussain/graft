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
  status: cleared(s.hackathonStatus, "unknown").describe(
    "Where the event is in its life. The host tells you: a page served from the " +
      "archive is 'past'. Use 'unknown' only when you genuinely cannot tell.",
  ),
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

/**
 * A batch has to be bounded somewhere, and 50 is chosen against the approval gate
 * rather than against throughput: it is comfortably more than any llms-full.txt run
 * needs, and enough of a page-by-page docs set to be worth one approval.
 */
const MAX_URLS_PER_CALL = 50;

export const sourceInput = z.object({
  urls: z
    .array(url)
    .min(1)
    .max(MAX_URLS_PER_CALL)
    .describe(
      "One or more documentation URLs to index in a single call. Pass an llms-full.txt " +
        "on its own; pass many URLs when the product publishes separate markdown pages " +
        "instead. Each becomes its own source with its own content hash, so a re-run " +
        "only re-embeds what changed. Batch them — every call to this tool stops for " +
        `human approval, so fifty separate calls is fifty approvals. Max ${MAX_URLS_PER_CALL} per call.`,
    ),
  product: slug.describe("Slug from list_products — must already be saved"),
  kind: s.sourceKind
    .default("docs")
    .describe(
      "What these URLs are. Leave it as 'docs' unless they are plainly something " +
        "else. Only 'docs' is expected to answer a build question.",
    ),
  title: z
    .string()
    .nullish()
    .describe(
      "Overrides the title parsed from the file. Applies to every URL in the batch, so " +
        "leave it unset for multiple pages — each page's own first heading is used.",
    ),
  hackathon: slug
    .nullish()
    .describe("Also attribute this source to a hackathon, by the slug from list_hackathons."),
  force: z
    .boolean()
    .default(false)
    .describe("Re-index even when the content hash is unchanged"),
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

export const buildInput = z.object({
  build: slug.describe(
    "Identifier for this piece of work, slugified from what it was — " +
      "'signoz-into-graft', 'scaffold-otel-starter'. Re-saving the same slug updates " +
      "in place, which is how a run that reports progress and then reports its result " +
      "ends up as one record rather than two.",
  ),
  title: z.string().min(1).describe("One line a human would recognise it by"),
  kind: z
    .string()
    .min(1)
    .default("other")
    .describe(
      "Free text for the kind of work: 'integration', 'scaffold', 'migration', " +
        "'fix'. Describe what you did, not what tool you used.",
    ),
  // Not `cleared()`: that helper leaves `undefined` alone, which is right for a
  // hackathon field being edited in isolation but wrong here. Saving a build is
  // always a full statement of where the work stands, so an omitted status means
  // "still going" rather than "keep whatever you had".
  status: s.buildStatus
    .nullish()
    .transform((v) => v ?? "in_progress")
    .describe(
      "Where it got to. 'proposed' means you finished and something is now waiting on a " +
        "person — an open pull request, a change to review. 'done' means nothing is " +
        "owed. 'blocked' means you could not start; 'failed' means you tried and it did " +
        "not work. Say which honestly: a report claiming success that a reader then " +
        "disproves costs more than an honest failure.",
    ),
  targets: section(s.buildTarget).describe(
    "What this work was done to — a repository, a product from the index, a URL. A " +
      "list, because a scaffold touches no repository and a migration may involve two " +
      "products. Name a product by the slug list_products gives, so the record can be " +
      "found from that product later.",
  ),
  summary: z
    .string()
    .nullish()
    .describe(
      "Markdown. Your own account of the work: what you changed, what you deliberately " +
        "left alone, what a reviewer should look at first, and the documentation you " +
        "worked from. This is the part a person actually reads — write it for them, " +
        "not as a log.",
    ),
  details: z
    .record(z.string(), z.unknown())
    .nullish()
    .describe(
      "Anything structured worth keeping: a test command and whether it passed, a pull " +
        "request URL, files touched. Free-form on purpose — an integration and a " +
        "scaffold do not produce the same evidence.",
    ),
});

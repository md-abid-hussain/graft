import { sql } from "drizzle-orm";
import {
  bigserial,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";

/**
 * Schema notes
 *
 * - Metadata tables (hackathons, products, sources) exist to FILTER and CITE. Only
 *   `chunks.content` is ever embedded.
 * - Status/kind columns are `text` with a TS union via `$type<>()` rather than
 *   pgEnum. Enum changes then cost nothing at the database level, which matters when
 *   research turns up a category nobody anticipated.
 * - Run history is deliberately absent. TrueForge owns sessions and turns; a `runs`
 *   table here would be a worse copy of something the harness already persists.
 */

// Postgres has no drizzle-native tsvector type.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

export type HackathonStatus = "upcoming" | "active" | "past" | "unknown";
export type EventMode = "online" | "in_person" | "hybrid";

export type SourceKind = "docs" | "rules" | "blog" | "repo" | "announcement";
export type SourceStatus = "pending" | "indexed" | "failed" | "stale" | "skipped";
export type DiscoveryMethod = "llms-full" | "llms" | "sitemap" | "crawl" | "manual";

/**
 * Where a piece of work got to.
 *
 * Bounded, unlike `builds.kind`, because the UI chips on it and a reader has to be able
 * to tell at a glance whether anything is owed them. `proposed` is the one that matters:
 * the agent finished and something is now waiting on a person.
 */
export type BuildStatus = "in_progress" | "proposed" | "done" | "blocked" | "failed";

/**
 * What a build worked on.
 *
 * A list, because the range is genuinely wide: adding one library to one repository is
 * the common case, but a scaffold touches no repository and a migration may involve two
 * products. Modelling the common case as columns would have forced the others to lie.
 *
 * `name` is the identifier a reader recognises — `owner/repo` for a repository, the
 * product slug for a product. Nothing here is a foreign key: a build can legitimately
 * name a repository the corpus has never heard of.
 */
export interface BuildTarget {
  type: "repository" | "product" | "url" | "other";
  name: string;
  url?: string | null;
  note?: string | null;
}

/**
 * The three platforms that actually carry product news.
 *
 * All optional, and a product may have none — plenty of good tools have no X account
 * and no YouTube channel, and recording that absence honestly is more useful than
 * inventing a plausible handle.
 */
export interface ProductSocials {
  x?: string;
  linkedin?: string;
  youtube?: string;
}

/**
 * A hackathon page is mostly the same shape repeated: a heading and a paragraph.
 * The challenge framing, the project ideas, the best-practice rules and the judging
 * criteria are all that, so they share one type rather than four near-identical ones.
 */
export interface TitledItem {
  title: string;
  description: string;
}

/**
 * One prize category — judged tracks and open prizes alike.
 *
 * There is no separate `prizes` list. A hackathon page presents the two as different
 * sections, but they are the same record: "Best UI, an iPad, judged on X" and "Best
 * blog post, a keyboard, open to everyone" differ only in who can enter. Keeping both
 * meant every judged track appeared twice, in two shapes.
 */
export interface Track {
  name: string;
  // `| null` is not decoration. A caller clears a field by sending null, and the
  // write tool stores what it is given, so the column genuinely holds nulls. Typing
  // these as `string | undefined` made the column lie about its own contents.
  prize?: string | null;
  criteria?: string | null;
}

// ────────────────────────────────────────────────────────────────────────────

export const hackathons = pgTable("hackathons", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline"),
  description: text("description"),

  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: text("timezone"),
  status: text("status").$type<HackathonStatus>().notNull().default("unknown"),
  sourceUrl: text("source_url").notNull(),

  mode: text("mode").$type<EventMode>(),
  location: text("location"),
  registrationUrl: text("registration_url"),

  // Read whole, filtered on almost never — jsonb rather than child tables. Typed via
  // $type<>() so the MCP contract and the column agree without a cast at every read.
  //
  // Each maps to one section of the event page. An empty array is a real answer: it
  // means the page has no such section, as against nobody having looked yet, which is
  // what `fetchedAt` being null says.

  /** "The challenge" — what makes this problem worth an agent at all. */
  challenge: jsonb("challenge")
    .$type<TitledItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Every prize category, judged track and open prize alike. */
  tracks: jsonb("tracks")
    .$type<Track[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  judging: jsonb("judging")
    .$type<TitledItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** "Project ideas" — worked examples of jobs worth handing to an agent. */
  projectIdeas: jsonb("project_ideas")
    .$type<TitledItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** "Best practices" — how the organisers say to spend the time. */
  bestPractices: jsonb("best_practices")
    .$type<TitledItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  // Last, matching the page: rules and the submission checklist live on their own
  // subpage rather than the overview.
  rules: jsonb("rules")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** "What every submission needs" — the checklist a project is disqualified against. */
  requirements: jsonb("requirements")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A product, independent of any hackathon.
 *
 * Products deliberately carry NO hackathon reference. The same product appears across
 * events — Bright Data sponsored Scrape-Verse and hosted Zero Downtime; SigNoz had its
 * own hackathon and appears in Zero Downtime — and that persistence is the entire
 * point of the corpus. A single `hackathon_id` here would let each new appearance
 * overwrite the last. See `hackathonProducts`.
 */
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    company: text("company"),

    /** Free text. "observability", "graph database", whatever actually fits. */
    category: text("category").notNull(),
    summary: text("summary"),

    homepageUrl: text("homepage_url"),
    docsUrl: text("docs_url"),
    /**
     * llms-full.txt only — the file that concatenates the whole documentation set.
     *
     * NOT llms.txt, which is an index of links and carries no documentation body.
     * Ingesting one produces a handful of chunks that are all just link lists, which
     * retrieve confidently and answer nothing.
     */
    llmsFullUrl: text("llms_full_url"),
    sitemapUrl: text("sitemap_url"),
    githubUrl: text("github_url"),
    blogUrl: text("blog_url"),
    socials: jsonb("socials")
      .$type<ProductSocials>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.category)],
);

/**
 * Which products appeared in which hackathon.
 *
 * The relation is what makes the corpus cross-event: it answers "what did this event
 * run on" without letting a second appearance overwrite the first.
 */
export const hackathonProducts = pgTable(
  "hackathon_products",
  {
    hackathonId: text("hackathon_id")
      .notNull()
      .references(() => hackathons.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    /** Anything event-specific: credits offered, track it belongs to, caveats. */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("hackathon_products_pk").on(t.hackathonId, t.productId),
    index("hackathon_products_product_idx").on(t.productId),
  ],
);

/**
 * One fetched document set. `contentHash` drives re-ingestion: unchanged content
 * skips the whole fetch/chunk/embed cycle.
 *
 * `status = 'pending'` IS the ingestion queue. Moving from synchronous ingestion to
 * a background worker later needs no schema change.
 */
export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    hackathonId: text("hackathon_id").references(() => hackathons.id, {
      onDelete: "cascade",
    }),

    url: text("url").notNull().unique(),
    title: text("title"),
    kind: text("kind").$type<SourceKind>().notNull(),
    discoveryMethod: text("discovery_method").$type<DiscoveryMethod>(),

    contentHash: text("content_hash"),
    byteSize: integer("byte_size").default(0),
    pageCount: integer("page_count").default(0),
    chunkCount: integer("chunk_count").default(0),

    status: text("status").$type<SourceStatus>().notNull().default("pending"),
    error: text("error"),
    staleReason: text("stale_reason"),

    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sources_status_idx").on(t.status),
    index("sources_product_idx").on(t.productId),
  ],
);

/**
 * The only embedded table.
 *
 * productId/hackathonId are denormalized from `sources` on purpose: the filter then
 * runs as a cheap WHERE *before* the vector scan, so a SigNoz question never surfaces
 * Kestra docs.
 *
 * vector(1536), not the model's native 3072 — pgvector's HNSW index caps at 2000
 * dimensions. Pass `dimensions: 1536` to text-embedding-3-large.
 */
export const chunks = pgTable(
  "chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),

    productId: text("product_id"),
    hackathonId: text("hackathon_id"),
    kind: text("kind").$type<SourceKind>().notNull(),

    url: text("url").notNull(),
    docTitle: text("doc_title"),
    headingPath: text("heading_path"),
    ord: integer("ord").notNull(),

    // Includes the prepended context header — "Product › Section › Subsection" plus
    // the doc title — so an isolated paragraph is still findable.
    content: text("content").notNull(),
    tokenCount: integer("token_count"),

    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('english', content)`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chunks_product_idx").on(t.productId),
    index("chunks_hackathon_idx").on(t.hackathonId),
    index("chunks_kind_idx").on(t.kind),
    index("chunks_tsv_idx").using("gin", t.tsv),
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/**
 * A piece of work an agent did, as it reported it.
 *
 * The other tables describe things Graft read. This one describes something it *did* —
 * and unlike research, where the output is a hackathon or a product and the shape is
 * known, build work varies from "add one library" to "scaffold a project". So the
 * contract is deliberately thin: what kind of work, what it was done to, where it got
 * to, and the agent's own account of it in prose.
 *
 * `kind` is free text on the same reasoning as `products.category` — the useful values
 * are not knowable in advance, and an enum here would either be wrong or be a dumping
 * ground of `other`. `status` is bounded because the UI depends on it meaning something.
 *
 * `summary` is markdown on purpose. It is the one field where prose IS the content: a
 * reviewer wants the narrative, the diff rationale and the caveats, and flattening that
 * into columns would lose exactly what makes it worth reading.
 */
export const builds = pgTable(
  "builds",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),

    /** Free text: "integration", "scaffold", "migration", whatever fits. */
    kind: text("kind").notNull().default("other"),
    status: text("status").$type<BuildStatus>().notNull().default("in_progress"),

    targets: jsonb("targets")
      .$type<BuildTarget[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    /** Markdown. The agent's account of what it did and what it left alone. */
    summary: text("summary"),

    /**
     * Anything else that run produced — a test command and its output, a pull request
     * URL, files touched. Free-form because an integration and a scaffold do not
     * produce the same evidence, and a column per possibility would be mostly null.
     */
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("builds_status_idx").on(t.status),
    index("builds_kind_idx").on(t.kind),
    // GIN over the targets array, so "which builds touched signoz" is an index lookup
    // rather than a scan — `targets @> '[{"type":"product","name":"signoz"}]'`.
    index("builds_targets_idx").using("gin", t.targets),
  ],
);

export type Hackathon = typeof hackathons.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Build = typeof builds.$inferSelect;

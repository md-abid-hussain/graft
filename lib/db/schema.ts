import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";

/**
 * Schema notes
 *
 * - Metadata tables (hackathons, products, sources, findings) exist to FILTER and
 *   CITE. Only `chunks.content` is ever embedded.
 * - Status/kind/role columns are `text` with a TS union via `$type<>()` rather than
 *   pgEnum. Enum changes then cost nothing at the database level, which matters when
 *   the agent turns out to need a category nobody anticipated.
 */

// Postgres has no drizzle-native tsvector type.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

export type HackathonStatus = "upcoming" | "active" | "past" | "unknown";
export type ProductRole = "main_sponsor" | "model_partner" | "community";
export type IngestPolicy = "full" | "metadata_only" | "skip";
export type SourceKind =
  | "docs" | "rules" | "blog" | "repo" | "video" | "submission" | "announcement";
export type SourceStatus = "pending" | "indexed" | "failed" | "stale" | "skipped";
export type DiscoveryMethod = "llms-full" | "llms" | "sitemap" | "crawl" | "manual";
export type FindingKind = "repo" | "blog" | "video" | "submission" | "docs" | "social";
export type FindingVerdict =
  | "canonical" | "relevant" | "winner" | "low-relevance" | "reference-only" | "failed";
export type RunPhase =
  | "research" | "inspect" | "provision" | "implement" | "verify" | "approval" | "deliver";
export type StepStatus = "ok" | "recovered" | "waiting" | "failed";

// ────────────────────────────────────────────────────────────────────────────

export const hackathons = pgTable("hackathons", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  host: text("host").default("WeMakeDevs"),

  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: text("timezone"),
  status: text("status").$type<HackathonStatus>().notNull().default("unknown"),
  sourceUrl: text("source_url").notNull(),

  // Read whole, filtered on almost never — jsonb rather than child tables.
  prizes: jsonb("prizes").notNull().default(sql`'[]'::jsonb`),
  tracks: jsonb("tracks").notNull().default(sql`'[]'::jsonb`),
  rules: jsonb("rules").notNull().default(sql`'[]'::jsonb`),
  judging: jsonb("judging").notNull().default(sql`'[]'::jsonb`),
  requirements: jsonb("requirements").notNull().default(sql`'[]'::jsonb`),

  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `role` + `ingestPolicy` are the corpus budget control. A model partner's docs can
 * be 100x a main sponsor's — OpenAI's llms-full.txt is 6.4MB / 1,520 sections against
 * TrueForge's 265KB / 76. Policy is derived from role at write time so an agent
 * cannot accidentally swamp the corpus with a product nobody is building on.
 */
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    company: text("company"),
    category: text("category").notNull(),
    summary: text("summary"),

    hackathonId: text("hackathon_id").references(() => hackathons.id, { onDelete: "set null" }),
    role: text("role").$type<ProductRole>().notNull().default("main_sponsor"),
    isRequired: boolean("is_required").notNull().default(false),
    ingestPolicy: text("ingest_policy").$type<IngestPolicy>().notNull().default("full"),

    homepageUrl: text("homepage_url"),
    docsUrl: text("docs_url"),
    llmsTxtUrl: text("llms_txt_url"),
    sitemapUrl: text("sitemap_url"),
    githubUrl: text("github_url"),
    blogUrl: text("blog_url"),
    socials: jsonb("socials").notNull().default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_hackathon_idx").on(t.hackathonId),
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
    hackathonId: text("hackathon_id").references(() => hackathons.id, { onDelete: "cascade" }),

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
 * What the agent discovered AND judged.
 *
 * `evidence` is the differentiator — judgement, not retrieval. The verification
 * columns are what make "verified" true rather than asserted: record_finding
 * HEAD-checks the URL before writing, so a plausible-but-wrong link is marked
 * rather than silently trusted.
 */
export const findings = pgTable(
  "findings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    hackathonId: text("hackathon_id").references(() => hackathons.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),

    kind: text("kind").$type<FindingKind>().notNull(),
    title: text("title"),
    url: text("url").notNull(),
    relevance: real("relevance"),
    verdict: text("verdict").$type<FindingVerdict>(),
    evidence: text("evidence"),

    foundBy: text("found_by"),
    sourcePage: text("source_page"),
    verified: boolean("verified").notNull().default(false),
    httpStatus: integer("http_status"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    ingested: boolean("ingested").notNull().default(false),
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("findings_url_uniq").on(t.hackathonId, t.url),
    index("findings_hackathon_idx").on(t.hackathonId),
    index("findings_relevance_idx").on(t.relevance),
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

// ── Run history ─────────────────────────────────────────────────────────────
// Written by the record_step MCP tool. Context compaction is lossy in the agent's
// working memory; this table is what survives, and it feeds the UI timeline.

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  kind: text("kind").$type<"research" | "integration">().notNull(),
  agentName: text("agent_name").notNull(),
  input: jsonb("input").notNull().default(sql`'{}'::jsonb`),
  status: text("status")
    .$type<"running" | "awaiting_approval" | "done" | "failed">()
    .notNull()
    .default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const runSteps = pgTable(
  "run_steps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: text("session_id").notNull(),
    seq: integer("seq").notNull(),
    phase: text("phase").$type<RunPhase>().notNull(),
    label: text("label").notNull(),
    status: text("status").$type<StepStatus>().notNull(),
    detail: text("detail"),
    citations: jsonb("citations").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("run_steps_seq_uniq").on(t.sessionId, t.seq),
    index("run_steps_session_idx").on(t.sessionId, t.seq),
  ],
);

export type Hackathon = typeof hackathons.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;

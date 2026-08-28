import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/connection";
import type { DiscoveryMethod, SourceKind } from "../db/schema";
import {
  chunkMarkdown,
  hasManyH1s,
  looksLikeLlmsFull,
  parseByH1,
  parseLlmsFull,
  type Chunk,
} from "./chunk";
import { embed } from "./embed";

/**
 * Fetch → hash → chunk → embed → store.
 *
 * Deterministic code, deliberately. The agent's job is DISCOVERY — deciding which
 * docs site is canonical, which blog is worth keeping. Parsing and embedding is a
 * script, which keeps it cheap, reproducible, and out of the agent's context window.
 */

export interface IngestOptions {
  url: string;
  kind: SourceKind;
  productId?: string;
  hackathonId?: string;
  productName?: string;
  title?: string;
  discoveryMethod?: DiscoveryMethod;
  /** Re-index even when the content hash is unchanged. */
  force?: boolean;
  onProgress?: (message: string) => void;
}

export interface IngestResult {
  sourceId: string;
  method: DiscoveryMethod;
  pageCount: number;
  chunkCount: number;
  byteSize: number;
  skipped: boolean;
  /** Why it was skipped, when it was. */
  reason?: "unchanged" | "ingest_policy";
  tookMs: number;
}

const sourceIdFor = (url: string) =>
  `src_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;

const hashOf = (text: string) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** Postgres caps parameters per statement; chunk rows are wide, so insert in slices. */
const INSERT_BATCH = 200;

export async function ingestSource(opts: IngestOptions): Promise<IngestResult> {
  const started = Date.now();
  const log = opts.onProgress ?? (() => {});
  const sourceId = sourceIdFor(opts.url);

  /**
   * Corpus budget guard, enforced here rather than at the call site so the MCP tool
   * and the CLI are both covered — an agent calling `ingest_source` must not be able
   * to pull in a model partner's 6MB documentation set.
   *
   * Only `full` ingests document chunks. `metadata_only` keeps the product record and
   * its links but indexes nothing; `skip` does neither.
   */
  if (opts.productId) {
    const [product] = await db
      .select({ policy: schema.products.ingestPolicy, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, opts.productId))
      .limit(1);

    if (product && product.policy !== "full") {
      log(`ingest_policy=${product.policy} for ${product.name} — not indexing documents`);
      return {
        sourceId,
        method: opts.discoveryMethod ?? "manual",
        pageCount: 0,
        chunkCount: 0,
        byteSize: 0,
        skipped: true,
        reason: "ingest_policy",
        tookMs: Date.now() - started,
      };
    }
  }

  log(`fetching ${opts.url}`);
  const res = await fetch(opts.url, {
    headers: { "user-agent": "WeHelpAgents/0.1 (+https://github.com/md-abid-hussain/we-help-agents)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    await markFailed(sourceId, opts, `HTTP ${res.status}`);
    throw new Error(`fetch failed: HTTP ${res.status} for ${opts.url}`);
  }

  const text = await res.text();
  const byteSize = Buffer.byteLength(text, "utf8");
  const contentHash = hashOf(text);

  // Unchanged content skips the entire chunk/embed cycle — this is what makes
  // re-running Scout on a known hackathon nearly free.
  const [existing] = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.id, sourceId))
    .limit(1);

  if (!opts.force && existing?.contentHash === contentHash && existing.status === "indexed") {
    log("content unchanged, skipping");
    return {
      sourceId,
      method: (existing.discoveryMethod ?? "manual") as DiscoveryMethod,
      pageCount: existing.pageCount ?? 0,
      chunkCount: existing.chunkCount ?? 0,
      byteSize,
      skipped: true,
      reason: "unchanged",
      tookMs: Date.now() - started,
    };
  }

  // Three shapes in the wild:
  //   1. Mintlify-style — "# Title" + "Source: url" pairs (TrueForge, Cognee, Bright Data)
  //   2. Concatenated docs with no Source: lines (Zerops, Kestra) — split on H1
  //   3. A single page
  const documents = looksLikeLlmsFull(text)
    ? parseLlmsFull(text)
    : hasManyH1s(text)
      ? parseByH1(text, opts.url)
      : [{ title: opts.title ?? opts.url, url: opts.url, body: text }];

  const method: DiscoveryMethod =
    opts.discoveryMethod ?? (documents.length > 1 ? "llms-full" : "manual");

  log(`parsed ${documents.length} document(s) via ${method}`);

  const rows: Array<Chunk & { url: string; docTitle: string }> = [];
  for (const doc of documents) {
    const pieces = chunkMarkdown({
      markdown: doc.body,
      docTitle: doc.title,
      productName: opts.productName,
    });
    for (const piece of pieces) {
      rows.push({ ...piece, url: doc.url ?? opts.url, docTitle: doc.title });
    }
  }

  log(`chunked into ${rows.length} pieces`);
  if (rows.length === 0) {
    await markFailed(sourceId, opts, "no content after chunking");
    throw new Error(`nothing to index from ${opts.url}`);
  }

  await db
    .insert(schema.sources)
    .values({
      id: sourceId,
      productId: opts.productId ?? null,
      hackathonId: opts.hackathonId ?? null,
      url: opts.url,
      title: opts.title ?? documents[0]?.title ?? null,
      kind: opts.kind,
      discoveryMethod: method,
      contentHash,
      byteSize,
      pageCount: documents.length,
      status: "pending",
      error: null,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.sources.id,
      set: {
        contentHash,
        byteSize,
        pageCount: documents.length,
        discoveryMethod: method,
        status: "pending",
        error: null,
        fetchedAt: new Date(),
      },
    });

  const vectors = await embed(
    rows.map((r) => r.content),
    (done, total) => log(`embedded ${done}/${total}`),
  );

  // Replace rather than append: re-ingesting a changed document must not leave the
  // old chunks behind to be retrieved alongside the new ones.
  await db.delete(schema.chunks).where(eq(schema.chunks.sourceId, sourceId));

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const slice = rows.slice(i, i + INSERT_BATCH);
    await db.insert(schema.chunks).values(
      slice.map((row, j) => ({
        sourceId,
        productId: opts.productId ?? null,
        hackathonId: opts.hackathonId ?? null,
        kind: opts.kind,
        url: row.url,
        docTitle: row.docTitle,
        headingPath: row.headingPath,
        ord: row.ord,
        content: row.content,
        tokenCount: row.tokenCount,
        embedding: vectors[i + j]!,
      })),
    );
    log(`inserted ${Math.min(i + INSERT_BATCH, rows.length)}/${rows.length}`);
  }

  await db
    .update(schema.sources)
    .set({
      status: "indexed",
      chunkCount: rows.length,
      indexedAt: new Date(),
      error: null,
    })
    .where(eq(schema.sources.id, sourceId));

  return {
    sourceId,
    method,
    pageCount: documents.length,
    chunkCount: rows.length,
    byteSize,
    skipped: false,
    tookMs: Date.now() - started,
  };
}

async function markFailed(sourceId: string, opts: IngestOptions, error: string) {
  await db
    .insert(schema.sources)
    .values({
      id: sourceId,
      productId: opts.productId ?? null,
      hackathonId: opts.hackathonId ?? null,
      url: opts.url,
      title: opts.title ?? null,
      kind: opts.kind,
      status: "failed",
      error,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.sources.id,
      set: { status: "failed", error, fetchedAt: new Date() },
    });
}

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/connection";
import type { DiscoveryMethod, SourceKind } from "../db/schema";
import {
  chunkMarkdown,
  hasManyH1s,
  looksLikeLlmsFull,
  nextFence,
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
  reason?: "unchanged";
  tookMs: number;
}

const sourceIdFor = (url: string) =>
  `src_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;

const hashOf = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** Postgres caps parameters per statement; chunk rows are wide, so insert in slices. */
const INSERT_BATCH = 200;

/**
 * Ceiling on a single fetched document set.
 *
 * 32MB is generous — the largest llms-full.txt seen in practice is OpenAI's at
 * 5.4MB, against TrueForge's 265KB — and the point is not to be tight. It is that
 * without a limit there is none: `res.text()` buffers whatever arrives, then every
 * chunk of it goes to the embedding API. That is memory and money spent before
 * anything notices, and a timeout does not bound either, because a fast server
 * sending gigabytes never trips it.
 *
 * Not a security control. An authorised caller with a genuinely huge URL hits this
 * exactly as an unauthorised one would, which is the case that actually matters:
 * the agent cannot know a file's size before fetching it, but the server can.
 */
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

/**
 * Read the body, refusing anything past the ceiling.
 *
 * `content-length` is checked first because it costs nothing when honest, but it is
 * advisory — absent on chunked responses and trivially wrong on a hostile one — so
 * the stream is counted as it arrives regardless.
 */
async function readCapped(
  res: Response,
  url: string,
  sourceId: string,
  opts: IngestOptions,
  log: (message: string) => void,
): Promise<string> {
  const refuse = async (bytes: string) => {
    const reason = `source exceeds ${MAX_SOURCE_BYTES} bytes (${bytes})`;
    await markFailed(sourceId, opts, reason);
    throw new Error(`${reason} for ${url}`);
  };

  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_SOURCE_BYTES) {
    await refuse(`content-length ${declared}`);
  }

  if (!res.body) return res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await res.body.cancel().catch(() => {});
      await refuse(`stopped at ${total}`);
    }
    chunks.push(chunk);
  }

  log(`fetched ${total} bytes`);
  return Buffer.concat(chunks).toString("utf8");
}

export async function ingestSource(opts: IngestOptions): Promise<IngestResult> {
  const started = Date.now();
  const log = opts.onProgress ?? (() => {});
  const sourceId = sourceIdFor(opts.url);

  log(`fetching ${opts.url}`);

  // A rejected fetch — DNS, connection refused, the 60s timeout — used to escape
  // before anything was recorded, so a batch could report a URL as failed while the
  // corpus held no trace of it. An HTTP error a line below left a row; a dead host
  // left nothing, which is the same outcome for the operator and a different one for
  // the database.
  let res: Response;
  try {
    res = await fetch(opts.url, {
      headers: { "user-agent": "Graft/0.1 (+https://github.com/md-abid-hussain/graft)" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(sourceId, opts, `fetch failed: ${message}`);
    throw new Error(`fetch failed for ${opts.url}: ${message}`);
  }

  if (!res.ok) {
    await markFailed(sourceId, opts, `HTTP ${res.status}`);
    throw new Error(`fetch failed: HTTP ${res.status} for ${opts.url}`);
  }

  const text = await readCapped(res, opts.url, sourceId, opts, log);

  // Nothing downstream can tell markup from prose. `chunkMarkdown` would happily slice
  // a page of <div>s into chunks and embed them, producing exactly the failure this
  // project refuses for llms.txt: entries that match a query confidently and answer
  // nothing. Worse since ingestion went batched — one URL missing its `.md` across a
  // fifty-page walk would poison the set silently.
  const html = htmlReason(text);
  if (html) {
    await markFailed(sourceId, opts, html);
    throw new Error(`${opts.url} ${html}`);
  }

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
    // Content is unchanged, but the CALLER's metadata may not be. A source first
    // ingested manually with no product, then re-ingested by Scout with productId and
    // hackathonId, must pick up that association — otherwise it stays unattributed and
    // its chunks are unreachable behind a product filter forever.
    const metadataChanged =
      (opts.productId ?? null) !== existing.productId ||
      (opts.hackathonId ?? null) !== existing.hackathonId ||
      opts.kind !== existing.kind;

    if (metadataChanged) {
      log("content unchanged, but metadata differs — correcting");
      await db.transaction(async (tx) => {
        await tx
          .update(schema.sources)
          .set({
            productId: opts.productId ?? null,
            hackathonId: opts.hackathonId ?? null,
            kind: opts.kind,
            title: opts.title ?? existing.title,
          })
          .where(eq(schema.sources.id, sourceId));
        // chunks carry denormalised copies for pre-filtering; they must agree.
        await tx
          .update(schema.chunks)
          .set({
            productId: opts.productId ?? null,
            hackathonId: opts.hackathonId ?? null,
            kind: opts.kind,
          })
          .where(eq(schema.chunks.sourceId, sourceId));
      });
    } else {
      log("content unchanged, skipping");
    }

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
      : // A single page carries its title in its own first heading. Falling back to
        // the URL made `docTitle` a URL on every chunk, so a batch of markdown pages
        // cited fifty identical-looking links instead of fifty page names.
        [
          {
            title: opts.title ?? titleFromMarkdown(text) ?? opts.url,
            url: opts.url,
            body: text,
          },
        ];

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
        // Metadata is refreshed too, not just content. The chunks written below carry
        // denormalised copies of productId/hackathonId/kind, so if the source row kept
        // stale values the two would disagree and filtered retrieval would go wrong.
        productId: opts.productId ?? null,
        hackathonId: opts.hackathonId ?? null,
        kind: opts.kind,
        title: opts.title ?? documents[0]?.title ?? null,
        contentHash,
        byteSize,
        pageCount: documents.length,
        discoveryMethod: method,
        status: "pending",
        error: null,
        fetchedAt: new Date(),
      },
    });

  // Everything from here is wrapped: `sources.status` IS the ingestion queue, so an
  // uncaught embedding or insert failure would leave a row stuck on 'pending' forever
  // and quietly corrupt the queue's meaning.
  try {
    const vectors = await embed(
      rows.map((r) => r.content),
      (done, total) => log(`embedded ${done}/${total}`),
    );

    // Delete-then-insert in ONE transaction. Previously a failure partway through the
    // insert batches left the corpus with some chunks deleted and not replaced — worse
    // than not re-ingesting, because retrieval silently returns less than it should.
    await db.transaction(async (tx) => {
      await tx.delete(schema.chunks).where(eq(schema.chunks.sourceId, sourceId));

      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const slice = rows.slice(i, i + INSERT_BATCH);
        await tx.insert(schema.chunks).values(
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

      await tx
        .update(schema.sources)
        .set({
          status: "indexed",
          chunkCount: rows.length,
          indexedAt: new Date(),
          error: null,
        })
        .where(eq(schema.sources.id, sourceId));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(sourceId, opts, `embed/index failed: ${message}`);
    throw error;
  }

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

/**
 * Is this markup rather than prose?
 *
 * Decided from the body alone. `content-type` is not consulted, because it is wrong
 * too often in the direction that matters: plenty of sites serve perfectly good
 * markdown as `text/html`, and refusing on the header would reject exactly the
 * page-by-page docs this pipeline exists to index.
 *
 * The test looks for whole-page markers — a doctype, `<html>`, `<head>`, `<body>`, an
 * XML prolog — anywhere in the opening, rather than for a tag at position zero. That
 * distinction is the point: markdown legitimately opens with a `<div>`, a `<span>` or
 * an inline `<img>`, and none of those appear in a document that also declares itself
 * a whole HTML page.
 *
 * The message names the fix, because the caller is an agent that can act on it: nearly
 * every docs site serving HTML at a path serves markdown at a neighbouring one.
 */
function htmlReason(text: string): string | null {
  const head = text.slice(0, 2048).toLowerCase();
  const isWholePage = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<\?xml[\s?]/.test(
    head,
  );
  if (!isWholePage) return null;

  return (
    "returned HTML, not markdown — this pipeline indexes markdown only, and " +
    "chunking markup produces entries that match queries and answer nothing. Most " +
    "docs sites serve a markdown twin: try appending `.md` to the page URL, or " +
    "request it with `Accept: text/markdown`, or use the product's llms-full.txt."
  );
}

/** The first real H1, ignoring anything inside a fence. */
function titleFromMarkdown(text: string): string | null {
  let fence: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const wasInFence = fence !== null;
    fence = nextFence(line, fence);
    if (wasInFence || fence !== null) continue;
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    if (h1) return h1[1]!;
  }
  return null;
}

/**
 * Ingest many URLs as one unit of work.
 *
 * This exists because of the approval gate, not because of throughput. Every write to
 * the corpus pauses for a human, so a product that publishes fifty separate markdown
 * pages instead of one llms-full.txt cost fifty approvals — which is not a slow
 * workflow, it is an unusable one. One call, one gate, fifty pages.
 *
 * Each URL still becomes its own source row with its own content hash, so re-runs stay
 * cheap per page and a page that changes does not force its neighbours to re-embed.
 *
 * One failure does not abort the rest: a docs set with two dead links should index the
 * other forty-eight and say which two failed.
 */
export interface BatchIngestResult {
  results: Array<{
    url: string;
    status: "indexed" | "skipped" | "failed";
    pageCount: number;
    chunkCount: number;
    reason: string | null;
  }>;
  indexed: number;
  skipped: number;
  failed: number;
  chunkCount: number;
  tookMs: number;
}

/** Fetch and embedding are both network-bound; a handful at a time is plenty, and
 *  keeps concurrent embedding calls well under any sane rate limit. */
const INGEST_CONCURRENCY = 3;

export async function ingestSources(
  urls: string[],
  base: Omit<IngestOptions, "url">,
): Promise<BatchIngestResult> {
  const started = Date.now();

  // Deduplicated first: the source id is derived from the URL, so the same URL twice
  // in one batch would have two workers writing the same row and deleting each
  // other's chunks mid-transaction.
  const unique = [...new Set(urls)];
  const results: BatchIngestResult["results"] = new Array(unique.length);

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(INGEST_CONCURRENCY, unique.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= unique.length) return;
        const url = unique[i]!;
        try {
          const r = await ingestSource({ ...base, url });
          results[i] = {
            url,
            status: r.skipped ? "skipped" : "indexed",
            pageCount: r.pageCount,
            chunkCount: r.chunkCount,
            reason: r.reason ?? null,
          };
        } catch (error) {
          results[i] = {
            url,
            status: "failed",
            pageCount: 0,
            chunkCount: 0,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }),
  );

  return {
    results,
    indexed: results.filter((r) => r.status === "indexed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    chunkCount: results.reduce((n, r) => n + r.chunkCount, 0),
    tookMs: Date.now() - started,
  };
}

/**
 * Record that a source could not be ingested.
 *
 * A source that is already `indexed` is never downgraded. Its chunks are still in the
 * table and still answering queries, so a transient 404 or a DNS blip on a re-run must
 * not leave the product reading "failed" while retrieval works perfectly. The error is
 * still recorded — that is the useful half — but the status keeps describing the
 * chunks, which is what it is for.
 *
 * This matters more now that ingestion is batched: one flaky host in a fifty-URL
 * re-run would otherwise mark a working source broken.
 */
async function markFailed(sourceId: string, opts: IngestOptions, error: string) {
  const [existing] = await db
    .select({ status: schema.sources.status })
    .from(schema.sources)
    .where(eq(schema.sources.id, sourceId))
    .limit(1);

  if (existing?.status === "indexed") {
    await db
      .update(schema.sources)
      .set({ error, fetchedAt: new Date() })
      .where(eq(schema.sources.id, sourceId));
    return;
  }

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

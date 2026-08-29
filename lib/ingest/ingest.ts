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
  reason?: "unchanged";
  tookMs: number;
}

const sourceIdFor = (url: string) =>
  `src_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;

const hashOf = (text: string) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;

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
  const res = await fetch(opts.url, {
    headers: { "user-agent": "Graft/0.1 (+https://github.com/md-abid-hussain/we-help-agents)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    await markFailed(sourceId, opts, `HTTP ${res.status}`);
    throw new Error(`fetch failed: HTTP ${res.status} for ${opts.url}`);
  }

  const text = await readCapped(res, opts.url, sourceId, opts, log);
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

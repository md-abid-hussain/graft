import "dotenv/config";
import OpenAI from "openai";

/**
 * Embeddings.
 *
 * `dimensions: 1536` rather than text-embedding-3-large's native 3072 — pgvector's
 * HNSW index caps at 2000, so the full width would leave every query on an exact
 * scan. The v3 models support native dimension reduction with negligible quality
 * loss, and `chunks.embedding` is declared vector(1536) to match.
 */

const MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";

/**
 * Fixed at 1536, and validated rather than merely defaulted.
 *
 * `chunks.embedding` is declared `vector(1536)` and a Postgres vector column has a
 * fixed width, so any other value produces embeddings that fail on insert — after
 * paying for the whole embedding run. A non-numeric env value would previously reach
 * the API as NaN. Neither failure explains itself, so refuse at startup instead.
 *
 * Changing this means a migration and re-embedding the entire corpus; it is not a knob.
 */
export const EMBEDDING_DIMENSIONS = 1536;

if (
  process.env.EMBEDDING_DIMENSIONS &&
  Number(process.env.EMBEDDING_DIMENSIONS) !== EMBEDDING_DIMENSIONS
) {
  throw new Error(
    `EMBEDDING_DIMENSIONS is ${process.env.EMBEDDING_DIMENSIONS}, but chunks.embedding is ` +
      `vector(${EMBEDDING_DIMENSIONS}). Changing it requires a migration and a full ` +
      `re-embed — remove the override or change the column first.`,
  );
}

/** Conservative batch limits — the API caps on total tokens, not just input count. */
const MAX_BATCH_ITEMS = 96;
const MAX_BATCH_CHARS = 400_000;

/**
 * Per-input ceiling. The chunker already hard-splits oversized blocks, so this is a
 * backstop for anything reaching the API by another path. Truncating one chunk beats
 * failing an entire ingestion run on a deterministic 400.
 */
const MAX_INPUT_CHARS = 24_000; // ~6k tokens at chars/4

let client: OpenAI | undefined;
function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — copy .env.example to .env");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function batch(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let chars = 0;

  for (const text of texts) {
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_ITEMS || chars + text.length > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }

  if (current.length) batches.push(current);
  return batches;
}

async function embedBatch(texts: string[], attempt = 1): Promise<number[][]> {
  try {
    const res = await openai().embeddings.create({
      model: MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      input: texts,
    });
    // The API does not guarantee order, so sort by index before returning.
    return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (error) {
    if (attempt >= 4) throw error;
    const wait = 2 ** attempt * 500;
    console.warn(`  embedding batch failed (attempt ${attempt}), retrying in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    return embedBatch(texts, attempt + 1);
  }
}

export async function embed(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const safe = texts.map((t) => {
    if (t.length <= MAX_INPUT_CHARS) return t;
    console.warn(
      `  truncating a ${t.length}-char input to ${MAX_INPUT_CHARS} — the chunker should ` +
        `have split this; check hardSplit()`,
    );
    return t.slice(0, MAX_INPUT_CHARS);
  });

  const out: number[][] = [];
  for (const group of batch(safe)) {
    out.push(...(await embedBatch(group)));
    onProgress?.(out.length, texts.length);
  }

  if (out.length !== texts.length) {
    throw new Error(`embedding count mismatch: got ${out.length}, expected ${texts.length}`);
  }
  return out;
}

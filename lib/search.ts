import { sql } from "drizzle-orm";
import { db } from "./db/connection";
import { embed } from "./ingest/embed";
import type { SourceKind } from "./db/schema";

/**
 * Hybrid retrieval over the chunk corpus.
 *
 * Neither half is sufficient alone. Pure vector search misses exact identifiers —
 * ask for `OTEL_EXPORTER_OTLP_ENDPOINT` and cosine similarity happily returns three
 * paragraphs about observability in general. Pure keyword search misses paraphrases
 * entirely: "how do I stop it before it does something bad" never matches a page
 * titled "Approval gates". So: run both, fuse the rankings.
 *
 * Reciprocal Rank Fusion (`Σ 1/(k + rank)`, k = 60) rather than blending the raw
 * scores, because cosine distance and `ts_rank_cd` are not on comparable scales and
 * any weighting between them would be a magic number tuned to one query.
 */

/** RRF damping. 60 is the value from the original Cormack et al. paper. */
const RRF_K = 60;

/** Per-arm candidate pool. Fused, then cut to the caller's limit. */
const POOL = 30;

/**
 * Per-chunk character ceiling in a response.
 *
 * The harness offloads tool results over roughly 6k tokens to a sandbox file, which
 * for a retrieval tool is precisely the opposite of useful — the agent asked for
 * context, not a file path. Ten results at this width lands comfortably under that.
 */
const MAX_CONTENT_CHARS = 1200;

export interface SearchHit {
  url: string;
  docTitle: string | null;
  headingPath: string | null;
  kind: SourceKind;
  content: string;
  score: number;
  truncated: boolean;
}

export interface SearchDocsOptions {
  query: string;
  /** Required. Retrieval is always scoped to one product — see `list_products`. */
  product: string;
  limit?: number;
}

/**
 * A type alias, not an interface. `db.execute<T>` constrains T to
 * `Record<string, unknown>`, and only aliases get the implicit index signature that
 * satisfies it — an interface with identical members does not.
 */
type Row = {
  url: string;
  doc_title: string | null;
  heading_path: string | null;
  kind: SourceKind;
  content: string;
  score: string | number;
}

export async function searchDocs({
  query,
  product,
  limit = 10,
}: SearchDocsOptions): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [vector] = await embed([trimmed]);
  // pgvector's text input format. Parameterised as a string, then cast.
  const literal = `[${vector.join(",")}]`;

  /**
   * One statement, two CTEs, a FULL OUTER JOIN.
   *
   * Every column reference is alias-qualified. An unqualified `id` inside a CTE that
   * also joins `chunks` binds to whichever table Postgres resolves first, and the
   * failure mode is a silent wrong answer rather than an error.
   */
  const { rows } = await db.execute<Row>(sql`
    WITH vec AS (
      SELECT c.id AS id,
             row_number() OVER (ORDER BY c.embedding <=> ${literal}::vector) AS rank
      FROM chunks c
      WHERE c.product_id = ${product}
      ORDER BY c.embedding <=> ${literal}::vector
      LIMIT ${POOL}
    ),
    kw AS (
      SELECT c.id AS id,
             row_number() OVER (ORDER BY ts_rank_cd(c.tsv, q.query) DESC) AS rank
      FROM chunks c, plainto_tsquery('english', ${trimmed}) AS q(query)
      WHERE c.product_id = ${product} AND c.tsv @@ q.query
      ORDER BY ts_rank_cd(c.tsv, q.query) DESC
      LIMIT ${POOL}
    ),
    fused AS (
      SELECT COALESCE(vec.id, kw.id) AS id,
             COALESCE(1.0 / (${RRF_K} + vec.rank), 0)
           + COALESCE(1.0 / (${RRF_K} + kw.rank), 0) AS score
      FROM vec FULL OUTER JOIN kw ON vec.id = kw.id
    )
    SELECT c.url          AS url,
           c.doc_title    AS doc_title,
           c.heading_path AS heading_path,
           c.kind         AS kind,
           c.content      AS content,
           fused.score    AS score
    FROM fused
    JOIN chunks c ON c.id = fused.id
    ORDER BY fused.score DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => {
    const truncated = r.content.length > MAX_CONTENT_CHARS;
    return {
      url: r.url,
      docTitle: r.doc_title,
      headingPath: r.heading_path,
      kind: r.kind,
      content: truncated ? `${r.content.slice(0, MAX_CONTENT_CHARS)}…` : r.content,
      score: Number(r.score),
      truncated,
    };
  });
}

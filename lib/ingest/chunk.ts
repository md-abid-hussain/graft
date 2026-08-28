/**
 * Markdown chunking for the corpus.
 *
 * Two rules drive the design:
 *
 * 1. Never split inside a fenced code block. Half a code sample is worse than none —
 *    it retrieves well and then misleads.
 * 2. Every chunk carries a context header before it is embedded. A paragraph reading
 *    "then set the endpoint in your config" is meaningless as an isolated vector;
 *    prefixed with "SigNoz › Instrumentation › Node.js" it is findable. This is the
 *    single biggest quality lever in a small corpus and it costs nothing.
 */

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Rough token estimate. A real tokenizer is not worth the dependency at this size. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export interface ChunkInput {
  markdown: string;
  /** Title of the document these chunks come from. */
  docTitle: string;
  /** Display name of the product, e.g. "SigNoz". Leads the context header. */
  productName?: string;
  /** Target size per chunk, in estimated tokens. */
  targetTokens?: number;
  /** Overlap carried between adjacent chunks of the same section. */
  overlapTokens?: number;
}

export interface Chunk {
  /** Embedded text: context header + body. */
  content: string;
  /** Body without the header, kept for display. */
  body: string;
  headingPath: string;
  ord: number;
  tokenCount: number;
}

interface Section {
  headingPath: string[];
  lines: string[];
}

/** Split into sections at headings, tracking the heading stack and ignoring fences. */
function toSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];
  let fence: string | null = null;
  let current: Section = { headingPath: [], lines: [] };

  const flush = () => {
    if (current.lines.some((l) => l.trim())) sections.push(current);
  };

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence && line.trimStart().startsWith(fence)) fence = null;
      else if (!fence) fence = marker;
      current.lines.push(line);
      continue;
    }

    if (!fence) {
      const heading = line.match(HEADING);
      if (heading) {
        flush();
        const depth = heading[1]!.length;
        stack.length = Math.min(stack.length, depth - 1);
        stack[depth - 1] = heading[2]!;
        current = { headingPath: stack.slice(0, depth).filter(Boolean), lines: [] };
        continue;
      }
    }

    current.lines.push(line);
  }

  flush();
  return sections;
}

/** Group a section's lines into paragraph-ish blocks, keeping fenced blocks whole. */
function toBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let buf: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) blocks.push(text);
    buf = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence && line.trimStart().startsWith(fence)) {
        buf.push(line);
        fence = null;
        flush(); // a code block ends its own block
        continue;
      }
      if (!fence) {
        flush(); // a code block starts a fresh one
        fence = marker;
      }
      buf.push(line);
      continue;
    }

    if (!fence && line.trim() === "") {
      flush();
      continue;
    }

    buf.push(line);
  }

  flush();
  return blocks;
}

export function chunkMarkdown(input: ChunkInput): Chunk[] {
  const {
    markdown,
    docTitle,
    productName,
    targetTokens = 800,
    overlapTokens = 100,
  } = input;

  const chunks: Chunk[] = [];
  let ord = 0;

  for (const section of toSections(markdown)) {
    const trail = [productName, ...section.headingPath].filter(Boolean);
    const headingPath = section.headingPath.join(" › ");
    const header = `${trail.join(" › ")}\n${docTitle}\n\n`;
    const headerTokens = estimateTokens(header);
    const budget = Math.max(targetTokens - headerTokens, 200);

    const blocks = toBlocks(section.lines);
    let buf: string[] = [];
    let bufTokens = 0;

    const emit = () => {
      const body = buf.join("\n\n").trim();
      if (!body) return;
      const content = header + body;
      chunks.push({
        content,
        body,
        headingPath,
        ord: ord++,
        tokenCount: estimateTokens(content),
      });
    };

    for (const block of blocks) {
      const blockTokens = estimateTokens(block);

      // A single oversized block — usually a long code sample. Emit it alone rather
      // than cutting it in half.
      if (blockTokens > budget) {
        emit();
        buf = [];
        bufTokens = 0;
        chunks.push({
          content: header + block,
          body: block,
          headingPath,
          ord: ord++,
          tokenCount: estimateTokens(header + block),
        });
        continue;
      }

      if (bufTokens + blockTokens > budget && buf.length) {
        emit();
        // Carry the tail of the previous chunk so a fact split across the boundary is
        // still retrievable from either side.
        const carried: string[] = [];
        let carriedTokens = 0;
        for (let i = buf.length - 1; i >= 0; i--) {
          const t = estimateTokens(buf[i]!);
          if (carriedTokens + t > overlapTokens) break;
          carried.unshift(buf[i]!);
          carriedTokens += t;
        }
        buf = carried;
        bufTokens = carriedTokens;
      }

      buf.push(block);
      bufTokens += blockTokens;
    }

    emit();
  }

  return chunks;
}

/**
 * llms-full.txt is a concatenation of documents, each introduced by an H1 followed by
 * a `Source:` line. Splitting on that pair gives real document boundaries — and the
 * canonical URL and title per document for free — before any chunking happens.
 */
export interface LlmsFullDoc {
  title: string;
  url: string | null;
  body: string;
}

export function parseLlmsFull(text: string): LlmsFullDoc[] {
  const lines = text.split(/\r?\n/);
  const docs: LlmsFullDoc[] = [];
  let current: LlmsFullDoc | null = null;
  let buf: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (current) docs.push({ ...current, body: buf.join("\n").trim() });
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence && line.trimStart().startsWith(fence)) fence = null;
      else if (!fence) fence = marker;
      if (current) buf.push(line);
      continue;
    }

    if (!fence) {
      const h1 = line.match(/^#\s+(.+?)\s*$/);
      if (h1) {
        // Only treat it as a document boundary when a Source: line follows within a
        // couple of lines; otherwise it is just an H1 inside a document.
        const lookahead = lines.slice(i + 1, i + 4).join("\n");
        const source = lookahead.match(/^\s*Source:\s*(\S+)\s*$/m);
        if (source) {
          flush();
          current = { title: h1[1]!, url: source[1]!, body: "" };
          continue;
        }
      }
      if (current && /^\s*Source:\s*\S+\s*$/.test(line) && buf.length === 0) {
        continue; // swallow the Source: line itself
      }
    }

    if (current) buf.push(line);
  }

  flush();
  return docs;
}

/** Heuristic: does this look like an llms-full.txt rather than a single page? */
export function looksLikeLlmsFull(text: string): boolean {
  return (text.match(/^Source:\s*https?:\/\/\S+$/gm) ?? []).length >= 2;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/**
 * Fallback for llms-full files that concatenate documents without `Source:` lines —
 * Zerops and Kestra both do this, with 600+ H1s and no per-document URLs.
 *
 * Splitting on H1 recovers real document boundaries and titles. The canonical URL is
 * genuinely unavailable, so each document cites the llms-full file with a slug anchor.
 * Imperfect, but every chunk citing the same 3MB file would make citations worthless,
 * and citations are the whole grounding story.
 */
export function parseByH1(text: string, baseUrl: string): LlmsFullDoc[] {
  const lines = text.split(/\r?\n/);
  const docs: LlmsFullDoc[] = [];
  let title: string | null = null;
  let buf: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    const body = buf.join("\n").trim();
    if (title && body) {
      docs.push({ title, url: `${baseUrl}#${slugify(title)}`, body });
    }
    buf = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence && line.trimStart().startsWith(fence)) fence = null;
      else if (!fence) fence = marker;
      buf.push(line);
      continue;
    }

    if (!fence) {
      const h1 = line.match(/^#\s+(.+?)\s*$/);
      if (h1) {
        flush();
        title = h1[1]!;
        continue;
      }
    }

    buf.push(line);
  }

  flush();
  return docs;
}

/** Enough top-level headings that H1 splitting produces meaningful documents. */
export function hasManyH1s(text: string): boolean {
  return (text.match(/^#\s+\S/gm) ?? []).length >= 5;
}

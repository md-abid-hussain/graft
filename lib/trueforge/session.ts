import "server-only";

/**
 * What a research session actually produced.
 *
 * The chat on the left and the corpus on the right are joined here. TrueForge stores
 * every tool call a session made, so rather than tracking writes ourselves — a second
 * source of truth that could drift from the database — the session's own event log is
 * read back and the write calls are picked out of it.
 *
 * Deferred tool loading wraps MCP calls: the agent calls the harness's `call_tool`
 * with the real target nested in `{ mcp_server, tool_name, input }`, so the slug lives
 * one level down rather than in the arguments directly.
 */

const BASE = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";

/** The harness rejects anything above 100 outright, so this is the ceiling. */
const EVENT_LIMIT = 100;

/** Newest-first, and writes land late in a run — a few pages covers any real session. */
const MAX_PAGES = 3;

interface WireToolCall {
  function?: { name?: string; arguments?: string };
}

interface WireEvent {
  type: string;
  tool_calls?: WireToolCall[];
}

export interface SessionSubject {
  /** Slug of the hackathon this session saved, if it got that far. */
  hackathon: string | null;
  /** Slugs of any products it saved. */
  products: string[];
}

export async function subjectOf(sessionId: string): Promise<SessionSubject> {
  let hackathon: string | null = null;
  const products = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(EVENT_LIMIT) });
    if (pageToken) query.set("page_token", pageToken);

    let body: {
      data?: { event?: WireEvent }[];
      pagination?: { next_page_token?: string };
    };
    try {
      const res = await fetch(
        `${BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/events?${query}`,
        { cache: "no-store" },
      );
      if (!res.ok) break;
      body = (await res.json()) as typeof body;
    } catch {
      break;
    }

    scan(body.data ?? []);

    pageToken = body.pagination?.next_page_token;
    // The hackathon is written before its products, so once it is found everything
    // after it on the newest-first stream has already been seen.
    if (!pageToken || hackathon) break;
  }

  return { hackathon, products: [...products] };

  function scan(items: { event?: WireEvent }[]) {
    for (const item of items) {
      for (const call of item.event?.tool_calls ?? []) {
        const raw = call.function?.arguments;
        if (!raw || !raw.includes("save_")) continue;

        let parsed: { tool_name?: string; input?: Record<string, unknown> };
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          continue;
        }

        // `get_tool_info` names the same tool but carries no input — skip those.
        const value = parsed.input;
        if (!value) continue;

        if (parsed.tool_name === "save_hackathon" && typeof value.hackathon === "string") {
          // Newest-first, so the first one seen is the latest and wins.
          hackathon ??= value.hackathon;
        }
        if (parsed.tool_name === "save_product" && typeof value.product === "string") {
          products.add(value.product);
        }
      }
    }
  }
}

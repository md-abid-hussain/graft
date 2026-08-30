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

/**
 * Research stops the moment it finds its hackathon, and a hackathon is written early in
 * a run, so this is a cost ceiling on a scan that has almost always already finished.
 */
const MAX_PAGES = 3;

/**
 * A build has no early marker to stop on.
 *
 * It is published at the END of the work, so on a newest-first stream it is usually
 * seen first — but "usually" is not a correctness argument. Every turn the user takes
 * after the publish pushes that `save_build` further down, and a scan that gives up at
 * a fixed depth reports "nothing published yet" for a record that plainly exists.
 *
 * So the build scan runs until it finds the build or the events run out. This number is
 * a runaway guard — a session cannot hold a request open forever — and deliberately far
 * above any depth that should ever be reached. It is not a claim that ten thousand
 * events is enough, which is exactly the claim three pages was making.
 */
const MAX_PAGES_FOR_BUILD = 100;

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
  /** Slug of the build this session published, for a run that did work rather than research. */
  build: string | null;
}

/**
 * `forBuild` only changes how deep the scan is willing to go. Both panels read the same
 * subject; the build panel is the one that pays for depth, so it is the one that asks.
 */
export async function subjectOf(
  sessionId: string,
  { forBuild = false }: { forBuild?: boolean } = {},
): Promise<SessionSubject> {
  let hackathon: string | null = null;
  let build: string | null = null;
  const products = new Set<string>();
  let pageToken: string | undefined;

  const maxPages = forBuild ? MAX_PAGES_FOR_BUILD : MAX_PAGES;

  for (let page = 0; page < maxPages; page++) {
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
    if (!pageToken) break;

    // Stop on what THIS call came for, not on whatever turned up first. A research
    // scan that stopped because it saw a build would abandon the hackathon it was
    // actually asked for — the two panels read the same subject but are not looking
    // for the same thing.
    if (forBuild ? build : hackathon) break;
  }

  return { hackathon, products: [...products], build };

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
        if (parsed.tool_name === "save_build" && typeof value.build === "string") {
          // A run may save the same slug twice — in progress, then final. Newest-first,
          // so the first seen is the later one and wins.
          build ??= value.build;
        }
      }
    }
  }
}

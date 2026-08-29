import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * Same-origin proxy to TrueForge, for `@truefoundry/trueforge-ui`.
 *
 * The UI SDK runs in the browser and talks to the harness itself. TrueForge sends no
 * `access-control-*` headers and answers `OPTIONS` with 404, so a direct cross-origin
 * call from the app is impossible — this gives the SDK a same-origin `baseUrl`, and
 * keeps the harness address (and any future token) on the server.
 *
 * Turn streams come back as `text/event-stream`. The body is piped through untouched
 * rather than buffered, because reading it to completion would hold every event until
 * the turn ended and the chat would sit empty for minutes.
 */

const BASE = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";

/** Hop-by-hop headers, plus the ones the runtime must recompute for the new request. */
const STRIP_REQUEST = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "accept-encoding",
]);

const STRIP_RESPONSE = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

/**
 * Agent name → registry id.
 *
 * `@truefoundry/trueforge-ui` 0.2.4 forwards the configured agent *name* as
 * `agent_id` when it lists sessions, but the harness filters on the registry id and
 * returns nothing for a name — so the thread list is permanently empty in SingleAgent
 * mode. Rewriting it here fixes every caller at once.
 *
 * The registry decides which one a value is, not its shape. Ids are ULIDs, but a
 * 26-character name is a legal name, and testing the shape would silently classify it
 * as an id — no rewrite, and an empty thread list with nothing to explain it. Both
 * directions are cached so an id costs a lookup rather than a fetch.
 */
const idByName = new Map<string, string>();
const knownIds = new Set<string>();

/** The one operation that needs the rewrite; every other path is forwarded untouched. */
const SESSION_LIST_PATH = "api/v1/sessions";

/** A miss refreshes at most this often, so unknown values cannot amplify into fetches. */
const REFRESH_AFTER_MS = 10_000;

let attemptedAt = 0;
let inFlight: Promise<void> | null = null;

async function loadAgents(): Promise<void> {
  if (Date.now() - attemptedAt < REFRESH_AFTER_MS) return;
  // Concurrent misses share one request rather than each starting their own.
  if (inFlight) return inFlight;

  // Stamped before the fetch, not after: a failure has to back off too, or an
  // unreachable harness turns every proxied request into a retry.
  attemptedAt = Date.now();

  inFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/agents`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { id: string; name: string }[] };
      idByName.clear();
      knownIds.clear();
      for (const a of body.data ?? []) {
        idByName.set(a.name, a.id);
        knownIds.add(a.id);
      }
    } catch {
      // Leave the value alone; the harness can answer for itself.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** The registry id when `value` names an agent, otherwise undefined. */
async function agentIdFor(value: string): Promise<string | undefined> {
  if (idByName.has(value)) return idByName.get(value);
  if (knownIds.has(value)) return undefined;
  await loadAgents();
  return idByName.get(value);
}

async function proxy(request: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const url = new URL(request.url);

  // Scoped to the session list: that is the only call the SDK mis-addresses, and
  // leaving every other path alone keeps arbitrary requests from reaching the registry.
  if (request.method === "GET" && path.join("/") === SESSION_LIST_PATH) {
    const agent = url.searchParams.get("agent_id");
    if (agent) {
      const id = await agentIdFor(agent);
      if (id) url.searchParams.set("agent_id", id);
    }
  }

  const search = url.search;
  const target = `${BASE}/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by undici whenever a stream is used as the body.
      ...(hasBody ? { duplex: "half" } : {}),
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch (error) {
    // The address and the network error stay in the server log. Echoing them would
    // hand the harness's location to the browser, which is what this proxy exists to
    // avoid — and the operator reading the terminal is who needs the detail anyway.
    console.error(`[api/tf] ${request.method} ${path.join("/")} failed:`, error);
    return NextResponse.json(
      { error: { message: "Could not reach the agent harness." } },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) out.set(key, value);
  });
  // Proxies and compression middleware buffer SSE by default, which stalls the chat
  // until the turn ends.
  out.set("cache-control", "no-cache, no-transform");
  out.set("x-accel-buffering", "no");

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx.params);
}
export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx.params);
}
export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx.params);
}
export async function PATCH(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx.params);
}
export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx.params);
}

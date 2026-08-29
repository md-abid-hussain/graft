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
 * Agent name → registry id, resolved once.
 *
 * `@truefoundry/trueforge-ui` 0.2.4 forwards the configured agent *name* as
 * `agent_id` when it lists sessions, but the harness filters on the registry id and
 * returns nothing for a name — so the thread list is permanently empty in SingleAgent
 * mode. Rewriting it here fixes every caller at once.
 */
const agentIds = new Map<string, string>();

async function resolveAgentId(name: string): Promise<string | undefined> {
  const cached = agentIds.get(name);
  if (cached) return cached;
  try {
    const res = await fetch(`${BASE}/api/v1/agents`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { data?: { id: string; name: string }[] };
    for (const a of body.data ?? []) agentIds.set(a.name, a.id);
  } catch {
    return undefined;
  }
  return agentIds.get(name);
}

async function proxy(request: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  const url = new URL(request.url);

  // Ids are ULIDs; anything else in `agent_id` is a name the harness cannot match.
  const agent = url.searchParams.get("agent_id");
  if (agent && !/^[0-9a-z]{26}$/i.test(agent)) {
    const id = await resolveAgentId(agent);
    if (id) url.searchParams.set("agent_id", id);
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
    return NextResponse.json(
      {
        error: {
          message: `Could not reach TrueForge at ${BASE}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        },
      },
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

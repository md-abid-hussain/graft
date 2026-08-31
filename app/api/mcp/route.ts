import { NextResponse } from "next/server";
import { withMcpAuth } from "mcp-handler";
import { allowsAnonymous, isAuthConfigured, verifyToken } from "@/mcp/auth";
import { handler } from "@/mcp/server";

/**
 * The MCP endpoint: POST /api/mcp
 *
 * `nodejs` rather than edge — the pg driver and the OpenAI SDK both need Node APIs.
 *
 * Serving is stateless, so GET and DELETE (the 2025-era session operations) answer
 * 405 by design. They are still exported so the route exists and the 405 comes from
 * the MCP handler with a protocol-shaped body, rather than from Next as an HTML
 * 404 that tells a connecting client nothing.
 */
export const runtime = "nodejs";

/** Ingestion fetches, chunks and embeds inline; reads are milliseconds. */
export const maxDuration = 300;

/**
 * Authentication wraps the whole server, not the write tools.
 *
 * Gating `save_*` and `ingest_source` individually was the alternative, and it is the
 * wrong shape twice over: the read tools are not public either — the corpus is the
 * product — and a per-tool list is a thing to forget when the eleventh tool lands.
 * One wrapper at the route covers whatever `registerTools` grows into.
 *
 * Everything here resolves per request. `next build` runs with NODE_ENV=production and
 * imports this module to collect page data, so a module-scope check on a deployment
 * secret would fail the build on a machine that has no business holding one.
 */
let authed: ((request: Request) => Promise<Response>) | null = null;

function authenticated(): (request: Request) => Promise<Response> {
  // `required` is false in exactly one case — no token configured, not production —
  // which is what leaves an existing local setup working untouched.
  //
  // `resourceMetadataPath` is left at its default so the 401 challenge points at
  // /.well-known/oauth-protected-resource, which is served from this app.
  authed ??= withMcpAuth(handler, verifyToken, { required: !allowsAnonymous() });
  return authed;
}

/**
 * Fail closed when a production deployment never set the token.
 *
 * 503, not "serve anonymously". This endpoint creates rows and triggers paid
 * ingestion, so a missing credential has to stop it rather than quietly downgrade it
 * to open. Answering here also names the variable, instead of leaving an operator to
 * discover the gap from a bill.
 */
async function route(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production" && !isAuthConfigured()) {
    console.error("[api/mcp] refusing to serve: MCP_BEARER_TOKEN is not set");
    return NextResponse.json(
      {
        error: {
          message:
            "This MCP server is not configured for authenticated access. Set " +
            "MCP_BEARER_TOKEN on the server and re-run `pnpm connectors:sync` so the " +
            "harness sends it.",
        },
      },
      { status: 503 },
    );
  }

  return authenticated()(request);
}

export { route as GET, route as POST, route as DELETE };

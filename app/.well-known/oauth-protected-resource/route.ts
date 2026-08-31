import { NextResponse } from "next/server";
import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 Protected Resource Metadata — RFC 9728.
 *
 * `withMcpAuth` puts `resource_metadata="<origin>/.well-known/oauth-protected-resource"`
 * into every 401 challenge, because the MCP authorization spec has clients discover a
 * server's authorization servers from exactly this document. The route exists so that
 * pointer resolves to an answer rather than to a Next 404 page.
 *
 * The honest part:
 *
 * This deployment authenticates with a shared bearer token, not OAuth. There is one
 * caller — the harness — and no resource owner to delegate on behalf of. So there is
 * no authorization server to advertise, and RFC 9728 requires `authorization_servers`
 * to name at least one.
 *
 * Publishing a plausible-looking issuer anyway (TrueForge's Auth0, say) would be
 * actively worse than publishing nothing: a spec-compliant client would read it, run
 * the whole OAuth 2.1 flow against a server that knows nothing about this resource,
 * come back with a token, and get a 401 — having been told, by us, that it should
 * work. A 404 says "no OAuth here" in one round trip.
 *
 * So the document is served only once an authorization server actually exists. Set
 * `MCP_AUTH_SERVER_URL` to its issuer URL — the same string as `issuer` in that
 * server's RFC 8414 metadata — and this begins answering with real metadata, with no
 * other change to the route or to `withMcpAuth`.
 */
const AUTH_SERVER_URL = process.env.MCP_AUTH_SERVER_URL;

export async function GET(request: Request): Promise<Response> {
  if (!AUTH_SERVER_URL) {
    return NextResponse.json(
      {
        error: "no_authorization_server",
        error_description:
          "This MCP server authenticates with a shared bearer token rather than " +
          "OAuth, so it has no authorization server to advertise. Send " +
          "`Authorization: Bearer <MCP_BEARER_TOKEN>`. If OAuth is later added, set " +
          "MCP_AUTH_SERVER_URL and this endpoint will serve RFC 9728 metadata.",
      },
      { status: 404 },
    );
  }

  return protectedResourceHandler({ authServerUrls: [AUTH_SERVER_URL] })(request);
}

/** Metadata endpoints are read cross-origin by MCP clients, so CORS preflight matters. */
export const OPTIONS = metadataCorsOptionsRequestHandler();

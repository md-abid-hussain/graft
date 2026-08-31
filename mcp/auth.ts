import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";

/**
 * Who may call `POST /api/mcp`.
 *
 * The endpoint registers `save_hackathon`, `save_product`, `save_build` and
 * `ingest_source`. Those create rows and spend money on embeddings, so "whoever can
 * open a socket" is not an access policy. Proven rather than assumed: an
 * unauthenticated `tools/call` against the write path returns a *schema* error, not a
 * 401 — the handler runs, and `tools/list` hands out the field names it wants.
 *
 * TrueForge's approval gate does not cover this. That gate interrupts the *agent*
 * mid-turn; it is not a control on the port. Anything that can reach the address skips
 * it — another container on the Docker network, an agent sandbox, or the internet once
 * a public subdomain exists.
 *
 * ── Why a shared secret and not OAuth ──────────────────────────────────────────
 *
 * The MCP authorization spec makes auth OPTIONAL, and layers OAuth 2.1 on top when a
 * server wants delegated, per-user access. This server has exactly one caller — the
 * harness — and no user identity to delegate. A static bearer is the honest size for
 * that, and `McpServerManifest.auth.headers` is how TrueForge carries it.
 *
 * What the spec does still require is the failure shape: OAuth 2.1 §5.3 / RFC 6750 say
 * an invalid or absent token gets `401` with a `WWW-Authenticate` challenge, and
 * `withMcpAuth` emits exactly that. See `app/.well-known/oauth-protected-resource/`
 * for the part that stays unimplemented on purpose.
 */

const ENV_VAR = "MCP_BEARER_TOKEN";

/**
 * Constant-time compare over equal-length buffers.
 *
 * `timingSafeEqual` throws when the lengths differ, so the guard is not optional. The
 * length itself still leaks, which for a random 32-byte secret tells an attacker
 * nothing they could not guess from the documentation.
 */
function tokensMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const isAuthConfigured = (): boolean => Boolean(process.env[ENV_VAR]);

/**
 * May an unauthenticated request be served?
 *
 * Only when no token is configured AND this is not production. That is what keeps an
 * existing `pnpm dev` working untouched: a developer who has not set the variable —
 * and a TrueForge connector already registered without a credential — behave exactly
 * as before. Setting the variable is what opts in.
 *
 * Reads `NODE_ENV` rather than a bespoke flag precisely because `next build` sets it
 * to production, so the closed branch turns on by itself rather than by remembering.
 */
export const allowsAnonymous = (): boolean =>
  !isAuthConfigured() && process.env.NODE_ENV !== "production";

/**
 * Verify the presented bearer.
 *
 * Returns `undefined` on every failure so `withMcpAuth` answers 401 with the
 * challenge; throwing here would surface as a 500 and tell the caller nothing.
 */
export function verifyToken(_req: Request, bearer?: string): AuthInfo | undefined {
  const expected = process.env[ENV_VAR];

  // Unreachable in practice: with no token configured, `required` is false in
  // development and the route refuses to serve at all in production.
  if (!expected) return undefined;

  if (!bearer || !tokensMatch(bearer, expected)) return undefined;

  return {
    token: bearer,
    // One credential, one caller. Inventing a per-client identity here would imply a
    // distinction the server does not actually enforce.
    clientId: "graft-mcp-client",
    scopes: [],
  };
}

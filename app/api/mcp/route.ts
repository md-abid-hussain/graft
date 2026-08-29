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

export { handler as GET, handler as POST, handler as DELETE };

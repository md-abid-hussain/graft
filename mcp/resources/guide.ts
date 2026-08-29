import type { McpServer } from "@modelcontextprotocol/server";
import { GUIDE } from "../content";

/**
 * `guide://usage` — the manual, as a resource.
 *
 * The same text is also reachable as the `how_to_use` tool, for clients that never
 * look at resources. See `mcp/content.ts`.
 */
export function registerGuide(server: McpServer) {
  server.registerResource(
    "usage-guide",
    "guide://usage",
    {
      title: "How to use this server",
      description:
        "Full walkthrough: what each tool does, how to phrase a search, the order " +
        "research writes happen in, and how to find an llms-full.txt.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: GUIDE }],
    }),
  );
}

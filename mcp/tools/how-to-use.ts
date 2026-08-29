import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { GUIDE } from "../content";
import { renderCorpusStatus } from "../resources/status";
import { READ, reply } from "../shared";

/**
 * The guide, as a tool.
 *
 * It is already served as the `guide://usage` resource, which is where the spec says
 * it belongs. But plenty of MCP clients only ever read `tools/list` — they never call
 * `resources/list`, so a resource-only guide is invisible to them and the server
 * looks like eight tools with no explanation. Exposing it as a tool too costs one
 * slot and makes the server self-documenting everywhere.
 *
 * It answers with the live corpus state appended, because "how do I use this" and
 * "what is actually in it" are the same question on a first call, and two tool calls
 * to learn that is one too many.
 */
export function registerHowToUse(server: McpServer) {
  server.registerTool(
    "how_to_use",
    {
      title: "How to use this server",
      description:
        "What this server is, how to use it, and what is currently in it. Takes no " +
        "arguments.\n\n" +
        "Call it first if you have not used this server before, or when a call did " +
        "not do what you expected. It covers how to phrase a search so hybrid " +
        "retrieval works, the order research writes have to happen in, how to tell an " +
        "llms-full.txt from an llms.txt, and what the omit-versus-null distinction " +
        "means on a write. It ends with the live list of indexed products and " +
        "hackathons.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        guide: z.string().describe("Markdown"),
        status: z.string().describe("Markdown — what is indexed right now"),
      }),
      annotations: READ,
    },
    async () => reply({ guide: GUIDE, status: await renderCorpusStatus() }),
  );
}

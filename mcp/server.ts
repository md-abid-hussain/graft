import { createMcpHandler } from "mcp-handler";
import { INSTRUCTIONS } from "./instructions";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

/**
 * The one server.
 *
 * An earlier design split reads and writes across two endpoints on the theory that
 * a research agent and a coding agent are different consumers. They are not: the
 * research agent reads its own output constantly — to check whether a hackathon is
 * already on record before spending an hour re-researching it — so the read tools
 * belong to both sides. One endpoint, one contract, one thing to register.
 *
 * Note the signature: `mcp-handler`'s `createMcpHandler` takes a callback that
 * MUTATES a server it hands you and returns a directly-callable
 * `(Request) => Promise<Response>`. The SDK exports a same-named function with a
 * different contract — a factory that RETURNS a server, wrapped in an object with a
 * `.fetch` method. They are not interchangeable.
 */
export const SERVER_NAME = "wehelpagents-mcp";
export const SERVER_VERSION = "0.1.0";

export const handler = createMcpHandler(
  (server) => {
    registerTools(server);
    registerResources(server);
  },
  {
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    instructions: INSTRUCTIONS,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

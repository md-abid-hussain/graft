import type { McpServer } from "@modelcontextprotocol/server";
import { registerGuide } from "./guide";
import { registerStatus } from "./status";

/**
 * Two resources, doing different jobs.
 *
 * `guide://usage` is the manual — static prose an agent reads once when the server
 * instructions were not enough. `corpus://status` is live, and answers "what is
 * actually in here right now" without spending a tool call.
 */
export function registerResources(server: McpServer) {
  registerGuide(server);
  registerStatus(server);
}

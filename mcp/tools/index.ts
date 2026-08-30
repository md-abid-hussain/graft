import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetHackathon } from "./get-hackathon";
import { registerHowToUse } from "./how-to-use";
import { registerGetProduct } from "./get-product";
import { registerIngestSource } from "./ingest-source";
import { registerListHackathons } from "./list-hackathons";
import { registerListProducts } from "./list-products";
import { registerSaveHackathon } from "./save-hackathon";
import { registerSaveBuild } from "./save-build";
import { registerSaveProduct } from "./save-product";
import { registerSearchDocs } from "./search-docs";

/**
 * One file per tool, registered here.
 *
 * Registration order is the order they appear in `tools/list`, and models weight
 * that: the tools listed first are the ones reached for first. So they are listed in
 * the order a caller actually needs them — orient, then read, then write — rather
 * than alphabetically or grouped by permission.
 */
export function registerTools(server: McpServer) {
  // First, because it explains everything below it — and because many clients never
  // read `resources/list`, so this is the only guide they will see.
  registerHowToUse(server);

  // Reads. `list_*` first: they take no arguments and hand out the slugs
  // everything else requires.
  registerListProducts(server);
  registerGetProduct(server);
  registerSearchDocs(server);
  registerListHackathons(server);
  registerGetHackathon(server);

  // Writes, in the order a research run performs them.
  registerSaveHackathon(server);
  registerSaveProduct(server);
  registerIngestSource(server);

  // Last, because it is the only write that records what an agent DID rather than
  // what it read — a different job from the three above it, and reached at the end
  // of a run rather than during one.
  registerSaveBuild(server);
}

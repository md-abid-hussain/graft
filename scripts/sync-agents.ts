import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { basename } from "node:path";

/**
 * Registers the agent specs in `trueforge/agents/` with TrueForge.
 *
 * The specs were already version-controlled and nothing applied them, so keeping the
 * harness in step with the repository meant copying JSON into a browser — the drift
 * that directory exists to prevent.
 *
 * This is the list/resolve/branch dance `sync-skills.ts` gets to skip. Skills are
 * create-or-replace by name on one endpoint; agents are not symmetrical:
 * `POST /api/v1/agents` answers 409 on a duplicate name and `PUT /api/v1/agents/{id}`
 * needs an id, so the name has to be resolved to an id first. One list call covers
 * every file.
 *
 * The other trap is the request shape — the spec goes inside a `manifest` field rather
 * than being the body:
 *
 *   POST /api/v1/agents       { name, manifest }
 *   PUT  /api/v1/agents/{id}  { manifest }
 *
 * `name` is immutable once created, which is why the update sends the manifest alone
 * and why renaming a spec file creates a second agent rather than moving the first.
 *
 * Connectors are not registered here. `mcp_servers[].name` must already exist under
 * Settings → Connectors, credentials and all — see `sync-connectors.ts`.
 */
const baseUrl = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";
const agentDir = new URL("../trueforge/agents/", import.meta.url);

/**
 * A hosted TrueForge runs OIDC; a local one stamps a default user and needs nothing.
 * Send the ID token when there is one, so the same script targets either.
 */
const headers: Record<string, string> = {
  "content-type": "application/json",
  ...(process.env.TRUEFORGE_TOKEN
    ? { Authorization: `Bearer ${process.env.TRUEFORGE_TOKEN}` }
    : {}),
};

/** `--dry-run` prints what would be sent and writes nothing. */
const dryRun = process.argv.includes("--dry-run");

const names = (await readdir(agentDir))
  .filter((f) => f.endsWith(".json"))
  .map((f) => basename(f, ".json"))
  .sort();

/** `<name>.json` + `<name>.md` recombined — instructions live beside the spec. */
async function manifestFor(name: string) {
  const spec = JSON.parse(await readFile(new URL(`${name}.json`, agentDir), "utf8"));

  // Optional: an agent that needs no system prompt is still loadable.
  let instructions: string | undefined;
  try {
    instructions = (await readFile(new URL(`${name}.md`, agentDir), "utf8")).trim();
  } catch {
    instructions = undefined;
  }

  return instructions ? { ...spec, instructions } : spec;
}

/** Existing agents by name, so a create/update can be chosen per spec. */
async function existing(): Promise<Map<string, string>> {
  const res = await fetch(new URL("/api/v1/agents", baseUrl), { headers });

  // 401 here is almost always an expired ID token rather than a bad request, and the
  // body says "Unauthorized" and nothing else — so name the likely cause.
  if (res.status === 401) {
    throw new Error(
      "401 listing agents. TrueForge has OIDC enabled, so TRUEFORGE_TOKEN must be a " +
        "current ID token (the `id_token` cookie from a logged-in browser session). " +
        "They expire in hours.",
    );
  }
  if (!res.ok) throw new Error(`could not list agents — ${res.status} ${await res.text()}`);

  const body = (await res.json()) as { data?: { id: string; name: string }[] };
  return new Map((body.data ?? []).map((a) => [a.name, a.id]));
}

const known = dryRun ? new Map<string, string>() : await existing();
let failed = 0;

for (const name of names) {
  const manifest = await manifestFor(name);
  const id = known.get(name);
  const verb = id ? "updated" : "created";

  if (dryRun) {
    const servers = (manifest.mcp_servers ?? []) as { name: string }[];
    const skills = (manifest.skills ?? []) as { name: string }[];
    console.log(`· ${name}`);
    console.log(`  connectors: ${servers.map((s) => s.name).join(", ") || "none"}`);
    console.log(`  skills:     ${skills.map((s) => s.name).join(", ") || "none"}`);
    continue;
  }

  const res = id
    ? await fetch(new URL(`/api/v1/agents/${id}`, baseUrl), {
        method: "PUT",
        headers,
        body: JSON.stringify({ manifest }),
      })
    : await fetch(new URL("/api/v1/agents", baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({ name, manifest }),
      });

  if (res.ok) {
    console.log(`✓ ${name} ${verb}`);
  } else {
    failed++;
    console.error(`✗ ${name} — ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

if (dryRun) {
  console.log(`\n${names.length} would sync to ${baseUrl}`);
} else {
  console.log(`\n${names.length - failed}/${names.length} synced to ${baseUrl}`);
  if (failed > 0) process.exitCode = 1;
}

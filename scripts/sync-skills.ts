import "dotenv/config";
import { readFile } from "node:fs/promises";

/**
 * Registers the skill manifests in `skills/skills.json` with TrueForge.
 *
 * Only the manifests. The skill content is never uploaded — TrueForge clones it from
 * GitHub at the `ref` each manifest names, so this script is pointless until the
 * skills are pushed to that ref.
 *
 * `PUT /api/v1/settings/skills` is create-or-replace by name, which is why this is a
 * loop and not the list/resolve/branch dance agents need.
 */
const baseUrl = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";
const endpoint = new URL("/api/v1/settings/skills", baseUrl);

const manifests: unknown[] = JSON.parse(
  await readFile(new URL("../skills/skills.json", import.meta.url), "utf8"),
);

let failed = 0;

for (const manifest of manifests) {
  const name = (manifest as { name: string }).name;
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest }),
  });

  if (res.ok) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name} — ${res.status} ${await res.text()}`);
  }
}

console.log(`\n${manifests.length - failed}/${manifests.length} synced to ${baseUrl}`);
if (failed > 0) process.exitCode = 1;

import "dotenv/config";

/**
 * Registers the MCP connectors the agents in `trueforge/agents` mount.
 *
 * Unlike `skills.json`, the manifests are in this file rather than in committed JSON,
 * because a connector manifest carries its credential — in a header for GitHub, in the
 * query string for Bright Data and Linkup, which is how those two authenticate. A
 * committed connectors file would be a committed secret. So the shape lives here and
 * the secrets come from `.env`.
 *
 * `PUT /api/v1/settings/mcp-servers` is create-or-replace by name and does not run DCR,
 * which is fine: none of these four use OAuth. An OAuth connector would need `POST` to
 * register and then a human to open the URL from
 * `GET /api/v1/mcp-servers/{name}/authorize`.
 *
 * Header secrets round-trip: on PUT a real value sets or rotates, and the redacted value
 * a GET returns keeps the stored one. This script always sends real values.
 */
const baseUrl = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";
const endpoint = new URL("/api/v1/settings/mcp-servers", baseUrl);

/** `--dry-run` prints what would be sent, redacted, and writes nothing. */
const dryRun = process.argv.includes("--dry-run");

/** Anything key-shaped, wherever it sits — a header value or a query param. */
function redact(manifest: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(manifest).replace(
      /[A-Za-z0-9_-]{24,}/g,
      (s) => `${s.slice(0, 3)}…${s.slice(-3)}`,
    ),
  );
}

type Connector = {
  /** Env vars that must be set. Missing ones skip the connector rather than fail the run. */
  requires: string[];
  manifest: () => Record<string, unknown>;
};

const graftUrl = process.env.GRAFT_MCP_URL ?? "http://host.docker.internal:3100/api/mcp";

/**
 * The connector name the agent specs mount. Overridable because a TrueForge may already
 * carry this server under another name — `mcp_servers[].name` in the specs has to match
 * whatever this resolves to.
 */
const graftName = process.env.GRAFT_MCP_NAME ?? "graft";

const connectors: Record<string, Connector> = {
  [graftName]: {
    requires: [],
    manifest: () => ({
      type: "remote",
      name: graftName,
      url: graftUrl,
      description:
        "Hackathon and sponsor-product corpus. Hybrid retrieval over indexed " +
        "documentation, plus the write path that records hackathons, products, " +
        "documentation sources and cited findings.",
    }),
  },

  github: {
    requires: ["GITHUB_MCP_TOKEN"],
    manifest: () => ({
      type: "remote",
      name: "github",
      url: "https://api.githubcopilot.com/mcp/",
      description: "Work with issues, pull requests, repository files, and CI status.",
      auth: {
        type: "header",
        // Sent verbatim. Include the scheme in the env var if your token needs one.
        headers: { Authorization: process.env.GITHUB_MCP_TOKEN! },
      },
    }),
  },

  brightdata: {
    requires: ["BRIGHTDATA_TOKEN"],
    manifest: () => ({
      type: "remote",
      name: "brightdata",
      // Bright Data authenticates on the query string, so the token is in the URL and
      // a GET of this connector returns it unredacted. Only `auth.headers` is redacted.
      url: `https://mcp.brightdata.com/sse?token=${process.env.BRIGHTDATA_TOKEN}`,
      description:
        "Search the web and scrape pages, including sites behind bot protection. " +
        "SERP tools find the blog, repository and socials a hackathon page omits.",
    }),
  },

  linkup: {
    requires: ["LINKUP_API_KEY"],
    manifest: () => ({
      type: "remote",
      name: "linkup",
      // Same as Bright Data: the key is the query string, not a header.
      url: `https://mcp.linkup.so/mcp?apiKey=${process.env.LINKUP_API_KEY}`,
      description:
        "Web search and page fetch with cited answers. linkup-search for real-time " +
        "queries, linkup-research for long-running multi-source synthesis, " +
        "linkup-fetch to extract one page.",
    }),
  },
};

let synced = 0;
let skipped = 0;
let failed = 0;

for (const [name, connector] of Object.entries(connectors)) {
  const missing = connector.requires.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    skipped++;
    console.warn(`⚠ ${name} — skipped, ${missing.join(" and ")} not set`);
    continue;
  }

  if (dryRun) {
    synced++;
    console.log(`· ${name}
  ${JSON.stringify(redact(connector.manifest()))}`);
    continue;
  }

  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: connector.manifest() }),
  });

  if (res.ok) {
    synced++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name} — ${res.status} ${await res.text()}`);
  }
}

console.log(
  `\n${synced} ${dryRun ? "would sync" : "synced"}, ${skipped} skipped, ${failed} failed — ${baseUrl}`,
);
if (failed > 0) process.exitCode = 1;

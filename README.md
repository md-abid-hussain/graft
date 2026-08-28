# WeHelpAgents

**We make devs. This helps agents.**

Cross-hackathon sponsor-product knowledge, served to any coding agent over MCP —
plus an agent that wires the product into your repo and opens the pull request.

Built for [The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry × Qodo) on [TrueForge](https://trueforge.dev).

---

## The problem

WeMakeDevs runs a hackathon every few weeks, each with a different sponsor product.
Bright Data for scraping. Zerops for infra. SigNoz for observability. Cognee for
agent memory. Kestra for automation. Now TrueForge for agent harnesses.

Every time, every participant does the same thing: paste the hackathon page into
Claude, paste the rules, paste the docs links, hope the agent searched the right
version. Then the hackathon ends and all of that context evaporates.

But **the products don't stop being useful.** SigNoz still does observability. Kestra
still runs pipelines. Next hackathon, when you want observability in your project, you
start from a blank docs site again — even though you "learned" SigNoz three months ago.

## What this is

A **cross-hackathon knowledge layer with hands.**

Give it a hackathon URL. An agent researches it end to end — the event, its sponsors,
their documentation, their canonical repos, the good blog posts, the winning
submissions — and ingests all of it into a filtered, cited corpus. Do that for every
event and you get something no individual participant has: one corpus spanning every
sponsor product across every hackathon.

That corpus is served over **MCP**, so Claude Code, Codex, Cursor, and TrueForge all
read from the same place. The context problem is solved once instead of per-hackathon.

Then a second agent *uses* it. Point it at your repository and say "add observability":
it researches SigNoz from the corpus, clones your repo in a sandbox, brings SigNoz up
in Docker, writes the instrumentation, confirms a trace actually arrives, and **asks
your permission before opening the pull request**.

## The two agents

| Agent | In | Out |
|---|---|---|
| **Scout** `hackathon-researcher` | a hackathon URL | event, sponsors, docs ingested, findings recorded with evidence |
| **Field Engineer** `integration-engineer` | a repo + a product | a sandbox-verified pull request, opened only after you approve |

Scout fans out to parallel subagents — one ranking blog posts for relevance, one
verifying which GitHub repository is canonical, one hunting winning submissions — and
each writes its findings straight to the corpus through MCP tools rather than funnelling
prose back through the root agent.

Field Engineer is where the harness does its heaviest work: a real tool reached through
MCP, generated code executed in an isolated sandbox, and a hard stop for human approval
before anything irreversible.

## Quickstart

Requires Node 22+, pnpm, and Docker.

```bash
pnpm install
cp .env.example .env          # add your OPENAI_API_KEY
pnpm db:up                    # Postgres 16 + pgvector on :5434
pnpm db:migrate               # creates the extension, tables and indexes
pnpm dev
```

Build the corpus for a product:

```bash
pnpm ingest --url https://trueforge.dev/llms-full.txt \
            --product trueforge --name TrueForge \
            --company TrueFoundry --category harness
```

### Connect it to your own coding agent

The MCP server is a plain remote endpoint — nothing about it is TrueForge-specific.

```bash
claude mcp add --transport http wehelpagents http://localhost:3000/api/mcp
```

For TrueForge running in Docker, register it as
`http://host.docker.internal:3000/api/mcp` — a container cannot reach the host's
localhost. On native Linux Docker Engine that hostname needs
`extra_hosts: ["host.docker.internal:host-gateway"]` on the TrueForge service; Docker
Desktop on macOS and Windows provides it automatically.

## MCP tools

**Read**

| Tool | Purpose |
|---|---|
| `list_products` | What is indexed, by category and freshness |
| `get_product` | Overview, canonical links, ingestion state |
| `list_hackathons` / `get_hackathon` | Events, dates, tracks, rules, requirements |
| `search_corpus` | Hybrid retrieval, filtered by product / hackathon / kind, every result cited |

**Write**

| Tool | Purpose |
|---|---|
| `save_hackathon` · `save_product` | Structured event and sponsor records |
| `record_finding` | A discovered item **and the evidence for judging it that way** |
| `ingest_source` | Fetch, chunk, embed and index a documentation source |
| `record_step` | Run history that survives context compaction |

Retrieval is hybrid: a metadata filter, then vector and full-text search in parallel,
fused with reciprocal rank fusion. Neither half is sufficient alone — pure vector
search misses exact identifiers like `OTEL_EXPORTER_OTLP_ENDPOINT`, and pure keyword
search misses paraphrases entirely.

**The tool schema is the contract.** Each write tool validates what an agent sends and
returns every violation at once, naming the valid options, as a result the agent can
read and retry from — rather than accepting a malformed blob and discovering the
problem later. Product and hackathon enums are generated from the corpus at server
start, so a model cannot pass a slug that does not exist.

That is also the extension point: a new capability is a new tool with a schema, and
agents and humans reach the same contract.

## Stack

| | |
|---|---|
| App | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| Store | Postgres 16 + pgvector, Drizzle ORM |
| Embeddings | OpenAI `text-embedding-3-large` at 1536 dimensions |
| Agents | TrueForge harness · Daytona sandbox |
| Agent UI | `@truefoundry/trueforge-ui` |

Embeddings are reduced to 1536 dimensions rather than the model's native 3072, because
pgvector's HNSW index caps at 2000 — at full width every query would fall back to an
exact scan.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — data model, run flow, agent design, and the
  reasoning behind the decisions

---

## Qodo Code Review Evidence

<!-- Filled in before submission: representative merged PR, what Qodo surfaced,
     what changed or was intentionally dismissed, and the follow-up review. -->

## AI assistance disclosure

<!-- Filled in before submission. -->

## License

MIT

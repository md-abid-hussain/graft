# Graft

**Learns with you at one hackathon. Builds with you at the next.**

Built for [The Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
(WeMakeDevs × TrueFoundry × Qodo) on [TrueForge](https://trueforge.dev).

---

## The problem

WeMakeDevs runs a hackathon every few weeks, each built on a different stack. SigNoz for
observability. Cognee for agent memory. Zerops for infrastructure. TrueForge for agent
harnesses.

You learn one, ship something, and move on. Your coding agent learned it too — and forgot
it the moment the session closed. So the next time you reach for that tool, you paste the
same documentation into the same chat and start from zero.

You accumulate. Your agent resets, every single time.

## What this is

Graft is an agent that learns a stack alongside you and still knows it next month.

**It learns with you.** While you work through a hackathon, it reads that stack from its
own documentation — the event, its sponsors, their docs and repositories — and keeps what
it found, cited.

**It remembers.** The next hackathon does not start from zero. What it learned in March is
still there in June, and it never re-reads a page it has already indexed.

**It builds with you.** Ask it to add something it knows to a project. It reads your
repository, writes the change **in a sandbox**, runs **your** test suite against it, and
opens a pull request.

You review a diff that already passes. Nothing reaches your repository until you approve
it — and the credential that can write to GitHub never enters the sandbox.

## The agents

| Agent | Job |
|---|---|
| `wemakedevs-research-agent` | Reads a hackathon and its sponsors, asking before it stores anything |
| `doc-query-agent` | Answers questions from the indexed documentation, with citations |
| `integration-agent` | Adds a known library to a repository, sandboxed, pull request gated |

Their specs live in [`trueforge/agents/`](trueforge/agents) — model, tool mounts and
instructions as files, so a change to how an agent behaves arrives as a pull request
rather than as someone's browser state.

## Status

| | State |
|---|---|
| Research agent — hackathon in, approved records out | **working** |
| Docs agent — questions answered from indexed documentation | **working** |
| Shared memory — Postgres + pgvector, hybrid retrieval, served over MCP | **working** |
| Web app — see what it knows, research a hackathon, ask it | **working** |
| Integration agent — repo in, sandboxed change out, pull request gated | **in progress** |

## Quickstart

Requires Node 22+, pnpm, Docker, and a running [TrueForge](https://trueforge.dev).

```bash
pnpm install
cp .env.example .env          # add OPENAI_API_KEY, point TRUEFORGE_BASE_URL at your harness
pnpm db:up                    # Postgres 16 + pgvector on :5434
pnpm db:migrate               # extension, tables, indexes
pnpm dev
```

Then open:

| Route | |
|---|---|
| `/` | What this is |
| `/hackathons` | What it knows — overview, rules, schedule, resources |
| `/research` | Research a hackathon, with what it learned appearing beside the chat |
| `/docs` | Ask questions against the indexed documentation |

It starts knowing nothing. The research agent fills it by calling `save_hackathon`,
`save_product` and `ingest_source` — each one pausing for your approval. The path a judge
watches in the demo is the only path that writes.

## How the agents share a memory

The agents do not each carry their own copy of what has been learned. They read and write
one index through a single MCP server at `/api/mcp` — nine tools and two resources, with
reads and writes together because they are not two audiences. The research agent reads its
own output constantly, to check whether a hackathon is already on record before spending
an hour re-researching it.

**Read**

| Tool | Purpose |
|---|---|
| `how_to_use` | What the server is, how to drive it, and what is indexed right now |
| `list_products` | Everything on record, with category and how much is indexed |
| `get_product` | Full record: links, socials, indexed sources, hackathons it appeared at |
| `list_hackathons` / `get_hackathon` | Hackathons, dates, tracks, judging, rules, requirements |
| `search_docs` | Hybrid retrieval over one product's docs, every result cited |

**Write** — no `readOnlyHint`, so the harness gates them

| Tool | Purpose |
|---|---|
| `save_hackathon` | The hackathon record. Step 1: products reference it |
| `save_product` | A sponsor product, optionally linked to a hackathon |
| `ingest_source` | Fetch, chunk, embed and index one `llms-full.txt` |

**Resources** — the same guide the `how_to_use` tool returns, served the spec-correct way
as well. Exposed twice on purpose: plenty of MCP clients read only `tools/list` and never
call `resources/list`, so a resource-only guide is invisible to them.

| URI | Purpose |
|---|---|
| `guide://usage` | Tool order, how to phrase a search, how to find an `llms-full.txt` |
| `corpus://status` | Live coverage: what is actually indexed right now |

### Four decisions worth explaining

**The schema is the contract.** Every tool declares an `outputSchema` and returns
`structuredContent` matching it, so a calling agent gets typed records to index rather
than prose to parse — and nobody writes per-agent output instructions. A bad slug is
refused with the valid options, as a result the agent can read and retry from.

**Ingestion takes `llms-full.txt` only** — the file that concatenates a whole documentation
set. Not `llms.txt`, which is an index of links: indexing one yields chunks made entirely
of link lists, which match queries confidently and answer none of them. That is worse than
no coverage, because nothing then signals the product is unsearchable.

**Retrieval is hybrid.** Filter by product, then vector and full-text search in parallel,
fused with reciprocal rank fusion. Neither half is sufficient alone — pure vector search
misses exact identifiers like `OTEL_EXPORTER_OTLP_ENDPOINT`, and pure keyword search
misses paraphrases entirely.

**The server has no web access, by design.** Discovery belongs to the agent and its own
tools — Linkup, Bright Data, whatever is connected. It finds the hackathon page, the
sponsors, and each product's `llms-full.txt`; it sends facts and URLs. The server fetches,
parses, chunks, embeds and stores. An agent that pastes page content here has already
spent the context this whole system exists to save.

## How TrueForge is used

Not as a model wrapper. The harness does work this project would otherwise have to build:

- **Human approval before anything irreversible.**
  `require_approval_for_tools: ["@write", "@destructive"]` gates every write to the index,
  and every GitHub write the integration agent proposes. Nothing lands unapproved.
- **The sandbox does the work, without the keys.** The integration is written and the test
  suite is run inside the sandbox; the GitHub credential stays in the connector and never
  enters it. The sandbox proves the change works — it is not trusted to ship it.
- **Deferred tool loading.** Several MCP servers are attached; their schemas are discovered
  on demand rather than loaded into context up front.
- **Subagents.** Research fans out across a hackathon's sponsors in parallel and merges
  only the results.
- **Sessions that survive.** `/research` reads a session's own event log to work out which
  hackathon it produced, so reopening an old conversation shows what it learned.

The shared memory is served over MCP rather than wired into one runtime, so it is not
locked to this harness — but the agents that learn and act are TrueForge agents, and the
approval gates, the sandbox and the subagents are the harness's, not an imitation of them.

The web app embeds the harness's own React SDK (`@truefoundry/trueforge-ui`) rather than
reimplementing the chat, so streaming, tool cards, approval gates and MCP OAuth behave
exactly as they do in TrueForge itself.

## Stack

| | |
|---|---|
| App | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| Chat | `@truefoundry/trueforge-ui`, embedded in SingleAgent mode |
| Store | Postgres 16 + pgvector, Drizzle ORM |
| Embeddings | OpenAI `text-embedding-3-large` at 1536 dimensions |
| Agents | TrueForge harness |

Embeddings are reduced to 1536 dimensions rather than the model's native 3072, because
pgvector's HNSW index caps at 2000 — at full width every query would fall back to an exact
scan.

---

## Qodo Code Review Evidence

_To be completed before submission._ Needs: a link to at least one representative merged
pull request with meaningful hackathon code, what Qodo surfaced and what was changed or
deliberately dismissed, and the follow-up review against the final code.

Reviewed so far: [#5](https://github.com/md-abid-hussain/graft/pull/5),
[#6](https://github.com/md-abid-hussain/graft/pull/6),
[#11](https://github.com/md-abid-hussain/graft/pull/11),
[#12](https://github.com/md-abid-hussain/graft/pull/12).

## AI assistance disclosure

_To be completed before submission._ The hackathon rules require disclosure of AI
assistant use.

## License

MIT

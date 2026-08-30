# The contract

The MCP server in full — every tool, both resources, and the decisions behind
them. The [README](README.md#the-contract) carries the summary; this is the
reference.

One MCP server at `/api/mcp` is the entire boundary between the harness and the store:
ten typed tools and two resources, reads and writes together — the research agent
reads its own output constantly, so they are not two audiences.

**Read**

| Tool                                | Purpose                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `how_to_use`                        | What the server is, how to drive it, and what is indexed right now      |
| `list_products`                     | Everything on record, with category and how much is indexed             |
| `get_product`                       | Full record: links, socials, indexed sources, hackathons it appeared at |
| `list_hackathons` / `get_hackathon` | Hackathons, dates, tracks, judging, rules, requirements                 |
| `search_docs`                       | Hybrid retrieval over one product's docs, every result cited            |

**Write** — no `readOnlyHint`, so the harness gates them

| Tool             | Purpose                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `save_hackathon` | The hackathon record. Step 1: products reference it                                             |
| `save_product`   | A product, optionally linked to a hackathon                                                     |
| `ingest_source`  | Fetch, chunk, embed and index a batch of doc URLs in one approval                               |
| `save_build`     | Record a piece of work an agent did — the only tool that writes what it _did_, not what it read |

**Resources** — the same guide the `how_to_use` tool returns, served the spec-correct way
as well. Exposed twice on purpose: plenty of MCP clients read only `tools/list` and never
call `resources/list`, so a resource-only guide is invisible to them.

| URI               | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `guide://usage`   | Tool order, how to phrase a search, how to find an `llms-full.txt` |
| `corpus://status` | Live coverage: what is actually indexed right now                  |

## Four decisions worth explaining

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

**Discovery is the agent's; fetching is the server's.** The server never searches the
web. Finding things — the hackathon pages, a sponsor's blog, the `llms-full.txt` — is
done by the agents with the web tools they mount (Bright Data's SERP tools, Linkup),
following the query patterns in the `guide://usage` resource. The server's only network
act is fetching the exact URLs that `ingest_source` was handed and a human approved;
it then parses, chunks, embeds and stores them. So the rule the contract enforces is:
the agent sends facts and URLs, never page content — pasted pages spend the context
this system exists to save, and skip the content-hashing that makes re-runs free.

**The index comes first, and the web is the fallback.** `graft-build` can search the web
when the corpus cannot answer, because refusing to act on an unindexed library helps
nobody. But the order is fixed and it says which it used: index first, then an explicit
"this is not indexed", then the web, then a note on what to ingest so the next run is
free. The failure worth guarding against is not a wrong answer — it is reaching for the
web _first_, because that works, nobody notices, and the corpus quietly stops being the
thing the project is built on.

---
name: graft-docs-lookup
description: Answer questions about WeMakeDevs sponsor products and hackathons from the Graft index instead of documentation sites or memory. Covers slug discovery, how to phrase a search, per-product filtering, and citation. Use whenever a question touches an indexed product — its setup, configuration or API — or a hackathon's rules, tracks, dates or requirements.
---

# Graft docs lookup

Graft holds WeMakeDevs sponsor products and hackathons, researched once and stored as
records with their documentation chunked and embedded. A question about one of them is
answered from the index, not by reading its documentation site again.

The `graft` MCP server exposes five read tools:

| tool | args | returns |
|---|---|---|
| `list_products` | none | every product, and how many chunks each has indexed |
| `list_hackathons` | none | slug, title, dates, status |
| `get_product` | `product` | links, socials, sources, hackathons it appeared at |
| `get_hackathon` | `hackathon` | tracks, judging, rules, requirements, project ideas |
| `search_docs` | `query`, `product` | cited passages from that product's documentation |

## List before you search

`search_docs` requires a `product` slug and `get_hackathon` requires a `hackathon`
slug, and neither is derivable from the display name. Both list tools take no
arguments and exist to hand out those slugs. Call one first, every time. Never guess a
slug — a wrong one filters the corpus down to nothing and returns an empty result that
reads exactly like "there is no documentation for this".

The chunk count in `list_products` is the other half of that call. A product showing 0
chunks has links and no indexed documentation; `search_docs` against it will return
nothing no matter how the question is phrased. Say that, rather than searching three
more times.

## Searching

Retrieval is hybrid — vector and full-text fused — so it handles
`OTEL_EXPORTER_OTLP_ENDPOINT` and a question that shares no words with its answer.
Two habits decide whether it works:

- **Ask a whole question, not keywords.** The vector half matches on meaning. "How do I
  configure the OTLP exporter endpoint?" retrieves; "otlp endpoint config" barely does.
- **One product per call.** `product` is required and filtered before retrieval, so a
  query spanning two products has to be two calls.

For a broad or multi-part question, run one general query first to find out what the
corpus actually holds on the topic, then fan out into focused queries per component or
per step. For a narrow question, search directly — the fan-out is for coverage, not
ceremony.

Every hit carries the URL it came from. `truncated: true` means the chunk was cut and
the rest is at that URL.

## Answering

Cite the URL on every claim that came from a hit. Synthesize only from what was
retrieved: if the index does not cover something, say so plainly instead of filling the
gap from general knowledge — an unsourced answer about a sponsor product is the one
failure this corpus exists to prevent.

When the question is about installation, setup or configuration, answer it in full.
Summarizing a setup procedure defeats the reason the documentation was indexed.

## Out of bounds

- No web search, no fetching documentation pages, no memory of how the library behaves.
  If it is not in the index, that is the finding.
- No write tools. `save_hackathon`, `save_product` and `ingest_source` belong to
  research, not to answering a question.

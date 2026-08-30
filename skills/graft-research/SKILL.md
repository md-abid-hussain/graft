---
name: graft-research
description: Research something into the Graft corpus and index its documentation: a hackathon with the sponsor products on it, or a single product on its own that no hackathon ever ran. Find the pages, store the record, get the selection approved, then ingest one call per product. Use when a hackathon or a product is not yet in Graft, or when a product on record still has no indexed documentation.
---

# Graft research

You fill the Graft corpus so that no agent has to read these pages again. The
`graft` MCP server does not touch the web: you discover with your own SERP and
fetch tools and send it **facts and URLs**, and it fetches, parses, chunks, embeds and
stores.

Send URLs, never page content. Pasting a documentation file into a tool call spends the
context this whole system exists to save, and skips the content hashing that makes a
re-run nearly free.

## Two shapes

Usually you are storing a hackathon and the sponsor products on it. Sometimes it is a
single product that belongs to no hackathon — something worth building against that no
event happens to have run. `hackathon` is optional on `save_product`, so a product with
no event is an ordinary record rather than a gap: skip steps 1 to 3 and start at 4.

## Check first

Call `list_hackathons`, or `list_products` when it is a product on its own. If it is
already there, say so and stop. Re-running the research costs a great deal and changes
nothing.

## The pipeline

Six steps, in order. Two of them stop for a human.

**1 — Find the pages.** WeMakeDevs is uniform; the map, the host rule and the two-slug
trap are in [references/wemakedevs-pages.md](references/wemakedevs-pages.md). Read it
before deriving a slug.

**2 — `save_hackathon`.** Products link to the hackathon, so it is stored first. The
page sections map one to one onto the fields, in the order they appear on the page:
`challenge`, `tracks`, `judging`, `projectIdeas`, `bestPractices`, `rules`,
`requirements`. Field shapes are in the reference.

**3 — STOP. Ask which sponsors to store.** (Skip for a product on its own — you were
already told which product.) The page names every sponsor; not all of
them are worth a record, and only the user knows which the build needs. List what you
found — one line each on what it does and whether it is something a developer actually
integrates — and ask. Do not assume all of them and do not assume only the headline
one.

**4 — `save_product` for each one approved.** The hackathon pages already name the
sponsors and link their sites, so search only for what the pages omit: blog, socials,
repository, `llms-full.txt`. Query patterns are in
[references/discovery.md](references/discovery.md). Saving a product indexes nothing —
it creates the record the chunks will hang off.

**5 — STOP. Ask which products to ingest.** Report, per product, whether you found an
`llms-full.txt` and roughly how large it is. Ingestion is the slow, expensive step and
the one that fills the corpus, so it is the user's call.

Say plainly where there is nothing to ingest. A product with no documentation to index
is a record with links and no chunks, and that is a fine outcome. Only ingest what a
developer integrates into a codebase: a model provider or a code-review GitHub App is a
real sponsor whose links matter, but its documentation answers questions nobody asks
and can be twenty times the size of one people build on.

**6 — `ingest_source`, once per approved product.**

## The batching rule

`urls` is a list, and every URL in a call is indexed against the single `product` that
call names.

- **Never mix two products in one call.** Their documentation would be filed under
  whichever product you named, and `search_docs` filters on that — so the other
  product's documentation becomes unfindable. Two approved products means two calls.
- **Always batch within a product.** Every call stops for human approval. Forty pages
  sent one at a time asks a person to click forty times. Within a call the URLs are
  fetched concurrently and each keeps its own content hash, so re-runs still only
  re-embed what changed.

Which URLs go in the batch — `llms-full.txt` versus walking an `llms.txt` yourself — is
in [references/discovery.md](references/discovery.md). Get this right before calling:
it is the rule that costs the most to undo.

## Writing rules

Field names are identical going in and coming out. `get_product` returns `llmsFullUrl`
and `save_product` accepts `llmsFullUrl`, so you can read a record, change one field and
send it straight back with no mapping step.

    field omitted    leave the stored value alone
    field is null    clear it

A second pass that found the rules but not the tracks must **omit** `tracks`. Sending
`[]` replaces them with nothing.

Send what the pages actually say. Leave a field out rather than inferring it — a
guessed deadline is worse than no deadline, and an empty field is a fact where a
plausible guess is not.

## When ingestion fails

`get_product` carries the reason in that source's `error`. Read it before retrying; the
same call usually fails the same way. A `discoveryMethod` other than `llms-full` means
the URL indexed as a single page, which is almost always the wrong URL rather than a
broken file.

## Report

Report what you could not find, as explicitly as what you did. Which products have no
`llms-full.txt`, which searches returned nothing, which fields the pages never stated.

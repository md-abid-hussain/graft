/**
 * Server instructions, handed to every client at initialize.
 *
 * This is the MCP spec's own field for "what is this server and how do I use it", so
 * it is in the model's context before it calls anything — no tool call spent on
 * orientation. It has to answer three questions fast: what is in here, which of the
 * two jobs am I doing, and what is the first call.
 *
 * Kept short on purpose. The full walkthrough is the `guide://usage` resource, which
 * an agent reads when it needs the detail.
 */
export const INSTRUCTIONS = `
Graft — documentation and hackathon knowledge for WeMakeDevs sponsor
products, researched once and stored as structured records so you never read a
documentation site to answer a question about one.

There are two jobs here. Work out which one you are doing.

## Building something (most of the time)

You are writing code against a sponsor product and need to know how it works.

  list_products              what is in the corpus, and how much of each is indexed
  search_docs(q, product)    cited answers from that product's real documentation
  get_product(product)       links, socials, sources, hackathons it appeared at
  list_hackathons            hackathons on record, status included
  get_hackathon(hackathon)   dates, tracks, judging, rules, requirements, ideas

Start with list_products. It takes no arguments and it is where the product slugs
come from — search_docs requires one, and slugs frequently are not what you would
guess. Then ask search_docs a whole question, not a keyword list, one product per
call. Every hit carries the URL it came from; cite it.

## Researching a hackathon (populating the corpus)

You are filling this corpus for a hackathon that is not in it yet. Check
list_hackathons first — if it is already there, you are done, and re-running the
research costs a lot and changes nothing.

Discovery is YOUR job, with YOUR web tools. This server does not search the web.
WeMakeDevs pages are uniform: /hackathons is the index, /hackathons/<slug> the
overview, with /rules, /schedule and /resources beside it. A hackathon whose results
are out moves to archive.wemakedevs.org on the same path; luma.com ones are out of
scope. Take the slug and the host from the index card rather than guessing.

  1. save_hackathon   the hackathon
     ask            which sponsors are worth storing — do not assume all of them
  2. save_product     each one you were told to, linked to that hackathon
     ask            which of those to ingest, and say where there is nothing to
  3. ingest_source    the approved llms-full.txt URLs

The pages name the sponsors; search fills in what they omit — blog, socials, repo.
Search the COMPANY name there, not the product: TrueForge's blog and channel belong
to TrueFoundry. Read guide://usage or call how_to_use for the query patterns.

Pass URLs, never page content. This server fetches, parses, chunks, embeds and
indexes. Handing it text you already downloaded burns the context this whole system
exists to save, and skips the content hashing that makes re-runs nearly free.

## Field names

A field is spelled the same way going in and coming out — what get_product returns
as \`llmsFullUrl\` is what save_product accepts as \`llmsFullUrl\`. So you can read a
record, change one thing, and send it straight back without a mapping step. On a
write, omitting a field leaves the stored value alone; passing null clears it.

Read guide://usage for the full walkthrough, corpus://status for what is indexed
right now.
`.trim();

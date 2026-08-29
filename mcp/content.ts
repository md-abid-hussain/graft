/**
 * The usage guide, in one place because it backs two surfaces.
 *
 * It is served as the `guide://usage` resource, which is the spec-correct home for
 * it, AND as the `how_to_use` tool — because a good number of MCP clients consume
 * only tools and never call `resources/list`, so a resource-only guide is invisible
 * to them. Same text, two doors.
 *
 * Kept tight on purpose: it is read into an agent's context before it does any work,
 * so every line has to earn its place. Rules and order stay; the reasoning behind
 * them lives in the code, not here. The only justifications that survived are the
 * ones an agent needs in order to make a decision — why the company name beats the
 * product name, why llms.txt is not llms-full.txt.
 */
export const GUIDE = `
# Graft

Sponsor products from WeMakeDevs hackathons, researched once and stored as records.
Ask for what you need instead of reading documentation sites.

## Reading

    list_products                no args — every product, and how much is indexed
    get_product(product)         links, socials, sources, hackathons it appeared at
    search_docs(query, product)  cited passages from that product's docs
    list_hackathons              no args — slug, title, dates, status
    get_hackathon(hackathon)     tracks, judging, rules, requirements, ideas

Start with a list tool. Both take no arguments and hand out the slugs everything
else needs; slugs rarely match the display name.

\`search_docs\` is hybrid — vector and full-text fused — so it handles both
\`OTEL_EXPORTER_OTLP_ENDPOINT\` and a question sharing no words with its answer.
Two habits matter:

- **Ask a whole question, not keywords.** The vector half needs meaning to match.
- **One product per call.** \`product\` is required and filtered before retrieval.

Every hit cites its URL. \`truncated: true\` means fetch that URL for the rest. A
product showing 0 chunks has no indexed docs and will return nothing.

## Researching a hackathon

Check \`list_hackathons\` first. If it is already there you are done — re-running
costs a great deal and changes nothing.

This server has no web access. You discover with your own SERP and fetch tools and
send **facts and URLs**; it fetches, chunks, embeds and stores. Never paste page
content: it burns the context this exists to save and skips the hashing that makes
re-runs nearly free.

**1 — Find the pages.** WeMakeDevs is uniform:

    /hackathons                   index — take slug AND host from the card
    /hackathons/<slug>            overview: sponsors, tracks, judging, ideas
    /hackathons/<slug>/rules      rules, submission requirements
    /hackathons/<slug>/schedule   dates, deadline
    /hackathons/<slug>/resources  docs and links per sponsor

The host is the state: \`www.wemakedevs.org\` while it runs, moving to
\`archive.wemakedevs.org\` on the same path once results are declared. luma.com and
devpost hackathons are out of scope.

Two different slugs, do not mix them. The one in the URL locates the page and is not
derivable from the title — "Into the Scrape-Verse" lives at \`scrape-verse\`. The
\`hackathon\` you send to this server is its own key, slugified from the **title**,
short: drop a leading "the", drop punctuation, stop at the distinctive part.
"Agents of SigNoz" is \`agents-of-signoz\`; "The Hangover Part AI: Where's My
Context?" is \`hangover-part-ai\`. WeMakeDevs names its paths after the sponsor, so
reusing one would file the event under the product and overwrite it the next time
that sponsor runs something. Product slugs come from the product name the same way —
\`falkordb\`, \`trueforge\` — so a hackathon and its sponsor never collide.

**2 — save_hackathon.** Products link to it, so it goes first. The page sections map
one to one, in this order: \`challenge\`, \`tracks\`, \`judging\`,
\`projectIdeas\`, \`bestPractices\`, \`rules\`, \`requirements\`. Most are
\`{title, description}\`; \`tracks\` is \`{name, prize, criteria}\` and holds
every prize category, judged tracks and open prizes alike — there is no separate
prizes list. Send an empty array where the page has no such section, and omit the
field entirely if you did not look.

**3 — Stop and ask which products to research.** The hackathon page names every
sponsor, but not all of them are worth a record and only the user knows which the
build actually needs. List what you found — name, what it does, whether it looks
like something a developer integrates — and ask which to store. Do not assume all
of them, and do not assume only the headline one.

**4 — save_product for each one you were told to.** The pages already name the
sponsors and link their sites, so search only for what they omit: blog, socials,
repo. Search the **company**, not the product — TrueForge's blog and channel belong
to TrueFoundry.

    site:truefoundry.com intitle:blog       blog
    site:youtube.com truefoundry            channel
    site:linkedin.com/company truefoundry   page

One \`site:\` plus at most one other operator; stacking more returns nothing.
\`intitle:\` only works when the word is really in the titles — Zerops publishes at
/articles, so \`intitle:blog\` finds nothing though the blog exists. On zero
results, drop the operator and search the plain phrase before concluding it is
absent.

**5 — Stop and ask which to ingest.** Saving a product indexes nothing. Report,
per product, whether you found an llms-full.txt and roughly how big it is, then ask
which to ingest. Ingestion is the slow, expensive step and the one that fills the
corpus, so it is the user's call rather than yours.

Say plainly where there is nothing to ingest: a product with no llms-full.txt is a
record with links and no chunks, which is a fine outcome. Only ingest what a
developer actually integrates into a codebase — a model provider or a code-review
GitHub App is a real sponsor whose links matter, but its docs answer questions
nobody asks and can be 20x the size of one people do build on.

**6 — ingest_source, for the ones approved.** Do not search for the llms-full.txt;
try \`<docs domain>/llms-full.txt\` and fetch it.

**llms-full.txt, not llms.txt.** llms-full.txt is the whole documentation set;
llms.txt is only an index of links. Indexing an llms.txt yields chunks of pure link
lists that match queries confidently and answer none of them. Confirm the URL holds
prose before passing it.

## Writing

Field names are identical in and out: \`get_product\` returns \`llmsFullUrl\` and
\`save_product\` takes \`llmsFullUrl\`. Read a record, edit one field, send it back
— no mapping step.

    field omitted    leave the stored value alone
    field is null    clear it

So a second pass that found the rules but not the tracks must omit \`tracks\`;
sending \`[]\` replaces them with nothing.

When ingestion fails, \`get_product\` carries the reason in that source's
\`error\`. Read it before retrying — the same call usually fails the same way. A
\`discoveryMethod\` other than \`llms-full\` means it indexed as a single page,
which is usually the wrong URL rather than a broken file.
`.trim();

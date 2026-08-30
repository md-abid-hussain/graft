# Discovery: finding what the pages omit

The hackathon pages already name the sponsors and link their sites. Search fills in the
rest — blog, socials, repository, and the documentation file worth ingesting.

## Search the company, not the product

A product's blog and YouTube channel belong to its company. TrueForge's blog is
TrueFoundry's.

    site:truefoundry.com intitle:blog       blog
    site:youtube.com truefoundry            channel
    site:linkedin.com/company truefoundry   page

**One `site:` plus at most one other operator.** Stacking more returns nothing.

`intitle:` only works when the word is really in the titles. Zerops publishes at
`/articles`, so `intitle:blog` finds nothing although the blog exists.

**On zero results, drop the operator and search the plain phrase** before concluding
the thing does not exist. A missing blog and an over-constrained query look identical.

A product's `sitemap.xml` at its root lists every page it publishes, which is faster
than guessing paths.

## llms-full.txt, not llms.txt

Do not search for it. Try `<docs domain>/llms-full.txt` and fetch it. Try the root of
the product site and again at the docs root — documentation is often served from the
same host.

`llms-full.txt` is the whole documentation set. `llms.txt` is only an index of links.
Indexing an `llms.txt` yields chunks of pure link lists that match queries confidently
and answer none of them. **Confirm the URL holds prose before passing it.**

## When there is no llms-full.txt

Read the `llms.txt` yourself, collect the page URLs, and send them as one batch. Plenty
of products publish markdown per page instead of one concatenated file:

- **SigNoz** serves any docs URL with `.md` appended.
- **Datadog** nests an `llms.txt` per section, so walk each one.

This is a normal outcome, not a fallback.

Whatever the shape, the batching rule still holds: one `ingest_source` call per
product, every one of that product's approved URLs inside it, and never two products in
the same call.

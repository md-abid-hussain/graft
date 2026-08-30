import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { DocSearch } from "@/components/doc-search";
import { ProductLinks } from "@/components/product-links";
import { Section } from "@/components/section";
import { SiteHeader } from "@/components/site-header";
import { SponsorMark } from "@/components/sponsor-mark";
import { coverageOf, getProduct, type ProductDetail } from "@/lib/products";
import { safeHref } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** A source list this long is a scroll, not a page. The rest are a count. */
const SOURCE_LIMIT = 40;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug).catch(() => null);
  return p ? { title: p.name, description: p.summary ?? undefined } : { title: "Not found" };
}

/**
 * One product, and what Graft has actually read of it.
 *
 * `get_product` has returned this record to agents over MCP from the start; the app
 * only ever showed the aggregate on a card. So a thousand indexed sources, and the one
 * that failed, were invisible to the person who ran the research.
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let p: ProductDetail | null = null;
  try {
    p = await getProduct(slug);
  } catch {
    // Fall through to notFound: an unreachable index and an unknown slug look the same
    // from here, and neither has a page to show.
  }
  if (!p) notFound();

  const cover = coverageOf(p);
  const shown = p.sources.slice(0, SOURCE_LIMIT);

  return (
    <>
      <SiteHeader />

      <div className="border-b">
        <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-8 2xl:max-w-7xl">
          <div className="flex items-start gap-3">
            <SponsorMark name={p.name} homepageUrl={p.homepageUrl} />
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-3xl leading-tight tracking-tight text-balance">
                {p.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.company && p.company !== p.name ? `${p.company} · ` : null}
                {p.category}
              </p>
            </div>
            <ProductLinks
              name={p.name}
              homepageUrl={p.homepageUrl}
              githubUrl={p.githubUrl}
              socials={p.socials}
            />
          </div>

          {p.summary ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {p.summary}
            </p>
          ) : null}

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Stat label="chunks indexed" value={p.chunks.toLocaleString()} />
            <Stat label="sources" value={cover.total.toLocaleString()} />
            {cover.failed > 0 ? <Stat label="failed" value={cover.failed} warn /> : null}
            {p.appearances.length > 0 ? (
              <Stat label="hackathons" value={p.appearances.length} />
            ) : (
              <Stat label="hackathons" value="none — stands on its own" />
            )}
          </dl>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 2xl:max-w-7xl">
        <Section title="Search this product's documentation">
          <DocSearch product={p.slug} chunks={p.chunks} />
        </Section>

        {cover.total > 0 ? (
          <Section title="Sources" count={cover.total}>
            <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-muted-foreground">
              {cover.byMethod.map(([method, n]) => (
                <span key={method}>
                  {method} <span className="text-foreground/70 tabular-nums">{n}</span>
                </span>
              ))}
            </p>

            <ul className="space-y-1.5">
              {shown.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline gap-3 rounded-lg border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{s.title ?? s.url}</p>
                    <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                      {s.url}
                    </p>
                    {s.status === "failed" && s.error ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="size-3 shrink-0" />
                        {s.error}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                    {s.status === "indexed" ? `${s.chunkCount ?? 0}` : s.status}
                  </span>
                </li>
              ))}
            </ul>

            {cover.total > shown.length ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing {shown.length} of {cover.total.toLocaleString()}, largest first. Search
                above reaches all of them.
              </p>
            ) : null}
          </Section>
        ) : (
          <Section title="Sources">
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              On record with no documentation indexed. That is a normal outcome — a product
              with links and no chunks is still worth having.
            </p>
          </Section>
        )}

        {p.appearances.length > 0 ? (
          <Section title="Appeared at" count={p.appearances.length}>
            <ul className="space-y-2">
              {p.appearances.map((h) => (
                <li key={h.slug}>
                  <Link
                    href={`/hackathons/${h.slug}`}
                    className="flex items-baseline gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
                    <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground capitalize">
                      {h.status}
                    </span>
                  </Link>
                  {h.notes ? (
                    <p className="mt-1 pl-3 text-xs text-muted-foreground">{h.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {safeHref(p.llmsFullUrl) || safeHref(p.docsUrl) ? (
          <Section title="Where this came from">
            <ul className="space-y-1.5 text-sm">
              <Origin label="Documentation" href={p.docsUrl} />
              <Origin label="llms-full.txt" href={p.llmsFullUrl} />
              <Origin label="Sitemap" href={p.sitemapUrl} />
              <Origin label="Blog" href={p.blogUrl} />
            </ul>
          </Section>
        ) : null}
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="order-2 text-muted-foreground">{label}</dt>
      <dd
        className={
          warn
            ? "order-1 font-semibold text-amber-700 tabular-nums dark:text-amber-400"
            : "order-1 font-semibold text-foreground tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Origin({ label, href }: { label: string; href: string | null }) {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <li className="flex items-baseline gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <a
        href={safe}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 truncate hover:underline"
      >
        <span className="truncate">{safe}</span>
        <ArrowUpRight className="size-3 shrink-0" />
      </a>
    </li>
  );
}

import Link from "next/link";
import { ProductLinks } from "@/components/product-links";
import { SponsorMark } from "@/components/sponsor-mark";
import { indexStateOf, type ProductCard as Card } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * One product in the index.
 *
 * The footer is the point of the page: it names the hackathons this product was met at,
 * or says plainly that it came from none. A product carrying no event is not a broken
 * record — it is someone adding a tool they wanted the agent to know.
 */

const INDEX_STYLE: Record<string, string> = {
  indexed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  pending: "bg-primary/12 text-primary",
  failed: "bg-destructive/12 text-destructive",
  unindexed: "bg-muted text-muted-foreground",
};

const INDEX_LABEL: Record<string, string> = {
  indexed: "indexed",
  pending: "ingesting",
  failed: "failed",
  unindexed: "not indexed",
};

export function ProductCard({ product: p }: { product: Card }) {
  const state = indexStateOf(p);

  return (
    <article className="flex flex-col rounded-2xl border bg-card">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <SponsorMark name={p.name} homepageUrl={p.homepageUrl} className="size-8" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
              {p.name}
            </h2>
            {/* Company sits with the category rather than in the heading: a long one
                wrapped mid-title and pushed everything below it down a line. */}
            <p className="text-xs text-muted-foreground">
              {p.category}
              {p.company && p.company !== p.name ? ` · ${p.company}` : ""}
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
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {p.summary}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              INDEX_STYLE[state] ?? INDEX_STYLE.unindexed,
            )}
          >
            {INDEX_LABEL[state]}
          </span>
          {p.chunks > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{p.chunks}</span> chunks
            </span>
          ) : null}
          {p.sources.indexed > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{p.sources.indexed}</span>{" "}
              source{p.sources.indexed === 1 ? "" : "s"}
            </span>
          ) : null}
          <Route product={p} />
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t px-5 py-3 text-xs">
        {p.hackathons.length > 0 ? (
          <>
            <span className="text-muted-foreground">Met at</span>
            {p.hackathons.map((h) => (
              <Link
                key={h.slug}
                href={`/hackathons/${h.slug}`}
                className="rounded-full bg-muted px-2 py-0.5 font-medium transition-colors hover:bg-accent"
              >
                {h.title}
              </Link>
            ))}
          </>
        ) : (
          <span className="text-muted-foreground">
            Not from a hackathon — added on its own.
          </span>
        )}
      </footer>
    </article>
  );
}

/**
 * How this product can be ingested, when it has not been.
 *
 * `llms-full.txt` is the fast path; a sitemap is the slow one. Saying which is
 * available turns "not indexed" from a dead end into an instruction.
 */
function Route({ product: p }: { product: Card }) {
  if (p.chunks > 0) return null;
  if (p.llmsFullUrl) return <Hint>llms-full.txt on record</Hint>;
  if (p.sitemapUrl) return <Hint>sitemap on record</Hint>;
  return <Hint>no source URL yet</Hint>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[0.6875rem] text-muted-foreground">{children}</span>;
}

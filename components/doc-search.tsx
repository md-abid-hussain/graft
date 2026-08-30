"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, Search } from "lucide-react";

/**
 * Search one product's indexed documentation, from the page about that product.
 *
 * Deliberately not a chat. The corpus answers with cited passages on its own, and
 * showing that directly is the only way to see retrieval working without a model in
 * the loop — which is also the only way to tell a retrieval problem from a model one.
 */

type Hit = {
  url: string;
  docTitle: string | null;
  headingPath: string | null;
  content: string;
  score: number;
  truncated: boolean;
};

export function DocSearch({ product, chunks }: { product: string; chunks: number }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Bumped per keystroke so a slow response for an old query cannot land on top of the
  // results for a newer one.
  const run = useRef(0);

  const q = query.trim();

  useEffect(() => {
    if (!q) return;

    const id = ++run.current;

    // Every state change lives in here rather than in the effect body: an empty query
    // is handled by not rendering results at all, so there is nothing to clear.
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/search?product=${encodeURIComponent(product)}&q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { hits: Hit[] };
        if (id === run.current) setHits(data.hits);
      } catch {
        if (id === run.current) setHits([]);
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q, product]);

  if (chunks === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
        Nothing indexed for this product yet, so there is nothing to search.
      </p>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a whole question, not a keyword list"
          aria-label={`Search ${product} documentation`}
          className="w-full rounded-xl border bg-card py-2.5 pr-10 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {busy ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {!q || hits === null ? null : hits.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {busy ? "Searching…" : "No passage in the index matches that."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {hits.map((h, i) => (
            <li key={`${h.url}-${i}`} className="rounded-xl border bg-card p-3">
              <div className="flex items-baseline gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {h.docTitle ?? "Untitled"}
                </p>
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Source
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
              {h.headingPath ? (
                <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
                  {h.headingPath}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                {h.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

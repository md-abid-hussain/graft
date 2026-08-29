import type { TitledItem, Track } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * A block of the hackathon record.
 *
 * The heading is a mono micro-label rather than a title at heading size: one of these
 * pages is a dozen short sections in a row, and a stack of large headings competes with
 * the record itself for attention. The rule closing each section does the separating.
 */
export function Section({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b py-7 first:pt-0 last:border-b-0 last:pb-0", className)}>
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-mono text-[0.6875rem] tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="font-mono text-[0.6875rem] text-muted-foreground/70 tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A `{ title, description }` list — the shape challenge, judging, ideas and practices
 * share.
 *
 * `grid` rules the pairs off against each other in two columns, which is how the detail
 * page reads them. `stack` is for the run panel, where the column is a few hundred pixels
 * wide: `sm:` is a viewport query, so a grid there would split a narrow panel in two
 * because the *window* is wide.
 */
export function TitledList({
  items,
  layout = "grid",
}: {
  items: TitledItem[];
  layout?: "grid" | "stack";
}) {
  if (layout === "stack") {
    return (
      <dl className="space-y-3">
        {items.map((item, i) => (
          <div key={`${item.title}-${i}`}>
            <dt className="text-sm font-semibold text-balance">{item.title}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="grid border-t sm:grid-cols-2">
      {items.map((item, i) => (
        <div
          key={`${item.title}-${i}`}
          className={cn(
            "border-b py-4",
            i % 2 === 0
              ? // The divider is dropped on a lone final cell, where it would otherwise
                // hang half-way across the page with nothing on its right.
                cn("sm:pr-6", i + 1 < items.length && "sm:border-r")
              : "sm:pl-6",
          )}
        >
          <dt className="text-[0.9375rem] font-medium text-balance">{item.title}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Prize categories.
 *
 * `showCriteria` is what separates the detail page from the run panel: the panel is a
 * summary of what landed, so it shows the tracks and their prizes and leaves the
 * paragraph of judging criteria to the page it links to.
 */
export function TrackList({
  tracks,
  showCriteria = false,
}: {
  tracks: Track[];
  showCriteria?: boolean;
}) {
  return (
    <ul className="space-y-2.5">
      {tracks.map((t) => (
        <li key={t.name} className="rounded-xl border bg-card px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                "min-w-0 font-semibold text-balance",
                showCriteria ? "text-base" : "text-sm",
              )}
            >
              {t.name}
            </h3>
            {t.prize ? <PrizeChip>{t.prize}</PrizeChip> : null}
          </div>
          {showCriteria && t.criteria ? (
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              {t.criteria}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The prize, worded as the source page words it.
 *
 * Capped at just over half the row and allowed to wrap, because real prizes are not all
 * "Mac Mini" — one of them is a whole sentence about certificates by email. An
 * unshrinkable chip at that length walks straight out of the card and over whatever sits
 * beside it.
 */
function PrizeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-[55%] shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-right text-xs leading-snug font-medium text-primary">
      {children}
    </span>
  );
}

/** Plain strings — rules and requirements. */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptySection({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

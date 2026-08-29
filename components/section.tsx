import { cn } from "@/lib/utils";

/** A titled block of the hackathon page. Renders nothing when there is nothing stored. */
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
    <section className={cn("border-t py-8 first:border-t-0 first:pt-0", className)}>
      <h2 className="font-heading text-xl tracking-tight">
        {title}
        {count !== undefined ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A `{ title, description }` row — the shape challenge, judging, ideas and practices share. */
export function TitledList({
  items,
}: {
  items: { title: string; description: string }[];
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={`${item.title}-${i}`} className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold text-balance">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </li>
      ))}
    </ul>
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

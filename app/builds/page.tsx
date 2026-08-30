import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { BUILD_STATUS, groupTargets, listBuilds, type BuildRecord } from "@/lib/builds";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Builds" };

/**
 * Work Graft has done.
 *
 * `/hackathons` and `/products` are what it read; this is what it did with it. The
 * three together are the whole claim — learned, remembered, built with.
 */
export default async function BuildsPage() {
  let items: BuildRecord[] = [];
  let dbDown = false;
  try {
    items = await listBuilds();
  } catch {
    dbDown = true;
  }

  const waiting = items.filter((b) => b.status === "proposed").length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 2xl:max-w-7xl">
        <header className="max-w-2xl">
          <h1 className="font-heading text-3xl tracking-tight text-balance">Builds</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            What Graft has done with what it knows. Blocked and failed runs are kept too
            — an attempt that did not work is worth more than no record of it.
          </p>
        </header>

        {dbDown ? (
          <Empty>
            Postgres is unreachable. Start it with <Code>pnpm db:up</Code>.
          </Empty>
        ) : items.length === 0 ? (
          <Empty>
            Nothing built yet. Open <Code>Build</Code>, name a repository and a library
            it already knows.
          </Empty>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted-foreground">
              <Count n={items.length} /> build{items.length === 1 ? "" : "s"}
              {waiting > 0 ? (
                <>
                  {" · "}
                  <Count n={waiting} /> waiting on you
                </>
              ) : null}
              .
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {items.map((b) => (
                <li key={b.slug}>
                  <BuildCard build={b} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}

function BuildCard({ build: b }: { build: BuildRecord }) {
  const status = BUILD_STATUS[b.status] ?? BUILD_STATUS.in_progress!;
  const { repositories, products } = groupTargets(b.targets);

  return (
    <article className="group flex h-full flex-col rounded-2xl border bg-card transition-colors hover:border-foreground/20">
      <Link href={`/builds/${b.slug}`} className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 font-heading text-lg leading-snug font-semibold text-balance">
            {b.title}
          </h2>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", status.className)}>
            {status.label}
          </span>
          <span className="text-muted-foreground">{b.kind}</span>
          <span className="text-muted-foreground">
            {b.updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      </Link>

      {b.targets.length > 0 ? (
        <footer className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t px-5 py-3 text-xs">
          {repositories.map((t) => (
            <span key={t.name} className="font-mono text-muted-foreground">
              {t.name}
            </span>
          ))}
          {products.map((t) => (
            <Link
              key={t.name}
              href={`/products/${t.name}`}
              className="rounded-full bg-muted px-2 py-0.5 font-medium transition-colors hover:bg-accent"
            >
              {t.name}
            </Link>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-semibold text-foreground tabular-nums">{n}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 rounded-2xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { listProducts, type ProductCard as Card } from "@/lib/products";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products" };

/**
 * Everything in the index, on its own terms.
 *
 * `/hackathons` reads the corpus by event; this reads it by product, which is the only
 * view that can show a product belonging to no event at all.
 */
export default async function ProductsPage() {
  let items: Card[] = [];
  let dbDown = false;
  try {
    items = await listProducts();
  } catch {
    dbDown = true;
  }

  const loose = items.filter((p) => p.hackathons.length === 0).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 2xl:max-w-7xl">
        <header className="max-w-2xl">
          <h1 className="font-heading text-3xl tracking-tight text-balance">Products</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every tool Graft has read. Most arrived as a hackathon&apos;s sponsor; a product
            does not need one to be here.
          </p>
        </header>

        {dbDown ? (
          <Empty>
            Postgres is unreachable. Start it with <Code>pnpm db:up</Code>.
          </Empty>
        ) : items.length === 0 ? (
          <Empty>
            Nothing learned yet. Open <Code>Research</Code> and give the agent a hackathon URL,
            or ask it to record a product on its own.
          </Empty>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted-foreground">
              <Count n={items.length} /> product{items.length === 1 ? "" : "s"}
              {loose > 0 ? (
                <>
                  , <Count n={loose} /> of them from no hackathon
                </>
              ) : null}
              .
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
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

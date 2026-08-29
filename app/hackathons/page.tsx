import { SiteHeader } from "@/components/site-header";
import { HackathonCard } from "@/components/hackathon-card";
import { listHackathons, type HackathonCard as Card } from "@/lib/hackathons";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hackathons · WeHelpAgents" };

export default async function HackathonsPage() {
  let items: Card[] = [];
  let dbDown = false;
  try {
    items = await listHackathons();
  } catch {
    dbDown = true;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <header className="max-w-2xl">
          <h1 className="font-heading text-3xl tracking-tight text-balance">Hackathons</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Researched once and stored as structured records — the same rows the MCP server
            hands to any agent you point at it.
          </p>
        </header>

        {dbDown ? (
          <Empty>
            Postgres is unreachable. Start it with <Code>pnpm db:up</Code>.
          </Empty>
        ) : items.length === 0 ? (
          <Empty>
            Nothing stored yet. Open <Code>Research</Code> and give the agent a hackathon URL.
          </Empty>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {items.map((h) => (
              <HackathonCard key={h.slug} hackathon={h} />
            ))}
          </div>
        )}
      </main>
    </>
  );
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

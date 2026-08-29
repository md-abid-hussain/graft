import Link from "next/link";
import { ArrowRight, Database, MessageSquare, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { listHackathons } from "@/lib/hackathons";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The pitch.
 *
 * Counts come from the corpus rather than being written in, so the page cannot claim
 * more than the database actually holds.
 */
export default async function Page() {
  let stored = 0;
  let sponsors = 0;
  try {
    const items = await listHackathons();
    stored = items.length;
    sponsors = new Set(items.flatMap((h) => h.sponsors.map((s) => s.slug))).size;
  } catch {
    // The landing page still reads fine without the corpus.
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-5">
        <section className="border-b py-20 sm:py-28">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">
            Research once · serve every agent
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Stop pasting hackathon pages into your coding agent.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Every participant burns context on the same pages — the rules, the tracks, the
            sponsor&apos;s docs. WeHelpAgents researches a hackathon once, stores it as
            structured records, and serves them over MCP so the schema is the contract.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/hackathons" className={cn(buttonVariants(), "rounded-full")}>
              Browse hackathons
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ui/run"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              Research a new one
            </Link>
          </div>

          {stored > 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{stored}</span>{" "}
              hackathon{stored === 1 ? "" : "s"} and{" "}
              <span className="font-semibold text-foreground tabular-nums">{sponsors}</span>{" "}
              sponsor product{sponsors === 1 ? "" : "s"} in the corpus.
            </p>
          ) : null}
        </section>

        <section className="grid gap-px overflow-hidden rounded-2xl border bg-border py-0 sm:grid-cols-3">
          <Step
            icon={<Search className="size-4" />}
            title="Research"
            body="A TrueForge agent reads the hackathon page and the sponsor's docs, then pauses for your approval before it writes anything."
          />
          <Step
            icon={<Database className="size-4" />}
            title="Store"
            body="Tracks, judging criteria, rules and requirements land as typed columns — not prose an agent has to re-read every session."
          />
          <Step
            icon={<MessageSquare className="size-4" />}
            title="Serve"
            body="One MCP server exposes it all. Point any agent at it and the schema tells it what it can ask for."
          />
        </section>

        <footer className="py-10 text-xs text-muted-foreground">
          Built for The Agent Harness Hackathon · WeMakeDevs × TrueFoundry × Qodo
        </footer>
      </main>
    </>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-background p-6">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h2 className="mt-3 font-heading text-base font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

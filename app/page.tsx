import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  AgentsSection,
  McpSection,
  ProblemSection,
  TrueForgeSection,
  WhatThisIsSection,
} from "@/components/landing-sections";
import { buttonVariants } from "@/components/ui/button";
import { HeroEvidence } from "@/components/hero-evidence";
import { countBuilds } from "@/lib/builds";
import { listHackathons } from "@/lib/hackathons";
import { countProducts } from "@/lib/products";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The pitch, argued in order: the problem, what this is, the surface it exposes, and
 * where the harness sits.
 *
 * Counts come from the index rather than being written in, so the page cannot claim
 * more than the database actually holds — and reads zero honestly on a fresh install.
 */
export default async function Page() {
  let hackathons = 0;
  let tools = 0;
  let runs = 0;
  try {
    // Counted from the products table, not from the hackathons' sponsor lists: a
    // product does not need a hackathon, and deriving the number through the join
    // silently left those out of the headline. `countProducts` rather than
    // `listProducts` — this page renders one integer, not the cards.
    //
    // For the same reason the line below is gated on the product count: a corpus with
    // products and no events still has something to report.
    const [events, productCount, buildCount] = await Promise.all([
      listHackathons(),
      countProducts(),
      countBuilds(),
    ]);
    hackathons = events.length;
    tools = productCount;
    runs = buildCount;
  } catch {
    // The landing page still reads without the index.
  }

  return (
    <>
      <SiteHeader />

      <main className="landing-bg mx-auto w-full max-w-6xl px-5 2xl:max-w-7xl">
        <section className="py-16 sm:py-24 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-16">
          <div>
            <p className="font-mono text-xs tracking-widest text-primary uppercase">
              An agent memory on the TrueForge harness
            </p>

            <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-[1.1] sm:text-5xl">
              <span className="block text-balance">Learns with you at one hackathon.</span>
              <span className="block text-balance">Builds with you at the next.</span>
            </h1>

            <div className="mt-6 max-w-xl space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                You met SigNoz at one hackathon and Cognee at the next. Your agent met them too
                — and forgot both when the session closed. Graft reads each stack properly
                once, into a cited index it keeps — then puts it to work: your repository, a
                sandboxed change, your own test suite.
              </p>
              <p className="text-foreground">
                You review a diff that already passes. Every write pauses for you first.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/hackathons" className={cn(buttonVariants(), "rounded-full")}>
                What it knows
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/research"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
              >
                Research a stack
              </Link>
            </div>

            {tools > 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                <Count n={tools} /> tool{tools === 1 ? "" : "s"} learned
                {hackathons > 0 ? (
                  <>
                    {" \u00b7 "}
                    <Count n={hackathons} /> hackathon{hackathons === 1 ? "" : "s"} on record
                  </>
                ) : null}
                {runs > 0 ? (
                  <>
                    {" \u00b7 "}
                    <Count n={runs} /> build{runs === 1 ? "" : "s"} recorded
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="mt-14 lg:mt-0">
            <HeroEvidence />
          </div>
        </section>

        <ProblemSection />
        <WhatThisIsSection />
        <AgentsSection />
        <McpSection />
        <TrueForgeSection />

        <footer className="border-t py-10 text-xs text-muted-foreground">
          Built for The Agent Harness Hackathon · WeMakeDevs × TrueFoundry × Qodo
        </footer>
      </main>
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-semibold text-foreground tabular-nums">{n}</span>;
}

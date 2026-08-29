import Link from "next/link";
import { ArrowRight, BookOpen, Brain, GitPullRequest } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { listHackathons } from "@/lib/hackathons";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The pitch.
 *
 * Counts come from the corpus rather than being written in, so the page cannot claim
 * more than the database actually holds — and reads zero honestly on a fresh install.
 */
export default async function Page() {
  let hackathons = 0;
  let products = 0;
  try {
    const items = await listHackathons();
    hackathons = items.length;
    const sponsors = items.flatMap((h) => h.sponsors);
    products = new Set(sponsors.map((s) => s.slug)).size;
  } catch {
    // The landing page still reads fine without the corpus.
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-5">
        <section className="py-20 sm:py-28">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">
            For people who do a lot of hackathons
          </p>

          <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Learns with you at one. Builds with you at the next.
          </h1>

          <div className="mt-6 max-w-xl space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              You met SigNoz at one hackathon and Cognee at the next. Your coding agent
              met them too — and forgot both when the session closed. So every time you
              reach for one again, you paste the same documentation and start over.
            </p>
            <p>
              Graft doesn&apos;t. It reads each stack properly the first time, into an
              index it keeps. When you need one of them again it already knows it — so
              it reads your repository, writes the integration in a sandbox, and runs
              your own test suite against it.
            </p>
            <p className="text-foreground">
              You review a diff that already passes.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/hackathons" className={cn(buttonVariants(), "rounded-full")}>
              What it knows
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ui/run"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              Teach it a hackathon
            </Link>
          </div>

          {hackathons > 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              <Count n={products} /> tool{products === 1 ? "" : "s"} learned across{" "}
              <Count n={hackathons} /> hackathon{hackathons === 1 ? "" : "s"}.
            </p>
          ) : null}
        </section>

        <section className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          <Step
            icon={<BookOpen className="size-4" />}
            title="It learns with you"
            body="While you work through a hackathon, it reads that stack from its own documentation — the event, its sponsors, their docs — and keeps what it found, cited."
          />
          <Step
            icon={<Brain className="size-4" />}
            title="It remembers"
            body="The next hackathon does not start from zero. What it learned in March is still there in June, and it never re-reads a page it has already indexed."
          />
          <Step
            icon={<GitPullRequest className="size-4" />}
            title="It builds with you"
            body="Ask it to add something it knows. It reads your repository, writes the change in a sandbox, runs your tests, and opens a pull request you approve."
          />
        </section>

        <footer className="mt-12 border-t py-8 text-xs text-muted-foreground">
          Built for The Agent Harness Hackathon · WeMakeDevs × TrueFoundry × Qodo
        </footer>
      </main>
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-semibold text-foreground tabular-nums">{n}</span>;
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

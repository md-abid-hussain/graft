"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, DatabaseZap, Loader2, MessageSquare, Trophy } from "lucide-react";
import { Section, TitledList } from "@/components/section";
import { SponsorMark } from "@/components/sponsor-mark";
import type { HackathonDetail } from "@/lib/hackathons";
import { cn } from "@/lib/utils";

/**
 * What the conversation next door has actually stored.
 *
 * Reads the record from Postgres rather than replaying the chat, so this shows what an
 * agent querying the corpus would get — the point of the whole project. It fills in as
 * each write clears the approval gate, which is why it polls rather than loading once.
 */

type Payload = {
  slug: string | null;
  hackathon: HackathonDetail | null;
  products: string[];
  /** Set when the corpus could not be read — a missing record, not a pending one. */
  dbDown?: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  upcoming: "bg-primary/12 text-primary",
  past: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export function RunSubject({ sessionId }: { sessionId?: string }) {
  const [data, setData] = useState<Payload | null>(null);

  // Keyed on the session by its parent, so switching conversations remounts this and
  // no stale record has to be cleared out from inside the effect.
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        setData((await res.json()) as Payload);
      } catch {
        // A dropped poll is not worth surfacing; the next one will land.
      }
    };

    void load();
    // Writes land one approval at a time, so keep checking while the run is open.
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <Placeholder icon={<MessageSquare className="size-5" />} title="No run open">
        Start a chat and give the agent a hackathon URL. What it stores will appear here.
      </Placeholder>
    );
  }

  if (!data) {
    return (
      <Placeholder icon={<Loader2 className="size-5 animate-spin" />} title="Reading the run">
        Checking what this session has stored.
      </Placeholder>
    );
  }

  // Checked before the approval state: an unreadable database also arrives as a null
  // record, and telling the operator to go and approve something would send them
  // looking for a gate that is not there.
  if (data.dbDown) {
    return (
      <Placeholder icon={<DatabaseZap className="size-5" />} title="Corpus unreachable">
        Postgres is not responding, so what this run stored cannot be read. The run
        itself is unaffected — start it with <Mono>pnpm db:up</Mono>.
      </Placeholder>
    );
  }

  if (!data.hackathon) {
    return (
      <Placeholder
        icon={<Trophy className="size-5" />}
        title={data.slug ? "Waiting on approval" : "Nothing stored yet"}
      >
        {data.slug ? (
          <>
            The agent drafted <Mono>{data.slug}</Mono> but it is not in the corpus yet.
            Approve <Mono>save_hackathon</Mono> in the chat and it appears here.
          </>
        ) : (
          <>The preview appears once the agent stores the hackathon.</>
        )}
      </Placeholder>
    );
  }

  const h = data.hackathon;

  return (
    <div className="min-w-0">
      <header className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium capitalize",
              STATUS_STYLE[h.status] ?? STATUS_STYLE.unknown,
            )}
          >
            {h.status}
          </span>
          {h.mode ? <span className="text-muted-foreground capitalize">{h.mode}</span> : null}
          <Link
            href={`/hackathons/${h.slug}`}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            Full page
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <h2 className="mt-2 font-heading text-xl leading-snug tracking-tight text-balance">
          {h.title}
        </h2>
        {h.tagline ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.tagline}</p>
        ) : null}
      </header>

      <div className="px-5 pb-8">
        {h.tracks.length > 0 ? (
          <Section title="Tracks &amp; prizes" count={h.tracks.length}>
            <ul className="space-y-2">
              {h.tracks.map((t) => (
                <li key={t.name} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-balance">{t.name}</h3>
                    {t.prize ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Trophy className="size-3" />
                        {t.prize}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {h.challenge.length > 0 ? (
          <Section title="The challenge" count={h.challenge.length}>
            <TitledList items={h.challenge} />
          </Section>
        ) : null}

        {h.judging.length > 0 ? (
          <Section title="Judging" count={h.judging.length}>
            <TitledList items={h.judging} />
          </Section>
        ) : null}

        <Section title="Sponsors" count={h.sponsors.length || undefined}>
          {h.sponsors.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              {data.products.length > 0
                ? "Drafted, waiting on approval in the chat."
                : "Researching sponsors…"}
            </p>
          ) : (
            <ul className="space-y-2">
              {h.sponsors.map((s) => (
                <li
                  key={s.slug}
                  className="flex items-start gap-2.5 rounded-xl border bg-card p-3"
                >
                  <SponsorMark name={s.name} homepageUrl={s.homepageUrl} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                    {s.sources.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {s.sources.reduce((n, src) => n + (src.chunkCount ?? 0), 0)} chunks
                        indexed
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Coverage hackathon={h} />
      </div>
    </div>
  );
}

/** The rest of what landed, as counts — the detail lives on the full page. */
function Coverage({ hackathon: h }: { hackathon: HackathonDetail }) {
  const items = [
    { label: "rules", n: h.rules.length },
    { label: "requirements", n: h.requirements.length },
    { label: "ideas", n: h.projectIdeas.length },
    { label: "practices", n: h.bestPractices.length },
  ].filter((i) => i.n > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label}>
          <span className="font-semibold text-foreground tabular-nums">{i.n}</span> {i.label}
        </span>
      ))}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 font-mono text-[0.6875rem]">{children}</code>;
}

function Placeholder({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <span className="text-muted-foreground/50">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, DatabaseZap, Hammer, Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Section } from "@/components/section";
import type { Build, BuildTarget } from "@/lib/db/schema";
import { cn, safeHref } from "@/lib/utils";

/**
 * What the conversation next door has published.
 *
 * The mirror of `RunSubject`: research shows the record it wrote to the corpus, build
 * shows the record it wrote about itself. Same polling, same reason — the write sits
 * behind an approval gate, so this fills in when a person lets it.
 */

type Payload = {
  slug: string | null;
  build: (Omit<Build, "createdAt" | "updatedAt"> & { updatedAt: string }) | null;
  dbDown?: boolean;
};

const STATUS: Record<string, { label: string; className: string }> = {
  in_progress: { label: "in progress", className: "bg-primary/12 text-primary" },
  proposed: {
    label: "waiting on you",
    className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  },
  done: { label: "done", className: "bg-muted text-muted-foreground" },
  blocked: { label: "blocked", className: "bg-muted text-muted-foreground" },
  failed: { label: "failed", className: "bg-destructive/12 text-destructive" },
};

export function BuildSubject({ sessionId }: { sessionId?: string }) {
  const [data, setData] = useState<Payload | null>(null);

  // Keyed on the session by its parent, so switching conversations remounts this and
  // no stale record has to be cleared out from inside the effect.
  //
  // Self-scheduling rather than an interval, because the two outcomes cost very
  // different amounts. Finding the build stops the server's scan on the first page;
  // NOT finding it walks back through the whole session before it can say so. A tab
  // left open on a conversation that never publishes would otherwise pay that walk
  // every four seconds forever, so an unproductive poll backs off.
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let empty = 0;

    const load = async () => {
      let found = false;
      try {
        const res = await fetch(`/api/session/${sessionId}/build`, { cache: "no-store" });
        if (res.ok && !cancelled) {
          const next = (await res.json()) as Payload;
          setData(next);
          found = Boolean(next.build);
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one will land.
      }
      if (cancelled) return;

      empty = found ? 0 : empty + 1;
      // Keep watching after it lands: a run publishes `in_progress` and re-saves the
      // result, so the record still changes under us.
      timer = setTimeout(load, found ? 10_000 : empty > 15 ? 20_000 : 4_000);
    };

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <Placeholder icon={<Hammer className="size-5" />} title="Nothing open">
        Start a chat, name a repository and a library it already knows, and what it builds will
        appear here.
      </Placeholder>
    );
  }

  if (!data) {
    return (
      <Placeholder icon={<Loader2 className="size-5 animate-spin" />} title="Catching up">
        Checking what this session has published.
      </Placeholder>
    );
  }

  if (data.dbDown) {
    return (
      <Placeholder icon={<DatabaseZap className="size-5" />} title="Index unreachable">
        Postgres is not responding, so the record cannot be read. The run itself is unaffected
        — start it with <Mono>pnpm db:up</Mono>.
      </Placeholder>
    );
  }

  if (!data.build) {
    return (
      <Placeholder
        icon={<Hammer className="size-5" />}
        title={data.slug ? "Waiting on approval" : "Nothing published yet"}
      >
        {data.slug ? (
          <>
            The agent drafted <Mono>{data.slug}</Mono> but it is not stored yet. Approve{" "}
            <Mono>save_build</Mono> in the chat and it appears here.
          </>
        ) : (
          <>
            This fills in when the agent publishes what it did. It records blocked and failed
            runs too, not only successful ones.
          </>
        )}
      </Placeholder>
    );
  }

  const b = data.build;
  const status = STATUS[b.status] ?? STATUS.in_progress!;

  return (
    <div className="min-w-0">
      <header className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", status.className)}>
            {status.label}
          </span>
          <span className="text-muted-foreground">{b.kind}</span>
          <Link
            href={`/builds/${b.slug}`}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            Full page
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <h2 className="mt-2 font-heading text-xl leading-snug tracking-tight text-balance">
          {b.title}
        </h2>
      </header>

      <div className="px-5 pb-8">
        {b.targets.length > 0 ? (
          <Section title="Worked on" count={b.targets.length}>
            <TargetList targets={b.targets} />
          </Section>
        ) : null}

        {b.summary ? (
          <Section title="What it did">
            <Markdown>{b.summary}</Markdown>
          </Section>
        ) : null}

        <Evidence details={b.details} />
      </div>
    </div>
  );
}

/** Targets, as a reader uses them: a name, what was done to it, and a way through. */
export function TargetList({ targets }: { targets: BuildTarget[] }) {
  return (
    <ul className="space-y-2">
      {targets.map((t, i) => {
        const href =
          t.type === "product" ? `/products/${t.name}` : (safeHref(t.url ?? "") ?? null);
        const external = t.type !== "product";

        return (
          <li key={`${t.name}-${i}`} className="rounded-xl border bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* `inline-flex` sizes to its content, so without `max-w-full` the link
                    ignores the panel's width entirely. Wrapping rather than truncating:
                    half an `owner/repo` identifies nothing. */}
                {href ? (
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="inline-flex max-w-full items-baseline gap-1 text-sm font-semibold [overflow-wrap:anywhere] hover:underline"
                  >
                    <span>{t.name}</span>
                    {external ? (
                      <ArrowUpRight className="size-3 shrink-0 self-center" />
                    ) : null}
                  </a>
                ) : (
                  <span className="text-sm font-semibold [overflow-wrap:anywhere]">
                    {t.name}
                  </span>
                )}
                {t.note ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t.note}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                {t.type}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The structured leftovers.
 *
 * `details` is free-form by design, so this renders whatever is there rather than
 * naming fields it hopes exist — a scaffold and an integration do not report the same
 * evidence, and a panel that only understood one of them would show blanks for the
 * other. Long values get their own scroll box; a test log is not a caption.
 */
export function Evidence({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details ?? {});
  if (entries.length === 0) return null;

  return (
    <Section title="Evidence" count={entries.length}>
      <dl className="space-y-3">
        {entries.map(([key, value]) => {
          const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
          const long = text.length > 80 || text.includes("\n");
          const urls = typeof value === "string" ? asUrlList(value) : null;

          return (
            <div key={key}>
              <dt className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
                {key}
              </dt>
              <dd className="mt-1 min-w-0">
                {urls ? (
                  <ul className="space-y-1">
                    {urls.map((u) => (
                      <li key={u}>
                        {/* Wrapping, not truncating: a pull request URL cut to fit a
                            26rem panel cannot be checked before it is clicked. */}
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-baseline gap-1 text-sm [overflow-wrap:anywhere] text-primary hover:underline"
                        >
                          <span>{u}</span>
                          <ArrowUpRight className="size-3 shrink-0 self-center" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : long ? (
                  <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-2.5 font-mono text-xs leading-relaxed">
                    {text}
                  </pre>
                ) : (
                  <span className="text-sm [overflow-wrap:anywhere]">{text}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

/**
 * A value that is one URL, or several.
 *
 * `details` is free-form, and agents write link lists as a single comma-separated
 * string — a real run stored three pull request URLs that way. Handing the whole string
 * to `safeHref` produced one anchor whose path contained the other two: it looked like
 * a link and went nowhere. Every part has to validate on its own, or this is not a link
 * at all.
 */
function asUrlList(value: string): string[] | null {
  const parts = value.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return null;

  const safe = parts.map((p) => safeHref(p));
  return safe.every((u): u is string => Boolean(u)) ? safe : null;
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

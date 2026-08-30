import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { ProductLinks } from "@/components/product-links";
import { SponsorMark } from "@/components/sponsor-mark";
import type { HackathonCard as Card } from "@/lib/hackathons";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  upcoming: "bg-primary/12 text-primary",
  past: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export function HackathonCard({ hackathon: h }: { hackathon: Card }) {
  // Dates are frequently absent on the source pages, so the card leads with what is
  // always there — status and mode — instead of leaving a hole where a date would be.
  const when = formatWindow(h.startsAt, h.endsAt);

  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card transition-colors hover:border-foreground/20">
      <Link href={`/hackathons/${h.slug}`} className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
              {h.title}
            </h2>
            {h.tagline ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {h.tagline}
              </p>
            ) : null}
          </div>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium capitalize",
              STATUS_STYLE[h.status] ?? STATUS_STYLE.unknown,
            )}
          >
            {h.status}
          </span>
          {h.mode ? <span className="text-muted-foreground capitalize">{h.mode}</span> : null}
          {h.location ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" />
              <span className="max-w-40 truncate">{h.location}</span>
            </span>
          ) : null}
          {when ? <span className="text-muted-foreground">{when}</span> : null}
        </div>

        <Coverage counts={h.counts} />
      </Link>

      {h.sponsors.length > 0 ? (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
          {h.sponsors.map((s) => (
            <div key={s.slug} className="flex min-w-0 items-center gap-2">
              <SponsorMark name={s.name} homepageUrl={s.homepageUrl} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{s.name}</span>
                <span className="block truncate text-[0.6875rem] text-muted-foreground">
                  {s.category}
                </span>
              </span>
              <ProductLinks
                name={s.name}
                homepageUrl={s.homepageUrl}
                githubUrl={s.githubUrl}
                socials={s.socials as Record<string, string | undefined>}
              />
            </div>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

/** What the corpus actually holds for this hackathon, at a glance. */
function Coverage({ counts }: { counts: Card["counts"] }) {
  const items = [
    { label: "tracks", n: counts.tracks },
    { label: "challenges", n: counts.challenge },
    { label: "criteria", n: counts.judging },
    { label: "ideas", n: counts.projectIdeas },
    { label: "rules", n: counts.rules },
    { label: "requirements", n: counts.requirements },
  ].filter((i) => i.n > 0);

  if (items.length === 0) {
    return <p className="mt-4 text-xs text-muted-foreground">No sections stored yet.</p>;
  }

  return (
    <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline gap-1">
          <dt className="sr-only">{i.label}</dt>
          <dd className="text-sm font-semibold tabular-nums">{i.n}</dd>
          <span className="text-xs text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </dl>
  );
}

function formatWindow(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return null;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  return fmt((startsAt ?? endsAt) as Date);
}

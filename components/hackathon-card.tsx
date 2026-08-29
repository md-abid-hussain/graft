import Link from "next/link";
import { ArrowUpRight, Globe, MapPin } from "lucide-react";
import { SponsorMark } from "@/components/sponsor-mark";
import type { HackathonCard as Card } from "@/lib/hackathons";
import { cn } from "@/lib/utils";

/** Socials are stored per product; only these three ever appear in practice. */
const SOCIALS = [
  { key: "x", label: "X", Icon: XIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon },
  { key: "youtube", label: "YouTube", Icon: YoutubeIcon },
] as const;

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
              <span className="flex items-center gap-0.5">
                {s.homepageUrl ? (
                  <IconLink href={s.homepageUrl} label={`${s.name} homepage`}>
                    <Globe className="size-3.5" />
                  </IconLink>
                ) : null}
                {s.githubUrl ? (
                  <IconLink href={s.githubUrl} label={`${s.name} on GitHub`}>
                    <GithubIcon className="size-3.5" />
                  </IconLink>
                ) : null}
                {SOCIALS.map(({ key, label, Icon }) => {
                  const href = (s.socials as Record<string, string | undefined>)[key];
                  return href ? (
                    <IconLink key={key} href={href} label={`${s.name} on ${label}`}>
                      <Icon className="size-3.5" />
                    </IconLink>
                  ) : null;
                })}
              </span>
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

/** Sits inside the card's link, so it stops the click from following the card. */
function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </a>
  );
}

/** Brand marks, inline: lucide-react v1 removed its brand icon set. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.9 2H22l-7.3 8.4L23 22h-6.7l-5.2-6.9L5.1 22H2l7.8-9L1.5 2h6.9l4.7 6.3L18.9 2Zm-1.1 18h1.7L7.3 3.7H5.5L17.8 20Z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.6h.1a4.2 4.2 0 0 1 3.8-2.1c4 0 4.8 2.6 4.8 6.1V21h-4v-5.6c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21h-4V9Z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M23.5 6.8a3 3 0 0 0-2.1-2.1C19.5 4.2 12 4.2 12 4.2s-7.5 0-9.4.5A3 3 0 0 0 .5 6.8C0 8.7 0 12 0 12s0 3.3.5 5.2a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.2.5-5.2s0-3.3-.5-5.2ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}

function formatWindow(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  return fmt((startsAt ?? endsAt) as Date);
}

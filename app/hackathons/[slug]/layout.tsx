import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SponsorMark } from "@/components/sponsor-mark";
import { buttonVariants } from "@/components/ui/button";
import { getHackathon, sectionsFor } from "@/lib/hackathons";
import { cn, safeHref } from "@/lib/utils";
import { SubNav } from "./sub-nav";

export const dynamic = "force-dynamic";

/** The tab should name the hackathon being read, not just the section. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  return h ? { title: h.title, description: h.tagline ?? undefined } : { title: "Not found" };
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  upcoming: "bg-primary/12 text-primary",
  past: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

/**
 * The shell every hackathon page shares.
 *
 * Sub-pages mirror the WeMakeDevs layout participants already know — overview, rules,
 * schedule, resources — so the same URL shape works whether they read it there or here.
 */
export default async function HackathonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  if (!h) notFound();

  return (
    <>
      <SiteHeader />

      <div className="border-b">
        <div className="mx-auto w-full max-w-4xl px-5 pt-10 pb-0">
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
            {h.location ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-3" />
                {h.location}
              </span>
            ) : null}
            {h.startsAt ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="size-3" />
                {h.startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 font-heading text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
            {h.title}
          </h1>
          {h.tagline ? (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {h.tagline}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {safeHref(h.registrationUrl) ? (
              <a
                href={safeHref(h.registrationUrl)}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                Register
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : null}
            {safeHref(h.sourceUrl) ? (
              <a
                href={safeHref(h.sourceUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Original page
                <ArrowUpRight className="size-3" />
              </a>
            ) : null}
            {h.sponsors.length > 0 ? (
              <span className="ml-auto flex items-center gap-2">
                {h.sponsors.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/hackathons/${slug}/resources`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <SponsorMark name={s.name} homepageUrl={s.homepageUrl} />
                    {s.name}
                  </Link>
                ))}
              </span>
            ) : null}
          </div>

          <SubNav slug={slug} sections={sectionsFor(h)} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-5 py-10">{children}</main>
    </>
  );
}

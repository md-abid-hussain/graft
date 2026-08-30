import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen, FileText, Globe } from "lucide-react";
import { Section, TitledList } from "@/components/section";
import { SponsorMark } from "@/components/sponsor-mark";
import { getHackathon, sectionsFor } from "@/lib/hackathons";
import { safeHref } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  if (!h) notFound();

  if (!sectionsFor(h).resources) notFound();

  return (
    <div>
      {h.sponsors.length > 0 ? (
        <Section title="Sponsors" count={h.sponsors.length}>
          <ul className="space-y-3">
            {h.sponsors.map((s) => (
              <li key={s.slug} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <SponsorMark name={s.name} homepageUrl={s.homepageUrl} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">
                      {s.name}
                      {s.company && s.company !== s.name ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          by {s.company}
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-xs text-muted-foreground">{s.category}</p>
                    {s.summary ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {s.summary}
                      </p>
                    ) : null}
                    {s.notes ? (
                      <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed">
                        {s.notes}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.homepageUrl ? (
                        <ResourceLink
                          href={s.homepageUrl}
                          icon={<Globe className="size-3.5" />}
                        >
                          Homepage
                        </ResourceLink>
                      ) : null}
                      {s.docsUrl ? (
                        <ResourceLink
                          href={s.docsUrl}
                          icon={<BookOpen className="size-3.5" />}
                        >
                          Docs
                        </ResourceLink>
                      ) : null}
                      {s.githubUrl ? (
                        <ResourceLink
                          href={s.githubUrl}
                          icon={<FileText className="size-3.5" />}
                        >
                          GitHub
                        </ResourceLink>
                      ) : null}
                    </div>

                    {s.sources.length > 0 ? (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                          Ingested for search
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {s.sources.map((src) => (
                            <li
                              key={src.id}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <FileText className="size-3 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {src.title ?? src.url}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {src.chunkCount ? `${src.chunkCount} chunks` : src.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {h.projectIdeas.length > 0 ? (
        <Section title="Project ideas" count={h.projectIdeas.length}>
          <TitledList items={h.projectIdeas} />
        </Section>
      ) : null}

      {h.bestPractices.length > 0 ? (
        <Section title="Best practices" count={h.bestPractices.length}>
          <TitledList items={h.bestPractices} />
        </Section>
      ) : null}
    </div>
  );
}

function ResourceLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const safe = safeHref(href);
  if (!safe) return null;

  return (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
    >
      {icon}
      {children}
      <ArrowUpRight className="size-3 text-muted-foreground" />
    </a>
  );
}

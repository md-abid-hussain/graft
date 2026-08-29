import { notFound, redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { EmptySection, Section, TitledList } from "@/components/section";
import { getHackathon, sectionsFor } from "@/lib/hackathons";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  if (!h) notFound();

  // Every card links here, so a record whose only content lives under Rules or
  // Resources would otherwise open on an empty page with no way onward.
  const sections = sectionsFor(h);
  if (!sections.overview) {
    const elsewhere = (["rules", "schedule", "resources"] as const).find((k) => sections[k]);
    if (elsewhere) redirect(`/hackathons/${slug}/${elsewhere}`);

    return (
      <EmptySection>
        Nothing stored for this hackathon beyond its title. Re-run research to fill it in.
      </EmptySection>
    );
  }

  return (
    <div className="space-y-0">
      {h.description ? (
        <Section title="About">
          <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {h.description}
          </p>
        </Section>
      ) : null}

      {h.challenge.length > 0 ? (
        <Section title="The challenge" count={h.challenge.length}>
          <TitledList items={h.challenge} />
        </Section>
      ) : null}

      {h.tracks.length > 0 ? (
        <Section title="Tracks & prizes" count={h.tracks.length}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {h.tracks.map((t) => (
              <li key={t.name} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-balance">{t.name}</h3>
                  {t.prize ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Trophy className="size-3" />
                      {t.prize}
                    </span>
                  ) : null}
                </div>
                {t.criteria ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t.criteria}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {h.judging.length > 0 ? (
        <Section title="Judging criteria" count={h.judging.length}>
          <TitledList items={h.judging} />
        </Section>
      ) : null}
    </div>
  );
}

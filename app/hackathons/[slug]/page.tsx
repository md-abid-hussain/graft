import { notFound, redirect } from "next/navigation";
import { EmptySection, Section, TitledList, TrackList } from "@/components/section";
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
          <p className="max-w-[66ch] text-base leading-relaxed whitespace-pre-wrap text-foreground/85">
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
          <TrackList tracks={h.tracks} showCriteria />
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

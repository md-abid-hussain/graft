import { notFound } from "next/navigation";
import { CheckList, Section } from "@/components/section";
import { getHackathon, sectionsFor } from "@/lib/hackathons";

export const dynamic = "force-dynamic";

export default async function RulesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  if (!h) notFound();

  // The tab is not offered when there is nothing here, so reaching this URL directly
  // is a 404 rather than an empty page.
  if (!sectionsFor(h).rules) notFound();

  return (
    <div>
      {h.requirements.length > 0 ? (
        <Section title="Every submission needs" count={h.requirements.length}>
          <CheckList items={h.requirements} />
        </Section>
      ) : null}

      {h.rules.length > 0 ? (
        <Section title="Rules" count={h.rules.length}>
          <CheckList items={h.rules} />
        </Section>
      ) : null}
    </div>
  );
}

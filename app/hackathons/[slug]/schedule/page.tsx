import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Section } from "@/components/section";
import { getHackathon, sectionsFor } from "@/lib/hackathons";

export const dynamic = "force-dynamic";

const when = (d: Date, tz: string | null) =>
  d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = await getHackathon(slug);
  if (!h) notFound();

  // Most WeMakeDevs pages publish no machine-readable dates, so this tab only exists
  // for the minority that do.
  if (!sectionsFor(h).schedule) notFound();

  return (
    <Section title="Schedule">
      <ol className="space-y-4">
        {[
          { label: "Starts", at: h.startsAt },
          { label: "Ends", at: h.endsAt },
        ]
          .filter((e): e is { label: string; at: Date } => Boolean(e.at))
          .map((e) => (
            <li key={e.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{e.label}</span>
                <span className="block text-sm text-muted-foreground">
                  {when(e.at, h.timezone)}
                </span>
              </span>
            </li>
          ))}
      </ol>
      {h.timezone ? (
        <p className="mt-4 text-xs text-muted-foreground">Times shown in {h.timezone}.</p>
      ) : null}
    </Section>
  );
}

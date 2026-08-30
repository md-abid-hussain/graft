import { notFound } from "next/navigation";
import { Evidence, TargetList } from "@/components/build-subject";
import { Markdown } from "@/components/markdown";
import { Section } from "@/components/section";
import { SiteHeader } from "@/components/site-header";
import { BUILD_STATUS, getBuild } from "@/lib/builds";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBuild(slug);
  return b ? { title: b.title } : { title: "Not found" };
}

/**
 * One build, in full.
 *
 * The panel beside a live chat shows the same record, but this is the one with a URL —
 * which is the point of publishing rather than parsing a transcript. A conversation
 * ends; this can be linked, revisited, and found from the products it names.
 */
export default async function BuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBuild(slug);
  if (!b) notFound();

  const status = BUILD_STATUS[b.status] ?? BUILD_STATUS.in_progress!;

  return (
    <>
      <SiteHeader />

      <div className="border-b">
        <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-8 2xl:max-w-7xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", status.className)}>
              {status.label}
            </span>
            <span className="text-muted-foreground">{b.kind}</span>
            <span className="text-muted-foreground">
              {b.updatedAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          <h1 className="mt-3 font-heading text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
            {b.title}
          </h1>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-10 2xl:max-w-7xl">
        <div className="space-y-0">
          {b.targets.length > 0 ? (
            <Section title="Worked on" count={b.targets.length}>
              <TargetList targets={b.targets} />
            </Section>
          ) : null}

          {b.summary ? (
            <Section title="What it did">
              <div className="max-w-[68ch]">
                <Markdown>{b.summary}</Markdown>
              </div>
            </Section>
          ) : null}

          <Evidence details={b.details} />
        </div>
      </main>
    </>
  );
}

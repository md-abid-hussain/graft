"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview", key: "overview" },
  { segment: "rules", label: "Rules", key: "rules" },
  { segment: "schedule", label: "Schedule", key: "schedule" },
  { segment: "resources", label: "Resources", key: "resources" },
] as const;

/** Only tabs the record can fill are rendered, so none of them lead to an empty page. */
export function SubNav({
  slug,
  sections,
}: {
  slug: string;
  sections: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const base = `/hackathons/${slug}`;
  const visible = TABS.filter((t) => sections[t.key]);

  // A single tab is not navigation, it is a label.
  if (visible.length < 2) return <div className="mt-7" />;

  return (
    <nav className="mt-7 flex gap-1 overflow-x-auto">
      {visible.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

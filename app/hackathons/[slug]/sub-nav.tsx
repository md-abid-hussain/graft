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

  // A lone Overview tab is a label, not navigation — the card already lands there.
  // A lone Rules or Resources tab is the only route to content the base page does not
  // show, so it has to stay clickable.
  if (visible.length === 0 || (visible.length === 1 && visible[0].key === "overview")) {
    return <div className="mt-7" />;
  }

  return (
    // `overflow-y-hidden` is load-bearing. `overflow-x: auto` alone computes the other
    // axis to `auto` as well, and the tabs' `-mb-px` overlap leaves exactly one pixel of
    // vertical overflow — enough for Chrome to hang a full vertical scrollbar off the
    // right of the tab strip.
    <nav className="mt-7 flex gap-1 overflow-x-auto overflow-y-hidden">
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

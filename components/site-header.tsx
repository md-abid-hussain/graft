import Link from "next/link";
import { Sprout } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/hackathons", label: "Hackathons" },
  { href: "/research", label: "Research" },
  { href: "/docs", label: "Ask the docs" },
];

const REPO = "https://github.com/md-abid-hussain/we-help-agents";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      {/* Held to the same width as the pages below it. A header wider than its own page
          leaves the nav and the button hanging outside the content column. */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5 2xl:max-w-7xl">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* A graft is a shoot joined to a rootstock — the mark is the shoot. */}
          <Sprout className="size-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Graft</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            GitHub
          </a>
          <ThemeToggle />
          <Link
            href="/hackathons"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
          >
            What it knows
          </Link>
        </div>
      </div>
    </header>
  );
}

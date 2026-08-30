import Link from "next/link";
import { Hammer, MessagesSquare, Sprout, Telescope } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The header holds two different kinds of destination, and they are not peers.
 *
 * `BROWSE` reads the index — pages that show what Graft already knows. `START` opens a
 * live agent session, which costs tokens, takes minutes and writes to the corpus.
 * Listing all four as identical text links said they were the same kind of click.
 * Browsing stays plain text; starting a session is a button, because that is what a
 * button means.
 */
const BROWSE = [
  { href: "/hackathons", label: "Hackathons" },
  { href: "/products", label: "Products" },
  { href: "/builds", label: "Builds" },
];

const START = [
  {
    href: "/research",
    label: "Research",
    hint: "Give an agent a hackathon or a product and watch it learn the stack",
    Icon: Telescope,
    primary: true,
  },
  {
    href: "/build",
    label: "Build",
    hint: "Point it at a repository and a library it knows, and let it do the work",
    Icon: Hammer,
    primary: false,
  },
  {
    href: "/docs",
    label: "Ask the docs",
    hint: "Ask a question against everything indexed, with citations",
    Icon: MessagesSquare,
    primary: false,
  },
];

const REPO = "https://github.com/md-abid-hussain/graft";

/**
 * The repo link, shared by all three headers.
 *
 * `/research` and `/docs` do not use `SiteHeader` — a full-height chat surface has no
 * room for it — so without this they had no way back to the source at all.
 */
export function GitHubLink({ className }: { className?: string }) {
  return (
    <a
      href={REPO}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "font-mono text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      GitHub
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      {/* Held to the same width as the pages below it. A header wider than its own page
          leaves the nav and the button hanging outside the content column. */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-5 2xl:max-w-7xl">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* A graft is a shoot joined to a rootstock — the mark is the shoot. */}
          <Sprout className="size-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Graft</span>
        </Link>

        <nav
          aria-label="Browse the index"
          className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm whitespace-nowrap"
        >
          {BROWSE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <GitHubLink className="max-md:hidden" />
          <ThemeToggle />

          {/* Chrome on one side, the two things that actually start work on the other.
              Hidden with the GitHub link, since below that there is no group left to
              separate — only the toggle. */}
          <span className="h-5 w-px shrink-0 bg-border max-md:hidden" aria-hidden />

          <nav aria-label="Start a session" className="flex items-center gap-2">
            {START.map(({ href, label, hint, Icon, primary }) => (
              <Link
                key={href}
                href={href}
                title={hint}
                className={cn(
                  buttonVariants({ size: "sm", variant: primary ? "default" : "outline" }),
                  "rounded-full max-sm:size-8 max-sm:rounded-full max-sm:p-0",
                )}
              >
                <Icon className="size-3.5" />
                {/* Below `sm` the row cannot hold both labels, and an icon pair with a
                    tooltip beats one action silently disappearing. */}
                <span className="max-sm:sr-only">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import { AgentSplit } from "@/components/agent-split";
import { BuildSubject } from "@/components/build-subject";
import { GitHubLink } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { BUILD_AGENT_NAME } from "@/lib/trueforge/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Build" };

/**
 * The third leg: use what the index knows to change a codebase.
 *
 * `h-dvh` with `min-h-0` down the tree is load-bearing: the UI SDK fills its parent
 * and sets no height of its own, so an unresolved parent collapses the chat to
 * nothing — the most common way this integration renders blank.
 */
export default function BuildPage() {
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <Link
          href="/"
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-medium">Build with what it knows</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {BUILD_AGENT_NAME}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/builds" className="text-xs text-muted-foreground hover:text-foreground">
            All builds
          </Link>
          <GitHubLink className="max-sm:hidden" />
          <ThemeToggle />
        </div>
      </header>

      <AgentSplit
        agentName={BUILD_AGENT_NAME}
        label="What it built"
        icon={<Hammer className="size-3.5" />}
        panel={BuildSubject}
      />
    </div>
  );
}

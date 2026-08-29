import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ResearchSplit } from "@/components/research-split";
import { AGENT_NAME } from "@/lib/trueforge/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Research · WeHelpAgents" };

/**
 * `h-dvh` with `min-h-0` down the tree is load-bearing: the UI SDK fills its parent
 * and sets no height of its own, so an unresolved parent collapses the chat to
 * nothing — the most common way this integration renders blank.
 */
export default function UiRunPage() {
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
        <h1 className="text-sm font-medium">Research</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {AGENT_NAME}
        </span>
        <Link
          href="/hackathons"
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          All hackathons
        </Link>
      </header>

      <ResearchSplit agentName={AGENT_NAME} />
    </div>
  );
}

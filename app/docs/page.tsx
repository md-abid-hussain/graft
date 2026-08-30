import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { GitHubLink } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOC_AGENT_NAME } from "@/lib/trueforge/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ask the docs" };

/**
 * Chat with the ingested docs.
 *
 * A dedicated chat surface rather than the split `/research` needs: there is no second
 * half to show, because answers cite their own sources inline.
 */
export default function DocsChatPage() {
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
        <h1 className="text-sm font-medium">Ask the docs</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {DOC_AGENT_NAME}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/research"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Research
          </Link>
          <GitHubLink className="max-sm:hidden" />
          <ThemeToggle />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatPanel agentName={DOC_AGENT_NAME} variant="full" />
      </div>
    </div>
  );
}

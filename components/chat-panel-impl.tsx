"use client";

import { useContext, useEffect } from "react";
import { useTheme } from "next-themes";
import { Thread, ThreadListContainer, TrueForgeUI } from "@truefoundry/trueforge-ui";
import { useAuiState } from "@truefoundry/trueforge-ui/assistant-ui";
import "@truefoundry/trueforge-ui/styles.css";
import { CHAT_BRAND, CHAT_TOKENS } from "@/components/chat-theme";
import { ReportSession } from "@/components/session-bridge";

/**
 * The chat, straight from the harness's own UI SDK.
 *
 * `baseUrl` points at `/api/tf` rather than the harness directly: TrueForge sends no
 * CORS headers and answers OPTIONS with 404, so the browser cannot call it cross-origin.
 *
 * The layout is ours rather than a built-in preset because half a screen has no room
 * for the full shell — and because the panel next door needs the session id, which is
 * only readable from inside this provider.
 */

/** Publishes the open session upward. `remoteId` is undefined until the first turn. */
function SessionWatcher() {
  const report = useContext(ReportSession);
  const remoteId = useAuiState((s) => s.threadListItem?.remoteId);

  useEffect(() => {
    report(remoteId);
  }, [remoteId, report]);

  return null;
}

/**
 * Both surfaces use a layout of ours rather than a built-in preset.
 *
 * The presets mount `ShellActions`, which is a theme toggle and a settings gear, and it
 * is not one of the overridable slots — so composing `ThreadListContainer` and `Thread`
 * ourselves is the only way to leave it out. Both buttons are wrong here: the theme is
 * controlled from next-themes below, so the SDK's toggle fights the app's own; and the
 * settings panel configures models, connectors and the sandbox, none of which belong to
 * a visitor of a read-only docs page.
 *
 * Module scope on both, so switching sessions does not remount the whole chat.
 */
function ChatLayout({ className }: { className?: string }) {
  return (
    <div className={`${className ?? ""} flex min-h-0`}>
      <div className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r md:flex">
        <ThreadListContainer />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <SessionWatcher />
        <Thread />
      </div>
    </div>
  );
}

/** The full-page variant: a wider rail, and no session to report upward. */
function DocsLayout({ className }: { className?: string }) {
  return (
    <div className={`${className ?? ""} flex min-h-0`}>
      <div className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r md:flex">
        <ThreadListContainer />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Thread />
      </div>
    </div>
  );
}

/**
 * Attachments are off.
 *
 * `ComposerLeftSection` is the attach button and nothing else, so replacing it removes
 * the affordance rather than hiding a broken one — neither agent does anything with an
 * uploaded file, and the corpus is filled from URLs the agent fetches itself.
 */
const NoAttachments = () => null;

/**
 * `full` is the dedicated chat surface at `/docs`. `split` is the compact column beside
 * the record panel at `/research`, and is the only one that reports the session id
 * upward.
 */
export default function ChatPanelImpl({
  agentName,
  variant = "split",
}: {
  agentName: string;
  variant?: "split" | "full";
}) {
  // Controlled from next-themes: the SDK's provider toggles `dark` on
  // document.documentElement, the same element our theme uses, so leaving it
  // uncontrolled lets it flip the whole app.
  const { resolvedTheme } = useTheme();

  return (
    <TrueForgeUI
      server={{ type: "trueforge", baseUrl: "/api/tf" }}
      agentConfig={{ mode: "SingleAgent", name: agentName }}
      layout={variant === "full" ? DocsLayout : ChatLayout}
      theme={{
        mode: resolvedTheme === "dark" ? "dark" : "light",
        tokens: CHAT_TOKENS,
        brand: CHAT_BRAND,
      }}
      overrides={{ ComposerLeftSection: NoAttachments }}
      className="h-full min-h-0"
    />
  );
}

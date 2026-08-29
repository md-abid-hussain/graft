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

// Module scope, so switching sessions does not remount the whole chat.
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

/**
 * Attachments are off.
 *
 * `ComposerLeftSection` is the attach button and nothing else, so replacing it removes
 * the affordance rather than hiding a broken one — neither agent does anything with an
 * uploaded file, and the corpus is filled from URLs the agent fetches itself.
 */
const NoAttachments = () => null;

/**
 * `full` uses the SDK's own `sidebar` preset — the documented choice for a dedicated
 * chat surface. `split` is our compact layout, for the half-width column beside the
 * research panel, and is the only one that reports the session id upward.
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
      layout={variant === "full" ? "sidebar" : ChatLayout}
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

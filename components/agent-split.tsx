"use client";

import { useCallback, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { ReportSession } from "@/components/session-bridge";

/**
 * A chat beside what it produced.
 *
 * Both `/research` and `/build` are the same shape: the harness's own chat on the left,
 * and on the right the record that conversation published. Only the panel differs, so
 * it arrives as a prop rather than as a second copy of this file — the width reasoning
 * below is the sort of thing that gets quietly diverged once it exists twice.
 *
 * The two halves are joined by the session id, which only exists inside the chat
 * runtime and arrives here through `ReportSession`. Picking an older conversation from
 * the history rail changes it, so the panel follows without either side knowing about
 * the other.
 */
export function AgentSplit({
  agentName,
  label,
  icon,
  panel: Panel,
}: {
  agentName: string;
  label: string;
  icon: React.ReactNode;
  panel: React.ComponentType<{ sessionId?: string }>;
}) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // Stable, so the watcher's effect does not re-fire on every render.
  const report = useCallback((id: string | undefined) => setSessionId(id), []);

  return (
    <ReportSession.Provider value={report}>
      {/* The chat column cannot use extra width: the SDK caps its message thread at
          `--thread-max-width` (704px) and the history rail is a fixed 224px, so beyond
          928px every pixel the left column gains is empty gutter. Only `2xl` widens the
          record, because that gutter does not exist below it — at 1024 and 1280 the
          chat is already under its own cap, and taking width there would come out of
          the conversation rather than out of the waste. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,44rem)]">
        <section className="flex min-h-[60svh] flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0">
          <ChatPanel agentName={agentName} />
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b px-5 py-2.5">
            <span className="text-muted-foreground">{icon}</span>
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Keyed on the session so switching conversations remounts the panel
                rather than leaving it to clear its own state. */}
            <Panel key={sessionId ?? "none"} sessionId={sessionId} />
          </div>
        </section>
      </div>
    </ReportSession.Provider>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Database } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { RunSubject } from "@/components/run-subject";
import { ReportSession } from "@/components/session-bridge";

/**
 * Research, split.
 *
 * Left is the harness's own chat — streaming, tool cards, approval gates and questions
 * are all the SDK's job. Right is what that conversation put in the corpus.
 *
 * The two are joined by the session id, which only exists inside the chat runtime and
 * arrives here through `ReportSession`. Picking an older conversation from the history
 * rail changes it, so the panel follows without either side knowing about the other.
 */
export function ResearchSplit({ agentName }: { agentName: string }) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // Stable, so the watcher's effect does not re-fire on every render.
  const report = useCallback((id: string | undefined) => setSessionId(id), []);

  return (
    <ReportSession.Provider value={report}>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <section className="flex min-h-[60svh] flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0">
          <ChatPanel agentName={agentName} />
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b px-5 py-2.5">
            <Database className="size-3.5 text-muted-foreground" />
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What it learned
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RunSubject key={sessionId ?? "none"} sessionId={sessionId} />
          </div>
        </section>
      </div>
    </ReportSession.Provider>
  );
}

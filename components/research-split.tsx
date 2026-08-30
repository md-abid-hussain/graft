"use client";

import { Database } from "lucide-react";
import { AgentSplit } from "@/components/agent-split";
import { RunSubject } from "@/components/run-subject";

/**
 * Research, split: the harness's own chat beside what that conversation put in the
 * corpus. The shell — grid, session plumbing, width reasoning — is shared with
 * `/build`, which has the same shape and a different panel.
 */
export function ResearchSplit({ agentName }: { agentName: string }) {
  return (
    <AgentSplit
      agentName={agentName}
      label="What it learned"
      icon={<Database className="size-3.5" />}
      panel={RunSubject}
    />
  );
}

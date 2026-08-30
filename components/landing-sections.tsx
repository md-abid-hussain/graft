import { ArrowUpRight } from "lucide-react";

/**
 * The landing page's long-form sections.
 *
 * Numbered rather than titled: the page argues a case in order — the problem, what
 * this is, the surface it exposes, and where the harness sits — and the numbers tell
 * a reader how far through that argument they are.
 *
 * Kept out of `app/page.tsx` so that file stays the shape of the page rather than
 * three hundred lines of copy.
 */

export function SectionHeading({
  index,
  label,
  title,
  children,
}: {
  index: string;
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs tracking-widest text-primary uppercase">
        {index} — {label}
      </p>
      <h2 className="mt-3 font-heading text-3xl leading-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children ? (
        <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Stacks a WeMakeDevs regular has met — the world the problem lives in, not our coverage. */
const STACKS = ["Bright Data", "Zerops", "SigNoz", "Cognee", "Kestra", "TrueForge"];

export function ProblemSection() {
  return (
    <section className="border-t py-20">
      <SectionHeading
        index="01"
        label="The problem"
        title="You accumulate. Your agent resets."
      >
        <p>
          WeMakeDevs runs a hackathon every few weeks, each built on a different stack. SigNoz
          for observability. Cognee for agent memory. Zerops for infrastructure. TrueForge for
          agent harnesses.
        </p>
        <p>
          You learn one, ship something, and move on. Your coding agent learned it too — and
          forgot it the moment the session closed. So the next time you reach for that tool,
          you paste the same documentation into the same chat and start from zero.
        </p>
      </SectionHeading>

      <p className="mt-10 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        Stacks you met at one hackathon or another
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {STACKS.map((s) => (
          <li key={s} className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
            {s}
          </li>
        ))}
      </ul>

      <blockquote className="mt-10 border-l-2 border-primary pl-5 font-heading text-xl leading-snug text-balance">
        You accumulate. Your agent resets, every single time.
      </blockquote>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "It learns with you",
    body: "While you work through a hackathon, it reads that stack from its own documentation — the event, its sponsors, their docs — and keeps what it found, cited. Point it at a single product and it does the same for that alone.",
  },
  {
    n: "02",
    title: "It remembers",
    body: "The next hackathon does not start from zero. What it learned in March is still there in June, and it never re-reads a page it has already indexed.",
  },
  {
    n: "03",
    title: "It builds with you",
    body: "Ask it to add something it knows. It reads your repository, writes the change in a sandbox, runs your tests, opens a pull request you approve — and records the run either way.",
  },
];

export function WhatThisIsSection() {
  return (
    <section className="border-t py-20">
      <SectionHeading
        index="02"
        label="What this is"
        title="An agent that learns a stack alongside you and still knows it next month."
      >
        <p>
          Each hackathon&apos;s stack is read once — the event, its sponsors, their docs and
          repositories — into a cited index served over MCP. Then it does the wiring, and the
          credential that can write to GitHub never enters the sandbox.
        </p>
      </SectionHeading>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="bg-background p-6">
            <p className="font-mono text-xs tracking-widest text-primary uppercase">
              Step {step.n}
            </p>
            <h3 className="mt-3 font-heading text-base font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const READ = [
  ["how_to_use", "What the server is, how to drive it, and what is indexed right now."],
  ["list_products", "Everything on record, with category and how much is indexed."],
  ["get_product", "Full record: links, socials, indexed sources, hackathons it appeared at."],
  ["list_hackathons", "Hackathons on record, with dates and status."],
  ["get_hackathon", "Tracks, judging, rules and requirements for one event."],
  ["search_docs", "Hybrid retrieval over one product's docs, every result cited."],
];

const WRITE = [
  ["save_hackathon", "The hackathon record, when there is one: products reference it."],
  ["save_product", "A product, optionally linked to a hackathon."],
  ["ingest_source", "Fetch, chunk, embed and index a batch of doc URLs."],
  ["save_build", "Record what an agent built, so it outlives the conversation."],
];

const RESOURCES = [
  ["guide://usage", "Tool order, how to phrase a search, how to find an llms-full.txt."],
  ["corpus://status", "Live coverage: what is actually indexed right now."],
];

function ToolGroup({
  label,
  note,
  items,
}: {
  label: string;
  note: string;
  items: string[][];
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b pb-2">
        <h3 className="font-mono text-xs tracking-widest text-primary uppercase">{label}</h3>
        <span className="font-mono text-xs text-muted-foreground">{note}</span>
      </div>
      <dl className="mt-3 space-y-3">
        {items.map(([name, purpose]) => (
          <div key={name}>
            <dt className="font-mono text-sm">{name}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{purpose}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The three agents as operating loops against the contract, not as one-liners.
 *
 * A step in the flow that pauses for the harness's approval gate is marked, because
 * where the gates fall IS the story — the same tools without them would be a chatbox.
 */
const AGENTS: {
  name: string;
  verb: string;
  mounts: string;
  flow: { step: string; gated?: boolean }[];
  body: string;
}[] = [
  {
    name: "graft-learn",
    verb: "researches",
    mounts: "bright data · linkup · graft — skill: graft-research",
    flow: [
      { step: "discover" },
      { step: "save_hackathon", gated: true },
      { step: "ask which sponsors" },
      { step: "save_product", gated: true },
      { step: "ask what to ingest" },
      { step: "ingest_source", gated: true },
    ],
    body: "Finds the pages itself — SERP, sitemaps, llms-full.txt — and sends facts and URLs, never content. The server fetches, chunks and embeds; the human decides what matters and what is worth ingesting.",
  },
  {
    name: "graft-recall",
    verb: "answers",
    mounts: "graft only — skill: graft-docs-lookup",
    flow: [
      { step: "list_* for slugs" },
      { step: "search_docs, whole questions" },
      { step: "cited answer — or an honest not-indexed" },
    ],
    body: "Reads only the contract: no web, no memory, no guessed slugs. Every claim carries the URL it came from, and a gap in the index is reported as a gap.",
  },
  {
    name: "graft-build",
    verb: "acts",
    mounts: "graft + save_build · github · linkup — skills: library-integration, docs-lookup",
    flow: [
      { step: "search_docs first" },
      { step: "web fallback, disclosed" },
      { step: "sandbox: change + run the target's tests" },
      { step: "propose via GitHub", gated: true },
      { step: "save_build, either way" },
    ],
    body: "Its capability is its mounts: integrate a library, triage issues, remediate a review. Proven in a Docker-capable sandbox the GitHub credential never enters, then recorded through the contract.",
  },
];

export function AgentsSection() {
  return (
    <section className="border-t py-20">
      <SectionHeading index="03" label="The agents" title="Three agents, one contract.">
        <p>
          An agent&apos;s capability here is defined by what it mounts, not by its prompt —
          each is a thin instruction file over connectors and skills, driving the same ten
          typed tools. Marked steps pause at the harness&apos;s approval gate.
        </p>
      </SectionHeading>

      <ul className="mt-10 space-y-px overflow-hidden rounded-2xl border bg-border">
        {AGENTS.map((a) => (
          <li key={a.name} className="bg-background p-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-mono text-sm font-semibold text-primary">{a.name}</h3>
              <span className="text-sm text-muted-foreground">{a.verb}</span>
              <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground/70">
                {a.mounts}
              </span>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-y-1.5 font-mono text-xs">
              {a.flow.map((f, i) => (
                <span key={f.step} className="flex items-center">
                  {i > 0 ? <span className="mx-2 text-muted-foreground/50">→</span> : null}
                  <span
                    className={
                      f.gated
                        ? "rounded-md border border-primary/40 bg-primary/8 px-1.5 py-0.5 text-primary"
                        : "text-foreground/80"
                    }
                  >
                    {f.gated ? "⏸ " : ""}
                    {f.step}
                  </span>
                </span>
              ))}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {a.body}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-muted-foreground">
        The loop closes: <Mono>graft-learn</Mono> writes what <Mono>graft-recall</Mono> reads,
        and <Mono>graft-build</Mono> reads both and writes back what it did. The corpus
        compounds instead of resetting.
      </p>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function McpSection() {
  return (
    <section className="border-t py-20">
      <SectionHeading
        index="04"
        label="The MCP surface"
        title="One server. Ten tools, two resources."
      >
        <p>
          The agents do not each carry their own copy of what has been learned. They read and
          write one index through a single MCP server at{" "}
          <code className="font-mono text-sm text-foreground">/api/mcp</code>, with reads and
          writes together because they are not two audiences: the research agent reads its own
          output constantly — to check whether a hackathon is already on record before spending
          an hour re-researching it.
        </p>
      </SectionHeading>

      <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <ToolGroup label="Read" note="6 · pass straight through" items={READ} />
        <div>
          <ToolGroup label="Write" note="4 · gated by the harness" items={WRITE} />
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            None of the three declare <code className="font-mono">readOnlyHint</code>, so the
            harness holds each one for a human.
          </p>
        </div>
        <ToolGroup
          label="Resources"
          note="2 · the same guide, spec-correct"
          items={RESOURCES}
        />
      </div>
    </section>
  );
}

const HARNESS = [
  [
    "Human approval before anything irreversible",
    "require_approval_for_tools gates every write to the index, and every GitHub write the integration agent proposes.",
  ],
  [
    "The sandbox does the work, without the keys",
    "The GitHub credential stays in the connector and never enters the sandbox. The sandbox proves the change works — it is not trusted to ship it.",
  ],
  [
    "Deferred tool loading",
    "Several MCP servers are attached; their schemas are discovered on demand rather than loaded into context up front.",
  ],
  [
    "Subagents",
    "Dynamic subagents on every agent: the harness spawns one when work is worth delegating, and only the result returns to the parent's context.",
  ],
  [
    "Sessions that survive",
    "/research reads a session's own event log to work out which hackathon it produced, so reopening an old conversation shows what it learned.",
  ],
  [
    "The harness's own chat",
    "The web app embeds @truefoundry/trueforge-ui, so streaming, tool cards and approval gates behave exactly as they do in TrueForge itself.",
  ],
];

export function TrueForgeSection() {
  return (
    <section className="border-t py-20">
      <SectionHeading index="05" label="How TrueForge is used" title="Not as a model wrapper.">
        <p>
          An agent that acts needs tool connections, subagent delegation, sandboxed execution,
          skills, and context that survives — a runtime nobody builds well in a week. TrueForge
          is that runtime; these agents are deliberately thin on top of it.
        </p>
      </SectionHeading>

      <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {HARNESS.map(([title, body]) => (
          <div key={title} className="border-t pt-4">
            <dt className="text-sm font-semibold text-balance">{title}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</dd>
          </div>
        ))}
      </dl>

      <a
        href="https://trueforge.dev"
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        TrueForge
        <ArrowUpRight className="size-3.5" />
      </a>
    </section>
  );
}

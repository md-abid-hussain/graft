import "dotenv/config";
import { db, pool, schema } from "../lib/db/connection";

/**
 * Development fixture — NOT the product's data path.
 *
 * Scout produces all of this at runtime by reading the hackathon page. This exists so
 * retrieval, the MCP tools and the UI can be built before Scout's instructions are
 * finished.
 *
 * Every URL was verified against the live pages (HTTP 200), which makes it double as a
 * regression fixture: once Scout runs, diff its output against this to see what it
 * found, missed, or got wrong.
 *
 *   pnpm seed:dev
 */

const HACKATHON = "hk_agent_harness_2026";

const tracks = [
  { name: "Double-O", award: "Best Use of TrueForge", prize: "NVIDIA DGX Spark", value_usd: 5000,
    criteria: "Real MCP tools, sandboxed code execution, human approvals, subagents, persistent sessions. The harness doing the work rather than sitting under a thin wrapper." },
  { name: "Q Branch", award: "Best Code Quality", prize: "Mac Mini", value_usd: 1000,
    criteria: "Judged on the Qodo pull-request review trail every submission carries." },
  { name: "Savile Row", award: "Best UI", prize: "Apple iPad (one per team member)",
    criteria: "Shows what the agent is doing, what it is waiting on, and what it did, and asks before the irreversible step rather than after it." },
];

const prizes = [
  ...tracks,
  { name: "Universal Exports", award: "Job interview at TrueFoundry", prize: "Interview",
    criteria: "Passed on by the judges; no application, not conditional on winning a track." },
  { name: "Field Report", award: "Best blog post", prize: "Keychron keyboard",
    criteria: "Publish anywhere, link it in the submission." },
  { name: "Radio Traffic", award: "Top 10 social posts", prize: "Swag",
    criteria: "Share the build publicly, tag WeMakeDevs, TrueFoundry and Qodo." },
  { name: "Calling Card", award: "Star the repo draw", prize: "Logitech MX Master 3",
    criteria: "No project required. Listed in the kickoff blog only, not on the hackathon page." },
];

const rules = [
  "Participation is free and open online worldwide.",
  "Solo or teams of up to four; one team per participant.",
  "The agent must run on TrueForge, and a judge must see the harness doing real work rather than a thin wrapper around a model call.",
  "Every substantive change goes through a GitHub pull request reviewed by Qodo before merge. Direct pushes to main do not count as reviewed work.",
  "Valid High-severity Qodo findings must be fixed, or dismissed in the thread with a reason.",
  "The submission must be open source with a public repository judges can read and run.",
  "Only tools, data and accounts the participant owns or is permitted to use may be connected.",
  "No credentials, keys or personal data in the repository or the demo video.",
  "The project must be built during the hackathon window; prior planning and diagrams are permitted.",
  "AI coding assistants are permitted but their use must be disclosed.",
  "Participants must understand and be able to explain the submitted code and architecture.",
  "Every submission is considered for all three judged tracks, but one team may win only one.",
];

const judging = [
  { name: "Potential impact", description: "Does the agent do a clear, useful job someone would actually hand over?" },
  { name: "Creativity and originality", description: "An inventive job to give an agent, or an inventive way of doing it." },
  { name: "Technical excellence", description: "Complete, reliable and well structured." },
  { name: "Use of sponsor tools", description: "Is TrueForge central rather than a thin wrapper, and did Qodo review the pull requests?" },
  { name: "Control and safety", description: "Does it run code somewhere safe and stop for a human before anything irreversible?" },
  { name: "Presentation", description: "Does the demo explain the problem, the agent working, and where the harness fits?" },
];

const requirements = [
  "An agent on TrueForge visibly reaching a real tool, executing code in the sandbox, and pausing before an irreversible action.",
  "A public source-code repository.",
  "A README with setup steps another person can follow.",
  "A demo video of about three minutes showing the agent working.",
  "A short write-up of what the agent does and how it uses TrueForge.",
  "A '## Qodo Code Review Evidence' README section linking at least one representative merged pull request.",
  "That section must explain what Qodo surfaced, what was changed or intentionally dismissed, and show a follow-up review.",
  "A blog post link, if entering that prize.",
];

/**
 * `ingest_policy` encodes what the corpus is FOR: products a developer integrates into
 * a codebase. That is what Field Engineer targets and what retrieval needs to answer.
 *
 *   full          — integratable; index the documentation
 *   metadata_only — a real sponsor whose links matter, but nothing to integrate
 *   skip          — neither
 */
const products = [
  // Integratable — Field Engineer's targets.
  { id: "signoz", slug: "signoz", name: "SigNoz", company: "SigNoz", category: "observability",
    requiredHere: false, ingestPolicy: "full" as const,
    summary: "Open-source OpenTelemetry-native APM — traces, metrics and logs in one place.",
    homepageUrl: "https://signoz.io", docsUrl: "https://signoz.io/docs",
    llmsTxtUrl: "https://signoz.io/llms-full.txt", sitemapUrl: "https://signoz.io/sitemap.xml",
    githubUrl: "https://github.com/SigNoz/signoz", blogUrl: "https://signoz.io/blog",
    socials: { github: "https://github.com/SigNoz" } },

  { id: "kestra", slug: "kestra", name: "Kestra", company: "Kestra", category: "automation",
    requiredHere: false, ingestPolicy: "full" as const,
    summary: "Declarative, event-driven orchestration for data and infrastructure pipelines.",
    homepageUrl: "https://kestra.io", docsUrl: "https://kestra.io/docs",
    llmsTxtUrl: "https://kestra.io/llms-full.txt", sitemapUrl: "https://kestra.io/sitemap.xml",
    githubUrl: "https://github.com/kestra-io/kestra", blogUrl: "https://kestra.io/blogs",
    socials: { github: "https://github.com/kestra-io" } },

  { id: "zerops", slug: "zerops", name: "Zerops", company: "Zerops", category: "infra",
    requiredHere: false, ingestPolicy: "full" as const,
    summary: "Developer-first cloud platform — declarative infrastructure from a single YAML manifest.",
    homepageUrl: "https://zerops.io", docsUrl: "https://docs.zerops.io",
    llmsTxtUrl: "https://docs.zerops.io/llms-full.txt", sitemapUrl: "https://docs.zerops.io/sitemap.xml",
    githubUrl: "https://github.com/zeropsio", blogUrl: "https://zerops.io/blog",
    socials: { github: "https://github.com/zeropsio" } },

  { id: "cognee", slug: "cognee", name: "Cognee", company: "Cognee", category: "agent-memory",
    requiredHere: false, ingestPolicy: "full" as const,
    summary: "Memory layer for AI agents — knowledge graphs and semantic recall over your data.",
    homepageUrl: "https://www.cognee.ai", docsUrl: "https://docs.cognee.ai",
    llmsTxtUrl: "https://docs.cognee.ai/llms-full.txt", sitemapUrl: "https://docs.cognee.ai/sitemap.xml",
    githubUrl: "https://github.com/topoteretes/cognee", blogUrl: "https://www.cognee.ai/blog",
    socials: { github: "https://github.com/topoteretes" } },

  { id: "brightdata", slug: "brightdata", name: "Bright Data", company: "Bright Data", category: "scraping",
    requiredHere: false, ingestPolicy: "full" as const,
    summary: "Web data platform — proxies, scraper APIs and a browser for structured extraction.",
    homepageUrl: "https://brightdata.com", docsUrl: "https://docs.brightdata.com",
    llmsTxtUrl: "https://docs.brightdata.com/llms-full.txt", sitemapUrl: "https://docs.brightdata.com/sitemap.xml",
    githubUrl: "https://github.com/brightdata", blogUrl: "https://brightdata.com/blog",
    socials: { github: "https://github.com/brightdata" } },

  // The current hackathon's own product — indexed because participants building on it
  // need its documentation, not because Field Engineer integrates it.
  { id: "trueforge", slug: "trueforge", name: "TrueForge", company: "TrueFoundry", category: "harness",
    requiredHere: true, notes: "The agent must run on TrueForge; a judge must see the harness doing real work.", ingestPolicy: "full" as const,
    summary: "Open-source agent harness — the runtime layer that turns an LLM into a working agent.",
    homepageUrl: "https://www.truefoundry.com", docsUrl: "https://trueforge.dev",
    llmsTxtUrl: "https://trueforge.dev/llms-full.txt", sitemapUrl: "https://trueforge.dev/sitemap.xml",
    githubUrl: "https://github.com/truefoundry/trueforge", blogUrl: "https://www.truefoundry.com/blog",
    socials: { x: "https://x.com/truefoundry", github: "https://github.com/truefoundry",
               linkedin: "https://www.linkedin.com/company/truefoundry", youtube: "https://www.youtube.com/@truefoundry" } },

  // Recorded, not indexed. Both are real sponsors whose links matter, but neither is
  // something an agent integrates into a repository: Qodo is a GitHub App you install
  // as part of the pipeline, OpenAI is a model provider. Indexing them would spend the
  // corpus on questions Field Engineer never asks.
  { id: "qodo", slug: "qodo", name: "Qodo", company: "Qodo", category: "code-review",
    requiredHere: true, notes: "Every substantive change must go through a pull request Qodo reviewed before merge.", ingestPolicy: "metadata_only" as const,
    summary: "AI code review on pull requests. Required by the hackathon; installed as a GitHub App, not integrated in code.",
    homepageUrl: "https://www.qodo.ai", docsUrl: "https://docs.qodo.ai",
    llmsTxtUrl: "https://docs.qodo.ai/llms-full.txt", sitemapUrl: "https://docs.qodo.ai/sitemap.xml",
    githubUrl: "https://github.com/qodo-ai/qodo-skills", blogUrl: "https://www.qodo.ai/blog/",
    socials: { x: "https://x.com/QodoAI", github: "https://github.com/Codium-ai" } },

  { id: "openai", slug: "openai", name: "OpenAI", company: "OpenAI", category: "other",
    requiredHere: false, notes: "$50 in credits for in-person attendees; online participants bring their own key.", ingestPolicy: "metadata_only" as const,
    summary: "Model partner. $50 in credits for in-person attendees; online participants bring their own key.",
    homepageUrl: "https://openai.com", docsUrl: "https://developers.openai.com/api/docs",
    llmsTxtUrl: "https://developers.openai.com/llms-full.txt", sitemapUrl: "https://developers.openai.com/sitemap-index.xml",
    githubUrl: "https://github.com/openai", blogUrl: "https://developers.openai.com/blog/",
    socials: { x: "https://x.com/OpenAI", github: "https://github.com/openai" } },
];

/** Every URL verified HTTP 200. `evidence` is why it was kept — or why it was not. */
const findings = [
  { productId: "trueforge", kind: "repo" as const, title: "truefoundry/trueforge",
    url: "https://github.com/truefoundry/trueforge", relevance: 1.0, verdict: "canonical" as const,
    evidence: "Linked from trueforge.dev and the hackathon resources page; the docs site is built from this repo. MIT, 4,587 stars.",
    foundBy: "repo-verification", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge/resources" },

  { productId: "trueforge", kind: "repo" as const, title: "Agent cookbook — ten example agents",
    url: "https://github.com/truefoundry/trueforge/tree/examples/agent-cookbook/examples", relevance: 0.94, verdict: "relevant" as const,
    evidence: "Ten ready-to-copy agent.json specs; named on the resources page as 'Example agents to copy'.",
    foundBy: "repo-verification", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge/resources" },

  { productId: null, kind: "blog" as const, title: "Getting Started Guide For The Agent Harness Hackathon",
    url: "https://www.wemakedevs.org/blogs/agent-harness-hackathon-kick-off", relevance: 0.98, verdict: "relevant" as const,
    evidence: "Official kickoff guide written for this event; covers the seven steps to a first agent and the Qodo review workflow.",
    foundBy: "blog-ranking", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge" },

  { productId: "trueforge", kind: "video" as const, title: "AI agent harnesses, explained (with a live demo)",
    url: "https://www.youtube.com/watch?v=bqgz6gOK5OA", relevance: 0.91, verdict: "relevant" as const,
    evidence: "Listed under 'Watch first' on the official resources page; shows TrueForge driving a real task.",
    foundBy: "video-discovery", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge/resources" },

  { productId: "trueforge", kind: "blog" as const, title: "Sandboxed Code Agents: Secure Execution for AI",
    url: "https://www.truefoundry.com/blog/sandboxed-code-agents-secure-execution", relevance: 0.88, verdict: "relevant" as const,
    evidence: "Supports the requirement to run generated code safely — the control-and-safety judging criterion.",
    foundBy: "blog-ranking", sourcePage: "https://www.truefoundry.com/blog" },

  { productId: "trueforge", kind: "blog" as const, title: "The Human Gate: Designing MCP Tool Approvals",
    url: "https://www.truefoundry.com/blog/mcp-tool-approval-human-gate-call-path", relevance: 0.86, verdict: "relevant" as const,
    evidence: "Covers approval flows for MCP tool calls — the mechanism behind the required human approval gate.",
    foundBy: "blog-ranking", sourcePage: "https://www.truefoundry.com/blog" },

  { productId: "signoz", kind: "docs" as const, title: "SigNoz llms-full.txt is an index, not a corpus",
    url: "https://signoz.io/llms-full.txt", relevance: 0.5, verdict: "failed" as const,
    evidence: "Only 8.8KB with zero Source: delimiters — a link index, not concatenated documentation. Needs sitemap crawling to index properly.",
    foundBy: "docs-discovery", sourcePage: "https://signoz.io" },

  { productId: "qodo", kind: "docs" as const, title: "Qodo documentation",
    url: "https://docs.qodo.ai/agent-skills", relevance: 0.6, verdict: "reference-only" as const,
    evidence: "Required by the hackathon, but installed as a GitHub App rather than integrated in code — no integration target, so recorded without indexing.",
    foundBy: "docs-discovery", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge/resources" },

  { productId: "openai", kind: "docs" as const, title: "OpenAI developer documentation (5.4MB, 1520 sections)",
    url: "https://developers.openai.com/llms-full.txt", relevance: 0.3, verdict: "reference-only" as const,
    evidence: "Model partner, not an integration target. Corpus is ~21x TrueForge's and would dominate retrieval for no benefit — ingest_policy metadata_only.",
    foundBy: "docs-discovery", sourcePage: "https://www.wemakedevs.org/hackathons/trueforge" },
];

try {
  await db
    .insert(schema.hackathons)
    .values({
      id: HACKATHON,
      slug: "agent-harness",
      title: "The Agent Harness Hackathon",
      tagline: "Give AI models a License to act",
      description:
        "Build an agent that reaches real tools, runs its code in a sandbox, and waits for a human before anything irreversible, on TrueForge — TrueFoundry's open-source agent harness.",
      host: "WeMakeDevs",
      startsAt: new Date("2026-08-24T07:00:00Z"),
      endsAt: new Date("2026-08-30T19:00:00Z"),
      timezone: "Europe/London",
      status: "active",
      sourceUrl: "https://www.wemakedevs.org/hackathons/trueforge",
      sourceFormat: "wemakedevs",
      mode: "hybrid",
      location: "Online, plus an in-person build day in San Francisco on 29 August",
      registrationUrl: "https://forms.gle/dNHFh7wH8uJj4bZH8",
      prizes, tracks, rules, judging, requirements,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.hackathons.id,
      set: {
        prizes, tracks, rules, judging, requirements,
        sourceFormat: "wemakedevs",
        mode: "hybrid",
        location: "Online, plus an in-person build day in San Francisco on 29 August",
        registrationUrl: "https://forms.gle/dNHFh7wH8uJj4bZH8",
        fetchedAt: new Date(),
      },
    });
  console.log(`hackathon  ${HACKATHON}`);

  for (const p of products) {
    const { requiredHere, notes, ...product } = p;
    await db
      .insert(schema.products)
      .values(product)
      .onConflictDoUpdate({ target: schema.products.id, set: product });

    // Link, not ownership: the same product can appear at several events.
    await db
      .insert(schema.hackathonProducts)
      .values({ hackathonId: HACKATHON, productId: product.id, isRequired: requiredHere, notes: notes ?? null })
      .onConflictDoUpdate({
        target: [schema.hackathonProducts.hackathonId, schema.hackathonProducts.productId],
        set: { isRequired: requiredHere, notes: notes ?? null },
      });

    const mark = product.ingestPolicy === "full" ? "index" : "  —  ";
    const req = requiredHere ? "required" : "        ";
    console.log(`product    ${product.slug.padEnd(11)} ${product.category.padEnd(14)} ${req}  ${mark}  ${product.ingestPolicy}`);
  }

  for (const f of findings) {
    await db
      .insert(schema.findings)
      .values({ ...f, hackathonId: HACKATHON, verified: true, httpStatus: 200, verifiedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.findings.hackathonId, schema.findings.url],
        set: {
          relevance: f.relevance, verdict: f.verdict, evidence: f.evidence,
          verified: true, httpStatus: 200, verifiedAt: new Date(),
        },
      });
  }
  console.log(`findings   ${findings.length}`);
} finally {
  await pool.end();
}

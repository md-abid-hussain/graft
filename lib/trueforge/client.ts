import "server-only";

/**
 * Which saved agent the chat runs.
 *
 * `server-only` because this reads a non-public env var: the page resolves it and
 * passes it down as a prop. The UI SDK talks to the harness itself through `/api/tf`,
 * so there is no server-side TrueForge client here.
 */
export const AGENT_NAME = process.env.TRUEFORGE_AGENT ?? "graft-learn";

/** Answers questions from the ingested docs; reads the corpus rather than filling it. */
export const DOC_AGENT_NAME = process.env.TRUEFORGE_DOC_AGENT ?? "graft-recall";

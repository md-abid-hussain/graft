import { z } from "zod";

/**
 * The pieces every tool needs, in one place so no two tools can drift apart on
 * how they answer, what they refuse, or how they spell an identifier.
 */

/** Timestamps leave the server as ISO 8601, never as Date objects. */
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * A successful result.
 *
 * Both shapes go out: `structuredContent` is the contract a modern client reads,
 * and the text block is the same payload for clients that ignore output schemas.
 */
export const reply = <T>(structured: T) => ({
  content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
  structuredContent: structured as Record<string, unknown>,
});

/**
 * A refusal.
 *
 * `isError` rather than a thrown exception, because a tool error is something the
 * calling model should read and act on — "that slug does not exist, here is how to
 * find the real ones" is a usable instruction, where a transport-level failure is
 * just a dead end. Every message here should name the next call to make.
 */
export const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

type Entity = "hackathon" | "product";

/**
 * The commonest refusal by far: a slug that is not on record.
 *
 * One phrasing, built here, because it was written six times in five files and had
 * drifted into four different wordings for the same condition. The remedy genuinely
 * differs by direction, so there are two — on a read the caller needs the list, on a
 * write it needs to create the thing first — and nothing else varies.
 */
export const unknownSlug = (entity: Entity, value: string) =>
  fail(`No ${entity} '${value}' on record. Call list_${entity}s for the valid slugs.`);

export const unknownSlugToWrite = (entity: Entity, value: string, because = "") =>
  fail(
    `No ${entity} '${value}' on record — call save_${entity} first, or ` +
      `list_${entity}s to check the slug.${because ? ` ${because}` : ""}`,
  );

/**
 * A database failure, reported without the SQL.
 *
 * Drizzle puts the entire failing statement in the error message. Returned verbatim
 * that lands a full `insert into "hackathons" ("id", "slug", ...)` dump in the
 * calling model's context, where it is both useless and expensive — the driver's
 * own message ("null value in column X violates not-null constraint") is the part
 * that says what to do differently.
 */
export const dbFailed = (what: string, error: unknown) => {
  const e = error as { cause?: { message?: string }; message?: string };
  const message = e?.cause?.message ?? e?.message ?? String(error);
  return fail(`${what} failed: ${message.split("\n")[0]}`);
};

/**
 * Annotations, which are load-bearing rather than decorative.
 *
 * TrueForge resolves `require_approval_for_tools: ["@write", "@destructive"]`
 * against these. A read tool missing `readOnlyHint` gets gated, and the agent stalls
 * waiting for a human to approve a SELECT.
 */
export const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;
export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

/** Slugs are the public key everywhere; ids are derived so they never need inventing. */
export const idFor = (prefix: string, value: string) =>
  `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

export const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and hyphens only");

export const url = z.string().url();
export const date = z.string().datetime({ offset: true });

/**
 * Build an update payload from the fields a caller actually sent.
 *
 * A key present in `input` — including one explicitly set to `null` — is written.
 * A key that is absent is left untouched. That distinction is the whole of the
 * omit/null contract, kept here so no tool has to restate it:
 *
 *   omitted  →  leave the stored value alone
 *   null     →  clear the stored value
 *
 * It is what makes a partial second research pass safe. Finding the rules but not
 * the tracks must not blank the tracks.
 */
export function changed<T extends Record<string, unknown>>(
  input: T,
  keys: readonly (keyof T)[],
) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (input[k] !== undefined) out[k as string] = input[k];
  return out;
}

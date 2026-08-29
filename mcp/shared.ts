import { z } from "zod";
import type { ProductSocials } from "@/lib/db/schema";

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

/**
 * Slugs are the public key everywhere; ids are derived so they never need inventing.
 *
 * The slug goes in verbatim. An earlier version collapsed every run of
 * non-alphanumerics to a single underscore, which is not injective against a
 * validator that allows repeated hyphens: `a-b` and `a--b` both became `a_b`. The
 * second save then hit the first row's primary key, overwrote its fields without
 * touching its slug, and reported the second entity as created when no such row
 * existed. `slug` is already constrained to `[a-z0-9-]+`, so it needs no escaping.
 *
 * Callers should prefer an id already stored against the slug — see `idOf` — so a
 * row written under an older derivation stays addressable.
 */
export const idFor = (prefix: string, slugValue: string) => `${prefix}_${slugValue}`;

/** The stored id if the row exists, otherwise a fresh one derived from the slug. */
export const idOf = (prefix: string, slugValue: string, existingId?: string) =>
  existingId ?? idFor(prefix, slugValue);

/**
 * Apply submitted social handles on top of the stored ones.
 *
 * `socials` is a single jsonb column holding three independently optional keys, so
 * the omit/null rule has to be applied per key rather than to the column: an absent
 * key keeps what is stored, an explicit null removes that one handle. Building the
 * value from the submitted object alone made every partial edit destructive —
 * clearing X also deleted LinkedIn and YouTube.
 */
export function mergeSocials(
  stored: ProductSocials | null | undefined,
  submitted: Partial<Record<keyof ProductSocials, string | null | undefined>> | null,
): ProductSocials {
  const merged: ProductSocials = { ...(stored ?? {}) };
  for (const [key, value] of Object.entries(submitted ?? {})) {
    const k = key as keyof ProductSocials;
    if (value === null) delete merged[k];
    else if (value !== undefined) merged[k] = value;
  }
  return merged;
}

export const slug = z
  .string()
  .min(1)
  // Capped so a title-derived slug stays a usable key and a usable URL. Titles run
  // long ("The Hangover Part AI: Where's My Context?"); the rule for shortening one
  // lives on the fields that mint slugs, not here.
  .max(64, "at most 64 characters — shorten it rather than sending the whole title")
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

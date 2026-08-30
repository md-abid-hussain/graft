import "server-only";
import { cache } from "react";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { builds, type BuildTarget } from "@/lib/db/schema";

/**
 * Work Graft has done, as it reported it.
 *
 * Every other table here describes something read. This one describes something done,
 * which is why it is the only one whose rows an agent authors rather than derives — and
 * why `summary` is prose. A reviewer wants the account, not the columns.
 */

/** Newest first: a build is an event, and the last one is the one being watched. */
export async function listBuilds() {
  return db.select().from(builds).orderBy(desc(builds.updatedAt));
}

/** The landing page renders one integer, not the rows — same reasoning as
 *  `countProducts`. */
export async function countBuilds(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(builds);
  return row?.n ?? 0;
}

/**
 * The one build the hero shows: a `proposed` run if any is waiting — that is the
 * state that proves the gate — else the newest. Bounded and column-scoped, because
 * `summary` is prose and `targets`/`details` are jsonb nobody renders in a card.
 */
export async function heroBuild() {
  const [row] = await db
    .select({
      slug: builds.slug,
      title: builds.title,
      status: builds.status,
      details: builds.details,
    })
    .from(builds)
    .orderBy(sql`(${builds.status} = 'proposed') desc`, desc(builds.updatedAt))
    .limit(1);
  return row ?? null;
}

export const getBuild = cache(async (slug: string) => {
  const [row] = await db.select().from(builds).where(eq(builds.slug, slug)).limit(1);
  return row ?? null;
});

/**
 * Builds that named this product.
 *
 * Containment against the jsonb rather than a foreign key, because `targets` is a list —
 * a migration can involve two products and a scaffold none, and a column would have
 * forced one of those to be wrong. `builds_targets_idx` is the GIN index behind it.
 */
export async function buildsForProduct(productSlug: string) {
  return db
    .select({
      slug: builds.slug,
      title: builds.title,
      kind: builds.kind,
      status: builds.status,
      updatedAt: builds.updatedAt,
    })
    .from(builds)
    .where(
      sql`${builds.targets} @> ${JSON.stringify([{ type: "product", name: productSlug }])}::jsonb`,
    )
    .orderBy(desc(builds.updatedAt));
}

export type BuildRecord = Awaited<ReturnType<typeof listBuilds>>[number];

/**
 * How a status reads to someone scanning a list.
 *
 * `proposed` is the only one that asks anything of the reader, so it is the only one
 * styled to catch the eye. The rest are outcomes, and an outcome that shouts is noise.
 */
export const BUILD_STATUS: Record<string, { label: string; className: string }> = {
  in_progress: { label: "in progress", className: "bg-primary/12 text-primary" },
  proposed: {
    label: "waiting on you",
    className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  },
  done: { label: "done", className: "bg-muted text-muted-foreground" },
  blocked: { label: "blocked", className: "bg-muted text-muted-foreground" },
  failed: { label: "failed", className: "bg-destructive/12 text-destructive" },
};

/** Targets split by what a reader does with them: repos and products are links. */
export function groupTargets(targets: BuildTarget[]) {
  return {
    repositories: targets.filter((t) => t.type === "repository"),
    products: targets.filter((t) => t.type === "product"),
    other: targets.filter((t) => t.type !== "repository" && t.type !== "product"),
  };
}

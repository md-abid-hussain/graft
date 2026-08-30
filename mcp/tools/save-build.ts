import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { buildInput } from "../inputs";
import { WRITE, dbFailed, idOf, iso, reply } from "../shared";

export function registerSaveBuild(server: McpServer) {
  server.registerTool(
    "save_build",
    {
      title: "Record a piece of work",
      description:
        "Publish what you built, so it outlives this conversation.\n\n" +
        "Everything else in this server describes what Graft has *read*. This is the " +
        "one tool that records what it *did* — a library added to a repository, a " +
        "project scaffolded, a migration attempted. The record gets its own page and " +
        "can be found again from the products it names, which is the point: a " +
        "conversation ends, a record does not.\n\n" +
        "**Call it when the work is over**, whichever way it went. A run that could " +
        "not start is worth recording — `status: 'blocked'` with a summary saying the " +
        "library has no indexed documentation tells the next person something true. " +
        "So is a failure. Only silence is useless.\n\n" +
        "You may also call it mid-run with `status: 'in_progress'` and re-save the " +
        "same `build` slug at the end; the slug updates in place, so a run that " +
        "reports twice is one record, not two.\n\n" +
        "`summary` is markdown and it is the part a person reads. Write the account " +
        "you would want if you were reviewing this cold: what changed, what you left " +
        "alone and why, what to look at first, and links to the documentation you " +
        "worked from. `details` takes the structured leftovers — a test command and " +
        "its result, a pull request URL, files touched.\n\n" +
        "Name products by the slug `list_products` gives. A target typed `product` " +
        "with a slug that matches is what lets that product's page show the work it " +
        "made possible.",
      inputSchema: buildInput,
      outputSchema: z.object({
        build: z.string(),
        created: z.boolean(),
        status: z.string(),
        targets: z.number().int().nullable(),
        updatedAt: z.string().nullable(),
      }),
      annotations: WRITE,
    },
    async (input) => {
      const [existing] = await db
        .select({ id: schema.builds.id })
        .from(schema.builds)
        .where(eq(schema.builds.slug, input.build))
        .limit(1);

      // Reuse the stored id rather than re-deriving it, so a row written under an
      // older derivation keeps updating in place instead of colliding on the slug.
      const id = idOf("bld", input.build, existing?.id);
      const now = new Date();

      // The omit/preserve contract, applied per field: an omitted key leaves the
      // stored value alone, an explicit null clears it. `section()` and the nullish
      // schemas already turn null into the column's own empty value — [] and {} —
      // because these columns are NOT NULL with a default and a literal null would
      // reach Postgres as a constraint violation the agent cannot act on.
      //
      // `targets` has to be guarded like the other two. Writing `input.targets ?? []`
      // unconditionally meant the progress-then-result flow this tool documents —
      // save once as in_progress, save again at the end — silently erased every
      // repository and product the first call recorded.
      const fields = {
        title: input.title,
        kind: input.kind,
        status: input.status,
        ...(input.targets !== undefined && { targets: input.targets }),
        ...(input.summary !== undefined && { summary: input.summary ?? null }),
        ...(input.details !== undefined && { details: input.details ?? {} }),
        updatedAt: now,
      };

      try {
        await db
          .insert(schema.builds)
          .values({ id, slug: input.build, ...fields })
          .onConflictDoUpdate({ target: schema.builds.id, set: fields });
      } catch (error) {
        return dbFailed(`Saving build '${input.build}'`, error);
      }

      return reply({
        build: input.build,
        created: !existing,
        status: input.status,
        targets: input.targets?.length ?? null,
        updatedAt: iso(now),
      });
    },
  );
}

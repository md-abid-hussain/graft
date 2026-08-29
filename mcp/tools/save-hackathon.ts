import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { HACKATHON_FIELDS, hackathonInput } from "../inputs";
import { WRITE, changed, dbFailed, idFor, reply } from "../shared";

export function registerSaveHackathon(server: McpServer) {
  server.registerTool(
    "save_hackathon",
    {
      title: "Save a hackathon",
      description:
        "Record a hackathon. Step 1 of a research run — products reference the " +
        "hackathon, so it has to exist before save_product can link to it.\n\n" +
        "Read the hackathon page with your own fetch or search tool, then send the " +
        "facts here. Send what the page actually says and leave a field out rather " +
        "than inferring it — a guessed deadline is worse than no deadline.\n\n" +
        "Re-saving the same slug updates the record. Omitted fields keep their stored " +
        "value, so a second pass that found the rules but not the tracks will not " +
        "blank the tracks.\n\n" +
        "There is no separate prizes field. `tracks` holds every prize category — " +
        "judged tracks and open prizes alike — as {name, prize, criteria}.\n\n" +
        "When this returns, stop and ask which of the sponsors you found are worth " +
        "storing before calling save_product. Not every sponsor needs a record, and " +
        "only the user knows which the build actually needs.",
      inputSchema: hackathonInput,
      outputSchema: z.object({
        hackathon: z.string(),
        created: z.boolean(),
        sourceUrl: z.string(),
      }),
      annotations: WRITE,
    },
    async (input) => {
      const id = idFor("hk", input.hackathon);

      const [existing] = await db
        .select({ id: schema.hackathons.id })
        .from(schema.hackathons)
        .where(eq(schema.hackathons.slug, input.hackathon))
        .limit(1);

      const fields = {
        title: input.title,
        sourceUrl: input.sourceUrl,
        ...changed(input, HACKATHON_FIELDS),
        // Dates arrive as ISO strings; the columns are timestamps.
        ...(input.startsAt !== undefined && {
          startsAt: input.startsAt === null ? null : new Date(input.startsAt),
        }),
        ...(input.endsAt !== undefined && {
          endsAt: input.endsAt === null ? null : new Date(input.endsAt),
        }),
        fetchedAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await db
          .insert(schema.hackathons)
          .values({ id, slug: input.hackathon, ...fields })
          .onConflictDoUpdate({ target: schema.hackathons.id, set: fields });
      } catch (error) {
        return dbFailed(`Saving hackathon '${input.hackathon}'`, error);
      }

      return reply({
        hackathon: input.hackathon,
        created: !existing,
        sourceUrl: input.sourceUrl,
      });
    },
  );
}

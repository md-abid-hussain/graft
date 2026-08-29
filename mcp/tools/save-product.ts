import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db/connection";
import { PRODUCT_FIELDS, productInput } from "../inputs";
import { WRITE, changed, dbFailed, idOf, mergeSocials, reply, unknownSlugToWrite } from "../shared";

export function registerSaveProduct(server: McpServer) {
  server.registerTool(
    "save_product",
    {
      title: "Save a product",
      description:
        "Record a sponsor product. Step 2 of a research run.\n\n" +
        "Products are global rather than owned by a hackathon — the same product " +
        "turns up at several of them, and that persistence is the point of the " +
        "corpus. Pass `hackathon` to link this product to one you have already saved, " +
        "and `notes` for anything specific to that appearance (credits offered, which " +
        "track, whether it was mandatory).\n\n" +
        "`llmsFullUrl` is the field that matters most: it is what ingest_source " +
        "indexes, and without it this product has no searchable documentation. It is " +
        "usually at /llms-full.txt on the docs domain.\n\n" +
        "It must be llms-full.txt, **not llms.txt**. They are different files: " +
        "llms-full.txt concatenates the entire documentation set, while llms.txt is " +
        "only an index of links to pages. Store an llms.txt here and ingestion will " +
        "cheerfully index a few thousand words of link lists that retrieve well and " +
        "answer nothing. Open the URL and check it contains prose, not just a list of " +
        "links, before recording it — a wrong URL stored here is worse than an empty " +
        "field.\n\n" +
        "Saving a product does not index anything — ingest_source is a separate " +
        "call. When you have saved the products, stop and ask which of them to " +
        "ingest, saying which have an llms-full.txt and which do not. Ingestion is " +
        "the slow, expensive step, so it is the user's call.\n\n" +
        "Ingest only what a developer actually integrates into a codebase. A model " +
        "provider or a code-review GitHub App is a real sponsor whose links matter, " +
        "but its documentation answers questions nobody asks and can be an order of " +
        "magnitude larger than a product people do build on.",
      inputSchema: productInput,
      outputSchema: z.object({
        product: z.string(),
        created: z.boolean(),
        linkedTo: z.string().nullable(),
      }),
      annotations: WRITE,
    },
    async (input) => {
      let hackathonId: string | null = null;
      if (input.hackathon) {
        const [h] = await db
          .select({ id: schema.hackathons.id })
          .from(schema.hackathons)
          .where(eq(schema.hackathons.slug, input.hackathon))
          .limit(1);
        if (!h)
          return unknownSlugToWrite("hackathon", input.hackathon);
        hackathonId = h.id;
      }

      const [existing] = await db
        .select({ id: schema.products.id, socials: schema.products.socials })
        .from(schema.products)
        .where(eq(schema.products.slug, input.product))
        .limit(1);

      // Reuse the stored id rather than re-deriving: a row written under an older
      // derivation must keep updating in place, not collide on the unique slug.
      const id = idOf("prd", input.product, existing?.id);

      const fields = {
        name: input.name,
        category: input.category,
        ...changed(input, PRODUCT_FIELDS),
        // Merged against what is stored, not replacing it. The three handles are
        // independently optional, so the omit/null rule has to hold per key: an
        // absent key keeps whatever is there, an explicit null removes that one
        // handle. Assigning the submitted object wholesale meant clearing X also
        // deleted LinkedIn and YouTube.
        ...(input.socials !== undefined && { socials: mergeSocials(existing?.socials, input.socials) }),
        updatedAt: new Date(),
      };

      try {
        await db
          .insert(schema.products)
          .values({ id, slug: input.product, ...fields })
          .onConflictDoUpdate({ target: schema.products.id, set: fields });

        if (hackathonId) {
          const link = db
            .insert(schema.hackathonProducts)
            .values({ hackathonId, productId: id, notes: input.notes ?? null });
          const target = [
            schema.hackathonProducts.hackathonId,
            schema.hackathonProducts.productId,
          ];

          // Same omit/null rule as everywhere else: only write `notes` when the
          // caller actually sent it. Collapsing the two here meant re-saving a
          // product to refresh its links silently erased the note on its
          // appearance at that hackathon.
          await (input.notes === undefined
            ? link.onConflictDoNothing({ target })
            : link.onConflictDoUpdate({ target, set: { notes: input.notes } }));
        }
      } catch (error) {
        return dbFailed(`Saving product '${input.product}'`, error);
      }

      return reply({
        product: input.product,
        created: !existing,
        linkedTo: input.hackathon ?? null,
      });
    },
  );
}

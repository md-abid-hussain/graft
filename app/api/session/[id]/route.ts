import { NextResponse } from "next/server";
import { getHackathon } from "@/lib/hackathons";
import { indexStateOf, listProducts } from "@/lib/products";
import { subjectOf } from "@/lib/trueforge/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What to show beside a session.
 *
 * The chat runs in the browser, so the panel learns its session id client-side and
 * asks here. Two reads: the session's event log for what it saved, then Postgres for
 * the record itself — the same row an agent would get over MCP, not a replay of the
 * conversation.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const subject = await subjectOf(id);

  // No hackathon is not the same as nothing learned: researching a product on its own
  // never calls save_hackathon. Read those records so a successful run of that shape
  // has something to show instead of sitting on "nothing stored yet".
  if (!subject.hackathon) {
    const base = { slug: null, hackathon: null, products: subject.products };
    if (subject.products.length === 0) return NextResponse.json(base);

    try {
      const named = new Set(subject.products);
      const records = (await listProducts())
        .filter((p) => named.has(p.slug))
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          category: p.category,
          homepageUrl: p.homepageUrl,
          chunks: p.chunks,
          state: indexStateOf(p),
        }));
      return NextResponse.json({ ...base, records });
    } catch {
      return NextResponse.json({ ...base, dbDown: true }, { status: 200 });
    }
  }

  try {
    const hackathon = await getHackathon(subject.hackathon);
    return NextResponse.json({
      slug: subject.hackathon,
      // A slug the agent wrote but the database does not have means the write was
      // denied at the gate — the pause is real, the row is not.
      hackathon,
      products: subject.products,
    });
  } catch {
    return NextResponse.json(
      { slug: subject.hackathon, hackathon: null, products: subject.products, dbDown: true },
      { status: 200 },
    );
  }
}

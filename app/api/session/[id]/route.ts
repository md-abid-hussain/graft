import { NextResponse } from "next/server";
import { getHackathon } from "@/lib/hackathons";
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
  if (!subject.hackathon) {
    return NextResponse.json({ slug: null, hackathon: null, products: subject.products });
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

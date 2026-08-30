import { NextResponse } from "next/server";
import { getBuild } from "@/lib/builds";
import { subjectOf } from "@/lib/trueforge/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What to show beside a build session.
 *
 * The sibling route answers the same question for research. Both read the session's
 * own event log for what the agent published, then Postgres for the record itself —
 * the record is the truth, and the log is only how we learn which one to fetch.
 *
 * That indirection is deliberate: reconstructing a build from its tool calls would
 * mean inferring "did the tests pass" from log residue. Asking the agent to publish
 * means it tells us, and the answer survives the conversation.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const subject = await subjectOf(id, { forBuild: true });
  if (!subject.build) return NextResponse.json({ slug: null, build: null });

  try {
    const build = await getBuild(subject.build);
    return NextResponse.json({
      slug: subject.build,
      // A slug the agent wrote that the database does not have means the write is
      // still at the approval gate — the intent is real, the row is not yet.
      build,
    });
  } catch {
    return NextResponse.json({ slug: subject.build, build: null, dbDown: true });
  }
}

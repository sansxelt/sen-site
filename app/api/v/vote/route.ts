// POST /api/v/vote — a voter submits one judgment. Dedup via the unique
// (test_id, voter_id) constraint; vote-to-earn grants a small credit reward.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, recordJudgment } from "@/lib/v-db";
import { grant } from "@/lib/v-credits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  const optionId = String(body?.optionId || "");
  const reason = String(body?.reason || "").trim().slice(0, 280) || undefined;
  const timeSpentMs = parseInt(body?.timeSpentMs, 10) || undefined;
  if (!testId || !optionId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const res = await recordJudgment({ testId, voterId: email, optionId, reason, timeSpentMs });
  if (res === "dup") return NextResponse.json({ error: "already_voted" }, { status: 409 });
  if (res === "invalid") return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  if (res === "err") return NextResponse.json({ error: "vote_failed" }, { status: 500 });

  // vote-to-earn (MVP: 1 credit / valid vote). Reputation-weighting + caps come with the quality system.
  await grant(email, 1, "reward", { refType: "vote" });
  return NextResponse.json({ ok: true });
}

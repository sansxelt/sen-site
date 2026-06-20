// POST /api/v/vote — a voter submits one judgment. Dedup via the unique
// (test_id, voter_id) constraint; vote-to-earn grants a small credit reward.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, recordVote } from "@/lib/v-db";

// Cap vote-to-earn per account per day to bound farming until the
// reputation/quality system lands. Keep /vote invite-only meanwhile.
const REWARD_CAP_PER_DAY = 30;

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

  // Atomic: validate + insert judgment + recount + capped reward in one transaction.
  const res = await recordVote({ testId, voterId: email, optionId, reason, timeSpentMs, rewardCap: REWARD_CAP_PER_DAY });
  if (res.status === "dup") return NextResponse.json({ error: "already_voted" }, { status: 409 });
  if (res.status === "invalid") return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  if (res.status === "err") return NextResponse.json({ error: "vote_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, earned: res.earned });
}

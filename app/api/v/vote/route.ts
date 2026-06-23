// POST /api/v/vote — a voter submits one judgment. Dedup via the unique
// (test_id, voter_id) constraint; vote-to-earn grants a small credit reward.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, recordVote } from "@/lib/v-db";
import { assessVote, hashToken, ipFromHeaders } from "@/lib/v-quality";
import { deriveSource } from "@/lib/v-sources";
import { screeningQuestionsForTest, evaluateQualification, recordScreeningOutcome } from "@/lib/v-screening";

const REWARD_CAP_PER_DAY = 30;

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  if (!testId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Audience screening gate (before any judgment). Disqualified participants are
  // recorded as a count only — no judgment, so no effect on the report or credits.
  const questions = await screeningQuestionsForTest(testId);
  if (questions.length) {
    const qualified = evaluateQualification(questions, body?.screeningAnswers);
    await recordScreeningOutcome(testId, qualified ? "qualified" : "disqualified");
    if (!qualified) return NextResponse.json({ disqualified: true });
  }

  const optionId = String(body?.optionId || "");
  const reason = String(body?.reason || "").trim().slice(0, 280) || undefined;
  const timeSpentMs = parseInt(body?.timeSpentMs, 10) || undefined;
  if (!optionId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Quality gate: too-fast / IP velocity / reputation / spam → vote is recorded
  // but rejected (doesn't count, earns nothing). Then the atomic record + reward.
  const ip = ipFromHeaders(req.headers);
  const ipHash = ip ? hashToken(ip) : null;
  const verdict = await assessVote({ voterId: email, timeSpentMs, reason, ipHash, isAnon: false });
  const src = deriveSource({ channel: "internal", referer: req.headers.get("referer"), utmSource: body?.utm_source, utmCampaign: body?.utm_campaign });
  const res = await recordVote({ testId, voterId: email, optionId, reason, timeSpentMs, rewardCap: REWARD_CAP_PER_DAY, status: verdict.status, rejectReason: verdict.reason, ipHash, ...src });
  if (res.status === "dup") return NextResponse.json({ error: "already_voted" }, { status: 409 });
  if (res.status === "invalid") return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  if (res.status === "err") return NextResponse.json({ error: "vote_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, earned: res.earned });
}

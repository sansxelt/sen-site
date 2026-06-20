// POST /api/embed/vote — anonymous voting from the embeddable widget. No auth:
// the voter is identified by a client-generated anon id (namespaced). Embed votes
// earn no credits (rewardCap 0). Same DB validation + per-(test,voter) dedup as
// the in-app vote. Real anti-abuse (IP/reputation) is the voter-quality milestone.

import { NextResponse } from "next/server";
import { recordVote } from "@/lib/v-db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  const optionId = String(body?.optionId || "");
  const reason = String(body?.reason || "").trim().slice(0, 280) || undefined;
  const voter = String(body?.voterId || "").trim().slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!testId || !optionId || !voter) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const res = await recordVote({ testId, voterId: `anon:${voter}`, optionId, reason, rewardCap: 0 });
  if (res.status === "dup") return NextResponse.json({ error: "already_voted" }, { status: 409 });
  if (res.status === "invalid") return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  if (res.status === "err") return NextResponse.json({ error: "vote_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

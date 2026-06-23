// POST /api/embed/vote — anonymous voting from the embeddable widget. No auth:
// the voter is identified by a client-generated anon id (namespaced). Embed votes
// earn no credits (rewardCap 0). Same DB validation + per-(test,voter) dedup as
// the in-app vote. Real anti-abuse (IP/reputation) is the voter-quality milestone.

import { NextResponse } from "next/server";
import { recordVote } from "@/lib/v-db";
import { assessVote, hashToken, ipFromHeaders } from "@/lib/v-quality";
import { deriveSource } from "@/lib/v-sources";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  const optionId = String(body?.optionId || "");
  const reason = String(body?.reason || "").trim().slice(0, 280) || undefined;
  const timeSpentMs = parseInt(body?.timeSpentMs, 10) || undefined;
  const voter = String(body?.voterId || "").trim().slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!testId || !optionId || !voter) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const voterId = `anon:${voter}`;
  const ip = ipFromHeaders(req.headers);
  const ipHash = ip ? hashToken(ip) : null;
  const deviceHash = hashToken(voter);
  // Embed votes get the device daily limit + IP velocity in addition to the rest.
  const verdict = await assessVote({ voterId, timeSpentMs, reason, ipHash, deviceHash, isAnon: true });
  const src = deriveSource({ channel: "embed", referer: req.headers.get("referer"), utmSource: body?.utm_source, utmCampaign: body?.utm_campaign });
  const res = await recordVote({ testId, voterId, optionId, reason, timeSpentMs, rewardCap: 0, status: verdict.status, rejectReason: verdict.reason, ipHash, deviceHash, ...src });
  if (res.status === "dup") return NextResponse.json({ error: "already_voted" }, { status: 409 });
  if (res.status === "invalid") return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
  if (res.status === "err") return NextResponse.json({ error: "vote_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

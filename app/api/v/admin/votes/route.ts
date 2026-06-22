// Admin vote review — list recent votes (filterable by status) + 7-day stats,
// and override a vote's status. Gated to VRAELIS_ADMIN emails.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { listRecentVotes, voteStats, overrideVoteStatus } from "@/lib/v-db";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!isAdmin(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") || "rejected";
  const [votes, stats] = await Promise.all([
    listRecentVotes({ status: status === "all" ? undefined : status, limit: 150 }),
    voteStats(),
  ]);
  await logEvent({ userId: email!, eventType: "admin_viewed_dashboard", actorType: "admin", source: "admin", route: "votes", metadata: { filter: status } });
  return NextResponse.json({ votes, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!isAdmin(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const status = body?.status === "valid" ? "valid" : "rejected";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const ok = await overrideVoteStatus(id, status);
  await logEvent({ userId: email!, eventType: "admin_overrode_vote", actorType: "admin", source: "admin", route: "votes", metadata: { vote_id: id, status } });
  return NextResponse.json({ ok });
}

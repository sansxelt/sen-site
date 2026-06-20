// Admin vote review — list recent votes (filterable by status) + 7-day stats,
// and override a vote's status. Gated to VRAELIS_ADMIN emails.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { listRecentVotes, voteStats, overrideVoteStatus } from "@/lib/v-db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") || "rejected";
  const [votes, stats] = await Promise.all([
    listRecentVotes({ status: status === "all" ? undefined : status, limit: 150 }),
    voteStats(),
  ]);
  return NextResponse.json({ votes, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const status = body?.status === "valid" ? "valid" : "rejected";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ ok: await overrideVoteStatus(id, status) });
}

// GET /api/v/admin/funnel — visits, signups, verifications started, decisions returned, and who came back.
// ADMIN ONLY (VRAELIS_ADMIN allowlist, server-side), because it reads across every account.
//
// The numbers are derived entirely from v_events, whose metadata was already sanitized at write time, so
// nothing here can surface a key, an address or an IP even by accident.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { funnelSummary } from "@/lib/funnel";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const raw = Number(new URL(req.url).searchParams.get("days"));
  // Clamped rather than trusted: this drives a timestamp filter, and an absurd window is a slow query.
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 365) : 30;
  return NextResponse.json(await funnelSummary(days));
}

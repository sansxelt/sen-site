// GET /api/v/admin/audit — recent audit events across all users. ADMIN ONLY
// (VRAELIS_ADMIN allowlist, server-side). Returns only sanitized event fields;
// metadata was sanitized at write time, so no secrets/keys/ip/device data exist.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { recentAuditEvents } from "@/lib/v-events";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const events = await recentAuditEvents({
    limit: 80,
    eventType: sp.get("event_type") || undefined,
    actorType: sp.get("actor_type") || undefined,
    userId: sp.get("user_id") || undefined,
    testId: sp.get("test_id") || undefined,
  });
  return NextResponse.json({ events });
}

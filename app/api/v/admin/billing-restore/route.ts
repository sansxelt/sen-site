// Operator restore after a WON dispute (revenue-protection blocker 2). ADMIN ONLY (VRAELIS_ADMIN
// allowlist, same gate as the other admin routes). A dispute freezes execution NON-DESTRUCTIVELY —
// plan_v1 is preserved, previous_plan_v1 snapshotted — and restore is MANUAL only (founder ruling: never
// auto-restore, only after Stripe reports the dispute WON). This flips billing_access_state back to
// 'active'; it does NOT re-grant anything because nothing was cleared.
//
//   POST { owner }        -> restore a frozen owner's execution access
//   GET  ?owner=... | (no owner) -> the owner's dispute history, or the list of currently-frozen owners

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { restoreBillingAccess } from "@/lib/preflight/billing-freeze";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const admin = session?.user?.email;
  if (!isAdmin(admin)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const owner = typeof body?.owner === "string" ? body.owner.trim().toLowerCase() : "";
  if (!owner || !owner.includes("@")) return NextResponse.json({ error: "bad_owner" }, { status: 400 });

  const restored = await restoreBillingAccess(owner);
  if (!restored) return NextResponse.json({ error: "not_frozen", message: "That account is not currently frozen (or the restore failed)." }, { status: 409 });
  await logEvent({ userId: admin!, eventType: "billing_access_restored", actorType: "admin", source: "app", metadata: { target_owner: owner } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isDatabaseConfigured()) return NextResponse.json({ frozen: [], disputes: [] });
  const db = getSupabaseAdminClient();
  const owner = (new URL(req.url).searchParams.get("owner") || "").trim().toLowerCase();
  if (owner) {
    // One owner's dispute history for the restore decision.
    const { data } = await db.from("v_billing_disputes" as never)
      .select("id, kind, status, amount_cents, froze_access, stripe_dispute_id, created_at")
      .eq("user_id", owner).order("created_at", { ascending: false }).limit(50);
    return NextResponse.json({ disputes: data ?? [] });
  }
  // All currently-frozen owners (the operator's work queue).
  const { data } = await db.from("v_profiles" as never)
    .select("user_id, previous_plan_v1, billing_frozen_at, billing_frozen_reason")
    .eq("billing_access_state", "frozen_dispute").order("billing_frozen_at", { ascending: false }).limit(200);
  return NextResponse.json({ frozen: data ?? [] });
}

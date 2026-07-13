// Operator comp / manual-review path for the free-pass gate (revenue-protection blocker 1). ADMIN ONLY
// (VRAELIS_ADMIN allowlist, same gate as the audit + data-request views). The free-pass gate FAILS
// CLOSED — on any eligibility-check error a legitimate brand-new user is routed to PAYG rather than
// leaking a free run. This endpoint is the safety valve: an operator grants an explicit, single-use free
// pass to a wrongly-charged real user, which the gate honors ahead of any history or fail-closed path.
//
//   POST { owner, reason, expiresAt? }  -> grant a single-use free pass to `owner`'s canonical cluster
//   GET  ?owner=...                     -> list this owner's overrides (for review / audit)
//
// This never bypasses billing broadly and never touches Stripe — it only re-enables the ONE lifetime
// free pass for a specific account an operator has vetted.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { grantFreeGrantOverride } from "@/lib/preflight/free-grant-cluster";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const admin = session?.user?.email;
  if (!isAdmin(admin)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const owner = typeof body?.owner === "string" ? body.owner.trim().toLowerCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  if (!owner || !owner.includes("@")) return NextResponse.json({ error: "bad_owner" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "reason_required", message: "A justification is required for the audit trail." }, { status: 400 });

  const id = await grantFreeGrantOverride({ owner, grantedBy: admin!, reason, expiresAt });
  if (!id) return NextResponse.json({ error: "grant_failed" }, { status: 500 });
  // Audit: who comped whom and why (never a secret). Mirrors the data-request audit trail.
  await logEvent({ userId: admin!, eventType: "free_grant_override_created", actorType: "admin", source: "app", metadata: { target_owner: owner, override_id: id, reason: reason.slice(0, 280) } });
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const owner = (new URL(req.url).searchParams.get("owner") || "").trim().toLowerCase();
  if (!owner) return NextResponse.json({ error: "owner_required" }, { status: 400 });
  if (!isDatabaseConfigured()) return NextResponse.json({ overrides: [] });
  const { data, error } = await getSupabaseAdminClient().from("v_free_grant_overrides" as never)
    .select("id, user_id, canonical_email, reason, granted_by, consumed_at, expires_at, created_at")
    .eq("user_id", owner).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ overrides: [] });
  return NextResponse.json({ overrides: data ?? [] });
}

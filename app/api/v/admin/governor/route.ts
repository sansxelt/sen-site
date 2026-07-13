// Cost-governor operator surface (revenue-protection blocker 3). ADMIN ONLY (VRAELIS_ADMIN allowlist).
// The global auto-pause is DB-durable and reset ONLY here (audited). Shows the exact trip reason,
// threshold, current hourly/daily usage, and the reset action. A SEPARATE emergency action can halt
// in-flight runs — it is never the automatic trip behavior (auto-pause only stops NEW runs).
//
//   GET                          -> governor status (paused, reason, threshold, usage, ceilings)
//   POST { action: "reset" }     -> operator reset of the global trip (audited)
//   POST { action: "pause", reason? } -> operator manual durable pause (the DB equivalent of the kill switch)
//   POST { action: "emergency_halt", reason? } -> pause NEW runs AND request cancel on in-flight runs

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { governorStatus, resetRunsGovernor, operatorPauseRunsGovernor } from "@/lib/preflight/cost-governor";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await governorStatus());
}

export async function POST(req: Request) {
  const session = await auth();
  const admin = session?.user?.email;
  if (!isAdmin(admin)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 280) : "";

  if (action === "reset") {
    const ok = await resetRunsGovernor();
    await logEvent({ userId: admin!, eventType: "governor_reset", actorType: "admin", source: "app", metadata: { ok } });
    if (!ok) return NextResponse.json({ error: "not_paused", message: "The governor is not currently paused." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause") {
    await operatorPauseRunsGovernor(admin!, reason || "operator manual pause");
    await logEvent({ userId: admin!, eventType: "governor_paused", actorType: "admin", source: "app", metadata: { reason } });
    return NextResponse.json({ ok: true });
  }

  if (action === "emergency_halt") {
    // Emergency: durable-pause NEW runs AND request cancellation of in-flight runs. This is the ONLY path
    // that touches running work — the automatic ceiling trip never does. The worker honors
    // cancel_requested_at at its next step boundary and aborts the run.
    await operatorPauseRunsGovernor(admin!, reason || "EMERGENCY HALT");
    let cancelledInFlight = 0;
    if (isDatabaseConfigured()) {
      const nowIso = new Date().toISOString();
      const { data } = await getSupabaseAdminClient().from("v_preflight_runs" as never)
        .update({ cancel_requested_at: nowIso } as never)
        .in("state", ["queued", "discovering", "running", "analyzing"]).is("cancel_requested_at", null).select("id");
      cancelledInFlight = Array.isArray(data) ? data.length : 0;
    }
    await logEvent({ userId: admin!, eventType: "governor_emergency_halt", actorType: "admin", source: "app", metadata: { reason, cancelled_in_flight: cancelledInFlight } });
    return NextResponse.json({ ok: true, cancelledInFlight });
  }

  return NextResponse.json({ error: "bad_action", message: "action must be reset | pause | emergency_halt" }, { status: 400 });
}

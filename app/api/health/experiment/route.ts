// GET /api/health/experiment — one JSON read of the cold-pool experiment's live health.
// Honest by construction: every field is a real query result, never a hardcoded "ok".
// Token-gated (HEALTH_TOKEN env, Bearer) so an uptime pinger can hit it but strangers
// can't read vote volumes. Returns 200 with status:"healthy"|"degraded" so a pinger
// can alert on the HTTP code OR the body. No auth session — pure infra check.

import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = (process.env.HEALTH_TOKEN || "").trim();
  if (token) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${token}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const checks: Record<string, unknown> = {};
  let healthy = true;

  // 1. DB reachable — a cheap count is the canonical "is the data layer up" probe.
  if (!isDatabaseConfigured()) {
    checks.db = { ok: false, note: "database not configured" };
    healthy = false;
  } else {
    try {
      const s = getSupabaseAdminClient();
      const { error } = await s.from("v_tests" as never).select("id", { count: "exact", head: true }).limit(1);
      checks.db = error ? { ok: false, note: error.message } : { ok: true };
      if (error) healthy = false;
    } catch (e) {
      checks.db = { ok: false, note: e instanceof Error ? e.message : "db error" };
      healthy = false;
    }
  }

  // 2. Live vote activity in the last hour — the experiment's pulse. valid vs filtered,
  //    plus active-test count. A sudden all-filtered hour or 0 activity during a run is a flag.
  if (isDatabaseConfigured() && (checks.db as { ok?: boolean })?.ok) {
    try {
      const s = getSupabaseAdminClient();
      const sinceHr = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [{ count: valid }, { count: filtered }, { count: active }] = await Promise.all([
        s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("status", "valid").gte("created_at", sinceHr),
        s.from("v_judgments" as never).select("*", { count: "exact", head: true }).eq("status", "rejected").gte("created_at", sinceHr),
        s.from("v_tests" as never).select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      const v = valid ?? 0, f = filtered ?? 0, total = v + f;
      checks.votesLastHour = { valid: v, filtered: f, filterRate: total ? Math.round((f / total) * 100) : 0 };
      checks.activeTests = active ?? 0;
      // Soft flag (does not fail health): an all-filtered hour with real volume is suspicious.
      if (total >= 20 && f / total >= 0.8) checks.votesLastHour = { ...(checks.votesLastHour as object), flag: "mostly_filtered" };
    } catch (e) {
      checks.votesLastHour = { ok: false, note: e instanceof Error ? e.message : "query error" };
    }
  }

  return NextResponse.json({
    status: healthy ? "healthy" : "degraded",
    checkedAt: new Date().toISOString(),
    checks,
  }, { status: healthy ? 200 : 503 });
}

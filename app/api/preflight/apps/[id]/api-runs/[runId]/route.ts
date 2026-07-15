// API-beta customer route: read ONE API run's sanitized report (decision + per-flow, per-step evidence).
// GET -> { runId, verdict, state, flows:[{ name, state, steps:[{ action, ok, detail, ms, txns }] }] }
// Evidence is method/path/status only (never headers/body/tokens). Verdict + step details are mapped to
// customer-safe language (no internal decision/reason enums). Uniform 404.

import { NextResponse } from "next/server";
import { gateApiRuntimeApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { getApiTarget } from "@/lib/preflight/runtime/targets-db";
import { readApiRun } from "@/lib/preflight/runtime/api-run-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

// Customer-safe verdict labels — never the internal decision enum.
const VERDICT: Record<string, string> = {
  ready: "READY", blocked: "BLOCKED", needs_review: "NEEDS REVIEW", repair_verified: "REPAIR VERIFIED",
  infra_failure: "COULD NOT COMPLETE", not_verified: "NOT VERIFIED",
};
// Sanitize a stored step detail so no internal reason enum surfaces. "request failed: blocked (x)" and
// "request failed: unreachable" are internal transport phrasing — collapse to a neutral customer line.
function safeDetail(d: string): string {
  if (/^request failed: (blocked|unreachable)/i.test(d)) return "The request could not be completed.";
  return d;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const g = await gateApiRuntimeApp(id, "viewer"); // reading one run's report is viewer+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;
  const target = await getApiTarget(owner, id);
  if (!target) return notFound();

  const run = await readApiRun(getSupabaseAdminClient(), owner, id, target.id, runId);
  if (!run) return notFound();

  return NextResponse.json({
    runId: run.runId,
    verdict: run.decision ? (VERDICT[run.decision] ?? "NOT VERIFIED") : "NOT VERIFIED",
    state: run.state === "completed" ? "complete" : run.state === "failed" ? "incomplete" : run.state,
    createdAt: run.createdAt,
    // Expose only the customer-safe summary counters (never internal keys like matrix_hash/adapter_version).
    coverage: (run.summary as { coverage?: string }).coverage ?? null,
    flows: run.flows.map((f) => ({
      name: f.name,
      state: f.state === "passed" ? "passed" : f.state === "failed" ? "failed" : f.state === "auth_not_ready" ? "needs a credential" : f.state,
      steps: f.steps.map((s) => ({ action: s.action, ok: s.ok, detail: safeDetail(s.detail), ms: s.ms, requests: s.txns })),
    })),
  });
}

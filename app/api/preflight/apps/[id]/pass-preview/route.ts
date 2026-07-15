// GET /api/preflight/apps/[id]/pass-preview?flow_ids=<csv>
//
// READ-ONLY price + entitlement preview for a Production Pass BEFORE launch. Returns what the launch path
// (POST .../runs) would decide for the same owner + selected flows, by calling the SAME gatePassLaunch, so
// the previewed price matches the charge in the normal case. Does NOT create a hold, does NOT touch the
// ledger, does NOT mutate anything. Owner-scoped: identity comes only from the server session; the
// application must belong to that owner (getApplication) before anything is read.
//
// ONE deliberate non-divergence exception: the preview is non-mutating, so it does NOT take the atomic
// free-pass claim the launch path takes (claimFreePass). If a concurrent same-inbox launch wins the one
// lifetime free pass between this preview and the owner's own launch, the preview may have shown "Included"
// while the launch re-prices to PAYG. That is correct behavior (a preview must never burn the pass just to
// price it); the launch remains authoritative and the owner is shown the real price at launch.

import { NextResponse } from "next/server";
import { getApprovedContract, listFlows } from "@/lib/v-applications";
import { gatePassLaunch } from "@/lib/preflight/entitlements-v1";
import { evaluateAuthReadiness, anyAuthenticated, type PreviewFlow } from "@/lib/preflight/auth-preflight";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Previewing a pass is a READ (viewer+). owner = app owner, so the previewed price/allowance is the
  // OWNER's (a launch by any editor charges the owner) — consistent with the launch route.
  const g = await gatePreflightApp(id, "viewer");
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  // Resolve the SAME contract the launch path uses (latest APPROVED, never the draft).
  const contract = await getApprovedContract(owner, id);
  if (!contract || contract.status !== "approved") {
    return NextResponse.json({ error: "contract_not_approved", message: "Approve the Production Contract to preview a pass." }, { status: 400 });
  }

  // Requested flow ids (csv). Count only the flows that are ELIGIBLE right now (enabled + approved) —
  // mirror the runs route so the previewed count matches what would actually be charged. If no ids are
  // given, preview the full set of eligible flows (the "run everything" default).
  const url = new URL(req.url);
  const rawIds = (url.searchParams.get("flow_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const flows = await listFlows(owner, contract.id);
  const eligible = flows.filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"));
  const eligibleIds = new Set(eligible.map((f) => f.id));
  const selectedCount = rawIds.length
    ? rawIds.filter((fid) => eligibleIds.has(fid)).length
    : eligible.length;

  if (selectedCount === 0) {
    return NextResponse.json({ error: "flows_required", message: "Select at least one approved flow to preview.", selectedCount: 0 }, { status: 400 });
  }

  // The identical decision the launch path makes for this owner + count. Returns the discriminated
  // PassGateDecision (legacy | subscription | free | payg | frozen); the client formats it. No hold created.
  const rerun = url.searchParams.get("rerun") === "1";
  const decision = await gatePassLaunch(owner, selectedCount, { rerun });

  // Auth-readiness BEFORE the click (HF2): surface whether each signed-in role the selected flows need has
  // an active, environment-matching, DECRYPTABLE test credential — the SAME evaluateAuthReadiness the launch
  // path runs, so the user learns a missing/revoked role here instead of as a red error after clicking
  // Launch. Read-only: the decryptable probe learns a boolean server-side and never returns/logs plaintext.
  // Only evaluated when a selected flow is authenticated (a plain journey skips it, unchanged).
  const selectedIds = rawIds.length ? new Set(rawIds.filter((fid) => eligibleIds.has(fid))) : eligibleIds;
  const selectedFlows: PreviewFlow[] = eligible
    .filter((f) => selectedIds.has(f.id))
    .map((f) => ({ flowId: f.id, name: f.name, steps: Array.isArray(f.steps) ? (f.steps as { action: string; target?: string }[]) : [] }));
  let readiness: { requiresAuth: boolean; ok: boolean; roles: { role: string; ok: boolean; credentialState: string; environmentMatch: boolean; reason?: string }[]; reasons: string[] } | null = null;
  if (anyAuthenticated(selectedFlows)) {
    const extras = await getSetupExtras(owner, id);
    const r = await evaluateAuthReadiness(owner, id, selectedFlows, extras.environment ?? null, extras.boundaries);
    readiness = {
      requiresAuth: r.requiresAuth, ok: r.ok, reasons: r.reasons,
      roles: r.roles.map((x) => ({ role: x.role, ok: x.ok, credentialState: x.credentialState, environmentMatch: x.environmentMatch, reason: x.reason })),
    };
  }

  return NextResponse.json({ selectedCount, eligibleCount: eligible.length, decision, readiness });
}

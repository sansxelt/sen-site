// GET /api/preflight/apps/[id]/pass-preview?flow_ids=<csv>
//
// READ-ONLY price + entitlement preview for a Production Pass BEFORE launch. Returns exactly what the
// launch path (POST .../runs) would decide for the same owner + selected flows, by calling the SAME
// gatePassLaunch — so the preview can never diverge from the actual charge. Does NOT create a hold, does
// NOT touch the ledger, does NOT mutate anything. Owner-scoped: identity comes only from the server
// session; the application must belong to that owner (getApplication) before anything is read.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, getApprovedContract, listFlows } from "@/lib/v-applications";
import { gatePassLaunch } from "@/lib/preflight/entitlements-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Same gate as the other app routes: flag -> session -> db-ready -> ownership. Client ids never trusted.
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!(await preflightDbReady())) return NextResponse.json({ error: "setup_required" }, { status: 503 });
  const owner = email.toLowerCase();
  const { id } = await ctx.params;
  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

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

  return NextResponse.json({ selectedCount, eligibleCount: eligible.length, decision });
}

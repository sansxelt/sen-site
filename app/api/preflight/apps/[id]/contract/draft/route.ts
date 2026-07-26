// POST /api/preflight/apps/[id]/contract/draft — revise an APPROVED Production Contract by creating the
// next draft version. Approved contracts are immutable, so a revision is always a full copy: a new
// v_production_contracts row at version + 1 (status draft, source_prompt carried over), plus copies of
// every requirement row (approved reset to false; origin/source/review_state kept as-is) and every test
// flow row. Flow requirement_ids are remapped onto the copied requirement ids so coverage survives the
// copy. The previously approved version is untouched and remains what runs verify against until the new
// draft is approved.
//
// Gates, in order: preflight flag (404) -> auth (401) -> app owned (404) -> DB configured (503) -> current
// contract APPROVED (400). Double-create guard: if the next version already exists for this app, return it
// instead of duplicating (best effort; there is no unique index on application_id + version).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getContract } from "@/lib/v-applications";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { logEvent } from "@/lib/v-events";
import { requirementReviewIdentity } from "@/lib/preflight/contract-merge";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Revising the Production Contract is EDITOR+. owner = the app owner (data-plane key).
  const g = await gatePreflightApp(id, "editor");
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  if (!isDatabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  // getContract returns the LATEST version for the app; only an approved latest can be revised. If a
  // newer draft already exists it IS the latest, so this also stops draft-on-draft stacking.
  const current = await getContract(owner, id);
  if (!current) return NextResponse.json({ error: "no_contract", message: "This app has no contract yet." }, { status: 400 });
  if (current.status !== "approved") {
    return NextResponse.json({ error: "not_approved", message: "Only an approved contract can be revised. Edit the current draft instead." }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  const nextVersion = current.version + 1;

  // Double-create guard: a draft at the next version already exists (double click / concurrent tab).
  const { data: existing } = await db.from("v_production_contracts").select("id,version")
    .eq("user_id", owner).eq("application_id", id).eq("version", nextVersion).limit(1).maybeSingle();
  if (existing) {
    const ex = existing as { id: string; version: number };
    return NextResponse.json({ contractId: ex.id, version: ex.version });
  }

  // The claim the new version is written against. Named rather than inlined so the review carry-over below
  // compares against the value actually stored: if a future revision path ever transforms the prompt, the
  // comparison stops matching and every carried approval is cleared instead of silently surviving a change
  // of claim.
  const carriedSourcePrompt = current.source_prompt;
  const { data: createdRow, error: createErr } = await db.from("v_production_contracts").insert({
    user_id: owner, application_id: id, version: nextVersion, status: "draft", source_prompt: carriedSourcePrompt,
  } as never).select("id,version").single();
  if (createErr || !createdRow) return NextResponse.json({ error: "unavailable", message: "Could not create the draft. Try again." }, { status: 503 });
  const created = createdRow as { id: string; version: number };

  // Cleanup on any copy failure: drop the new contract (cascade removes any partial children) so the app
  // is never left with a half-copied draft as its latest version.
  const abort = async () => {
    await db.from("v_production_contracts").delete().eq("user_id", owner).eq("id", created.id);
    return NextResponse.json({ error: "copy_failed", message: "Could not copy the contract into a draft. Try again." }, { status: 503 });
  };

  // ── COPY REQUIREMENTS, AND DECIDE WHAT THE COPY MAY STILL CLAIM ────────────────────────────────────
  //
  // New ids are minted here so flow requirement_ids can be remapped. AUTHORSHIP (source, origin) always
  // carries over: who wrote the sentence does not change because it was copied into a new version.
  //
  // REVIEW is different. An approval is a decision about exact content, so it may only travel with content
  // that is provably identical. Each row stores the canonical identity of what its reviewer agreed to
  // (review_identity); the copy recomputes it and carries the approval forward only on an exact match, with
  // the claim unchanged and no edit recorded after the approval. Anything else, including a row that has no
  // stored identity to compare against, drops back to `suggested` with the reviewer, timestamp and basis
  // cleared together. Fail-closed: an approval that cannot be proven to apply does not apply.
  //
  // Reviewed-PLAN approval never carries forward, whatever the individual rows do. A new version can differ
  // in flows, steps, ordering, or scope even when every requirement text is untouched, so it needs its own
  // reviewed plan. Only the row-level human decisions survive the copy.
  const claimUnchanged = (carriedSourcePrompt ?? null) === (current.source_prompt ?? null);
  const { data: reqRows, error: reqErr } = await db.from("v_contract_requirements").select("*")
    .eq("user_id", owner).eq("contract_id", current.id)
    .order("order_index", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (reqErr) return abort();
  const reqIdMap = new Map<string, string>();
  let reviewsCarried = 0;
  let reviewsCleared = 0;
  const reqCopies = ((reqRows ?? []) as Row[]).map((r, i) => {
    const copy: Row = { ...r };
    const oldId = String(copy.id);
    const newId = randomUUID();
    reqIdMap.set(oldId, newId);
    delete copy.created_at;
    copy.id = newId;
    copy.contract_id = created.id;

    const storedIdentity = typeof r.review_identity === "string" ? r.review_identity : null;
    const currentIdentity = requirementReviewIdentity({
      requirement: String(r.requirement ?? ""),
      category: String(r.category ?? "general"),
      severity: String(r.severity ?? "important"),
      enabled: r.enabled !== false,
      source_refs: Array.isArray(r.source_refs) ? (r.source_refs as never) : [],
    });
    const provenApproved = r.review_state === "approved"
      && !!storedIdentity
      && storedIdentity === currentIdentity
      && claimUnchanged
      && r.user_modified !== true
      && !!r.approved_by && !!r.approved_at;

    if (provenApproved) {
      copy.approved = true;
      reviewsCarried++;
    } else {
      copy.review_state = r.review_state === "rejected" ? "rejected" : "suggested";
      copy.approved = false;
      copy.review_basis = null;
      copy.approved_by = null;
      copy.approved_at = null;
      copy.review_identity = null;
      if (r.review_state === "approved") reviewsCleared++;
    }
    // The copy is not the artifact any plan was approved against, and it was not produced by the backfill.
    copy.reviewed_plan_id = null;
    copy.legacy_review_class = null;
    // Dense, unique ordering. Copying order_index verbatim would inherit the legacy 9999 ties, so a revision
    // of an old contract would be as unordered as the contract it came from.
    copy.order_index = i + 1;
    return copy;
  });
  if (reqCopies.length) {
    const { error } = await db.from("v_contract_requirements").insert(reqCopies as never);
    if (error) return abort();
  }

  // Copy test flows, pointing requirement_ids at the copied requirements (stale references drop out).
  const { data: flowRows, error: flowErr } = await db.from("v_test_flows").select("*")
    .eq("user_id", owner).eq("contract_id", current.id).order("order_index", { ascending: true });
  if (flowErr) return abort();
  const flowCopies = ((flowRows ?? []) as Row[]).map((f) => {
    const copy: Row = { ...f };
    delete copy.id;
    delete copy.created_at;
    copy.contract_id = created.id;
    if (Array.isArray(copy.requirement_ids)) {
      copy.requirement_ids = (copy.requirement_ids as unknown[]).map((x) => reqIdMap.get(String(x))).filter(Boolean);
    }
    return copy;
  });
  if (flowCopies.length) {
    const { error } = await db.from("v_test_flows").insert(flowCopies as never);
    if (error) return abort();
  }

  await logEvent({
    userId: owner, eventType: "preflight_contract_draft_created", actorType: "owner", source: "app",
    route: `/api/preflight/apps/${id}/contract/draft`,
    // How many approvals survived the copy and how many were dropped, so a revision that silently lost a
    // review is visible in the event log rather than only in the rows.
    metadata: {
      application_id: id, contract_id: created.id, version: created.version, from_contract_id: current.id,
      requirements: reqCopies.length, flows: flowCopies.length,
      reviews_carried: reviewsCarried, reviews_cleared: reviewsCleared,
    },
  });
  return NextResponse.json({ contractId: created.id, version: created.version });
}

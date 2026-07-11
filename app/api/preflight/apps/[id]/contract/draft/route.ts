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
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getApplication, getContract } from "@/lib/v-applications";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();
  const { id } = await params;

  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  const { data: createdRow, error: createErr } = await db.from("v_production_contracts").insert({
    user_id: owner, application_id: id, version: nextVersion, status: "draft", source_prompt: current.source_prompt,
  } as never).select("id,version").single();
  if (createErr || !createdRow) return NextResponse.json({ error: "unavailable", message: "Could not create the draft. Try again." }, { status: 503 });
  const created = createdRow as { id: string; version: number };

  // Cleanup on any copy failure: drop the new contract (cascade removes any partial children) so the app
  // is never left with a half-copied draft as its latest version.
  const abort = async () => {
    await db.from("v_production_contracts").delete().eq("user_id", owner).eq("id", created.id);
    return NextResponse.json({ error: "copy_failed", message: "Could not copy the contract into a draft. Try again." }, { status: 503 });
  };

  // Copy requirements. New ids are minted here so flow requirement_ids can be remapped; approved resets to
  // false (the copy is back in draft); origin/source/review_state and every other field carry over as-is.
  const { data: reqRows, error: reqErr } = await db.from("v_contract_requirements").select("*")
    .eq("user_id", owner).eq("contract_id", current.id).order("order_index", { ascending: true });
  if (reqErr) return abort();
  const reqIdMap = new Map<string, string>();
  const reqCopies = ((reqRows ?? []) as Row[]).map((r) => {
    const copy: Row = { ...r };
    const oldId = String(copy.id);
    const newId = randomUUID();
    reqIdMap.set(oldId, newId);
    delete copy.created_at;
    copy.id = newId;
    copy.contract_id = created.id;
    copy.approved = false;
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
    metadata: { application_id: id, contract_id: created.id, version: created.version, from_contract_id: current.id, requirements: reqCopies.length, flows: flowCopies.length },
  });
  return NextResponse.json({ contractId: created.id, version: created.version });
}

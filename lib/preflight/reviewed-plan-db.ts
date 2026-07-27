// Reviewed plans: the DATABASE half. Mint (dry run), approve (a distinct durable event), and atomically
// consume-once (paid execution). Every business rule lives in reviewed-plan.ts (pure, tested); this file only
// reads and conditionally writes rows, mirroring the atomic-reservation pattern in verification-idempotency.ts.
//
// Tolerant of a missing table: if migration 18 is not applied, mint returns null (no handle offered) and the
// read/approve/consume paths report unavailable, so the feature is simply inert rather than throwing.
import { randomUUID } from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import type { PlannedVerification } from "./verification-lane";
import {
  planHash, planRoleRefs, deploymentFingerprint, claimFingerprint,
  type StoredReviewedPlan,
} from "./reviewed-plan";

const norm = (s: string) => s.trim().toLowerCase();
const TABLE = "v_reviewed_plans";

type Row = {
  id: string; user_id: string; deployment_fp: string; claim_fp: string; plan_hash: string;
  plan: PlannedVerification; role_refs: string[] | null;
  approval_state: "pending" | "approved"; execution_state: "unconsumed" | "consuming" | "consumed";
  expires_at: string; deployment_url: string; claim: string;
  approved_by: string | null; approved_at: string | null; run_id: string | null; coverage: unknown;
};

function toStored(d: Row): StoredReviewedPlan {
  return {
    id: d.id, user_id: d.user_id, deployment_fp: d.deployment_fp, claim_fp: d.claim_fp,
    plan_hash: d.plan_hash, plan: d.plan, role_refs: d.role_refs ?? [],
    approval_state: d.approval_state, execution_state: d.execution_state, expires_at: d.expires_at,
    // The approver travels with the plan: execution stamps this exact identity onto every requirement row it
    // writes, so the contract records WHO reviewed it rather than an unattributed "approved".
    approved_by: d.approved_by ?? null, approved_at: d.approved_at ?? null,
  };
}

// ── Mint (dry run) ────────────────────────────────────────────────────────────────────────────────────────
// Persist the resolved plan as an immutable, pending reviewed plan and return its handle. Idempotent: an
// identical live (unconsumed) plan for the same tenant returns the existing handle instead of a duplicate row.
export async function mintReviewedPlan(input: {
  owner: string; deploymentUrl: string; claim: string; plan: PlannedVerification;
  discoveryHash: string | null; coverage: unknown; ttlMs: number; nowMs: number;
}): Promise<{ id: string; expiresAt: string; reused: boolean } | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const uid = norm(input.owner);
  const deployment_fp = deploymentFingerprint(input.deploymentUrl);
  const claim_fp = claimFingerprint(input.claim);
  const plan_hash = planHash(input.plan);

  const findLive = async () => {
    const r = await s.from(TABLE as never).select("id,expires_at").eq("user_id", uid)
      .eq("deployment_fp", deployment_fp).eq("claim_fp", claim_fp).eq("plan_hash", plan_hash)
      .neq("execution_state", "consumed").maybeSingle();
    return (r.data as { id: string; expires_at: string } | null) ?? null;
  };

  const live = await findLive();
  if (live) return { id: live.id, expiresAt: live.expires_at, reused: true };

  const id = `rvp_${randomUUID()}`;
  const nowIso = new Date(input.nowMs).toISOString();
  const expiresAt = new Date(input.nowMs + input.ttlMs).toISOString();
  const row = {
    id, user_id: uid, deployment_url: input.deploymentUrl, deployment_fp, claim: input.claim, claim_fp,
    plan: input.plan, plan_hash, role_refs: planRoleRefs(input.plan), discovery_hash: input.discoveryHash,
    coverage: input.coverage, approval_state: "pending", execution_state: "unconsumed",
    expires_at: expiresAt, created_at: nowIso, updated_at: nowIso,
  };
  const ins = await s.from(TABLE as never).insert(row as never).select("id,expires_at").maybeSingle();
  if (ins.error) {
    // Either the table is missing (feature inert) or a concurrent mint won the unique index. Re-select: if a
    // live row now exists it was the race, return it; otherwise the table is unavailable and we offer no handle.
    const again = await findLive();
    return again ? { id: again.id, expiresAt: again.expires_at, reused: true } : null;
  }
  return { id, expiresAt, reused: false };
}

// ── Read (owner-scoped) ───────────────────────────────────────────────────────────────────────────────────
export async function getReviewedPlan(owner: string, id: string): Promise<StoredReviewedPlan | null> {
  if (!isDatabaseConfigured() || !id) return null;
  const s = getSupabaseAdminClient();
  const r = await s.from(TABLE as never).select("*").eq("id", id).eq("user_id", norm(owner)).maybeSingle();
  const d = r.data as Row | null;
  return d ? toStored(d) : null;
}

// The reviewed-plan provenance for a run — the REAL persisted binding: the plan whose run_id was stamped on
// this run at consume time. Read-only, owner-scoped, over the existing v_reviewed_plans.run_id column (no new
// table/concept). Returns null for a run that consumed no reviewed plan (a legacy/direct run) or before
// migration 18, so a legacy record honestly falls back rather than fabricating a binding.
export type ReviewedPlanProvenance = {
  id: string; approvalState: "pending" | "approved"; approvedBy: string | null; approvedAt: string | null;
  planHash: string; executionState: "unconsumed" | "consuming" | "consumed";
  /** The approved requirement texts IN THE ORDER plan_hash bound. The authoritative historical order. */
  requirementTexts: string[];
};
export async function getReviewedPlanByRunId(owner: string, runId: string): Promise<ReviewedPlanProvenance | null> {
  if (!isDatabaseConfigured() || !runId) return null;
  try {
    const s = getSupabaseAdminClient();
    const r = await s.from(TABLE as never).select("id, approval_state, approved_by, approved_at, plan_hash, execution_state, plan")
      .eq("run_id", runId).eq("user_id", norm(owner)).maybeSingle();
    const d = r.data as {
      id?: string; approval_state?: string; approved_by?: string | null; approved_at?: string | null;
      plan_hash?: string; execution_state?: string; plan?: PlannedVerification;
    } | null;
    if (!d?.id) return null;
    return {
      id: String(d.id),
      approvalState: d.approval_state === "approved" ? "approved" : "pending",
      approvedBy: (d.approved_by as string) ?? null,
      approvedAt: (d.approved_at as string) ?? null,
      planHash: String(d.plan_hash ?? ""),
      executionState: d.execution_state === "consumed" ? "consumed" : d.execution_state === "consuming" ? "consuming" : "unconsumed",
      // Read straight off the immutable plan. This is why historical order never has to be reconstructed
      // from row timestamps: the artifact that was approved still holds it, exactly as approved.
      requirementTexts: (d.plan?.requirements ?? []).map((x) => (x?.text ?? "").trim()).filter(Boolean),
    };
  } catch { return null; }
}

// The latest LIVE (pending, unconsumed, unexpired) reviewed plan for a given claim + deployment, owner-scoped.
// This is what makes a derived-but-not-yet-approved guarantee plan STICKY: the guarantee detail page and the
// prepare route both look it up so a refresh (or a repeated derive) shows the SAME prepared plan instead of
// re-synthesizing a new one. Keyed by the same fingerprints mint uses, so it finds exactly what was minted.
export type PendingPlanView = { id: string; plan: PlannedVerification; planHash: string; claim: string; expiresAt: string };
export async function findLivePendingPlanForClaim(owner: string, deploymentUrl: string, claim: string): Promise<PendingPlanView | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const r = await s.from(TABLE as never).select("id, plan, plan_hash, claim, expires_at")
      .eq("user_id", norm(owner))
      .eq("deployment_fp", deploymentFingerprint(deploymentUrl))
      .eq("claim_fp", claimFingerprint(claim))
      .eq("approval_state", "pending")
      .eq("execution_state", "unconsumed")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const d = r.data as { id?: string; plan?: PlannedVerification; plan_hash?: string; claim?: string; expires_at?: string } | null;
    if (!d?.id || !d.plan) return null;
    return { id: String(d.id), plan: d.plan, planHash: String(d.plan_hash ?? ""), claim: String(d.claim ?? ""), expiresAt: String(d.expires_at ?? "") };
  } catch { return null; }
}

// ── The review queue ──────────────────────────────────────────────────────────────────────────────────────
//
// Every plan this tenant has minted that is still WAITING FOR A PERSON: pending approval, not yet consumed,
// and not past its expiry. A read, not a new capability — the rows, the states and the expiry rule already
// exist; nothing had ever listed them, so the one place a human decision is owed was invisible.
//
// EXPIRY IS PART OF "PENDING". approveReviewedPlan refuses a plan past expires_at, so an expired row is not
// awaiting anyone: showing it in a review queue would put an item in front of a person that they cannot act
// on, which is worse than an empty queue. The filter is applied in SQL so the count and the list agree.
export type PendingReviewRow = {
  id: string; claim: string; deploymentUrl: string; createdAt: string; expiresAt: string;
  requirements: number; flows: number;
};

// nowMs defaults here rather than at the call sites: reading the clock inside a React component trips the
// purity rule, and the expiry comparison belongs beside the query that uses it in any case. Callers that
// need a fixed clock (tests) can still pass one.
export async function listPendingReviews(owner: string, nowMs: number = Date.now(), limit = 50): Promise<PendingReviewRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const r = await s.from(TABLE as never)
      .select("id,claim,deployment_url,created_at,expires_at,plan")
      .eq("user_id", norm(owner))
      .eq("approval_state", "pending")
      .eq("execution_state", "unconsumed")
      .gt("expires_at", new Date(nowMs).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (r.error) return [];
    return ((r.data as unknown as { id: string; claim: string; deployment_url: string; created_at: string; expires_at: string; plan: PlannedVerification }[] | null) ?? [])
      .map((d) => ({
        id: d.id,
        claim: d.claim ?? "",
        deploymentUrl: d.deployment_url ?? "",
        createdAt: d.created_at,
        expiresAt: d.expires_at,
        // Counted from the stored plan itself, which is the artifact under review. Not stored separately,
        // because a count that can disagree with the thing it counts is a count nobody should trust.
        requirements: (d.plan?.requirements ?? []).length,
        flows: (d.plan?.flows ?? []).length,
      }));
  } catch { return []; }
}

/** Whether a plan's approval window has closed. The clock lives here rather than in the page, both because
 *  reading it during render trips the purity rule and because "expired" is a rule about reviewed plans, not
 *  a detail of one screen. */
export function reviewedPlanExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) ? t <= nowMs : false;
}

// The full row for display (state, coverage, approver, timestamps) — safe fields only, owner-scoped.
export async function getReviewedPlanView(owner: string, id: string): Promise<Row | null> {
  if (!isDatabaseConfigured() || !id) return null;
  const s = getSupabaseAdminClient();
  const r = await s.from(TABLE as never).select("*").eq("id", id).eq("user_id", norm(owner)).maybeSingle();
  return (r.data as Row | null) ?? null;
}

export type ApproveResult =
  | { ok: true; alreadyApproved: boolean }
  | { ok: false; code: string; status: number; message: string };
const refuse = (code: string, status: number, message: string): ApproveResult => ({ ok: false, code, status, message });

// ── Approve (idempotent, a distinct event) ────────────────────────────────────────────────────────────────
// Approving a pending plan records the approver and timestamp. Approving an already-approved plan is a no-op
// that returns the existing approval. A consumed or expired plan cannot be approved.
export async function approveReviewedPlan(owner: string, id: string, approver: string, nowMs: number): Promise<ApproveResult> {
  if (!isDatabaseConfigured()) return refuse("unavailable", 503, "Reviewed plans are not available.");
  const s = getSupabaseAdminClient();
  const uid = norm(owner);
  const r = await s.from(TABLE as never).select("*").eq("id", id).eq("user_id", uid).maybeSingle();
  const d = r.data as Row | null;
  if (!d) return refuse("reviewed_plan_not_found", 404, "No reviewed plan with that id.");
  if (d.execution_state === "consumed") return refuse("reviewed_plan_already_consumed", 409, "This reviewed plan was already run and cannot be approved.");
  if (new Date(d.expires_at).getTime() <= nowMs) return refuse("reviewed_plan_expired", 410, "This reviewed plan has expired. Create a new one against the current build.");
  if (planHash(d.plan) !== d.plan_hash) return refuse("reviewed_plan_integrity_error", 409, "This reviewed plan failed its integrity check and cannot be approved.");
  if (d.approval_state === "approved") return { ok: true, alreadyApproved: true };

  const nowIso = new Date(nowMs).toISOString();
  const upd = await s.from(TABLE as never)
    .update({ approval_state: "approved", approved_by: approver, approved_at: nowIso, updated_at: nowIso } as never)
    .eq("id", id).eq("user_id", uid).eq("approval_state", "pending").select("id").maybeSingle();
  if (upd.error) return refuse("internal_error", 500, "Could not record the approval.");
  // No row updated => a concurrent request approved it first. That is the idempotent outcome, not a failure.
  return { ok: true, alreadyApproved: !upd.data };
}

// ── Consume (atomic, once) ────────────────────────────────────────────────────────────────────────────────
// Transition unconsumed -> consuming, guarded so only an APPROVED, unexpired, still-unconsumed plan owned by
// this tenant can win. The conditional update is the concurrency boundary: exactly one execution flips it.
export async function consumeReviewedPlan(owner: string, id: string, nowMs: number): Promise<{ ok: true } | { ok: false; code: string; status: number; message: string }> {
  if (!isDatabaseConfigured()) return { ok: false, code: "unavailable", status: 503, message: "Reviewed plans are not available." };
  const s = getSupabaseAdminClient();
  const nowIso = new Date(nowMs).toISOString();
  const upd = await s.from(TABLE as never)
    .update({ execution_state: "consuming", updated_at: nowIso } as never)
    .eq("id", id).eq("user_id", norm(owner)).eq("approval_state", "approved").eq("execution_state", "unconsumed")
    .gt("expires_at", nowIso).select("id").maybeSingle();
  if (upd.error) return { ok: false, code: "internal_error", status: 500, message: "Could not reserve the reviewed plan." };
  if (upd.data) return { ok: true };
  // Lost the guard: another execution took it, or it is no longer eligible. The caller has already run the
  // precise pure gate for messaging; this is the race outcome.
  return { ok: false, code: "reviewed_plan_already_consumed", status: 409, message: "This reviewed plan is already being run or was already run. A reviewed plan runs exactly once." };
}

// Record the launched run and finalize consumption. Called after a successful launch.
export async function markReviewedPlanRun(owner: string, id: string, runId: string, nowMs: number): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  const nowIso = new Date(nowMs).toISOString();
  await s.from(TABLE as never)
    .update({ execution_state: "consumed", run_id: runId, consumed_at: nowIso, updated_at: nowIso } as never)
    .eq("id", id).eq("user_id", norm(owner)).eq("execution_state", "consuming");
}

// Release a reservation back to unconsumed when the launch was refused (out of balance, paused, etc.), so the
// caller can fix the cause and re-run the SAME approved plan rather than being forced to re-approve.
export async function releaseReviewedPlan(owner: string, id: string, nowMs: number): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  const nowIso = new Date(nowMs).toISOString();
  await s.from(TABLE as never)
    .update({ execution_state: "unconsumed", updated_at: nowIso } as never)
    .eq("id", id).eq("user_id", norm(owner)).eq("execution_state", "consuming");
}

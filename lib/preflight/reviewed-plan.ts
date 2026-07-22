// Reviewed plans: the binding between "Vraelis proved this plan is sufficient" and "this exact plan ran in
// production". A reviewed plan is minted (immutable) by a dry run, explicitly APPROVED as a separate durable
// event, and then CONSUMED once by a paid execution that runs the stored requirements and flows verbatim.
//
// This file is the PURE half: the canonical plan hash, the deployment/claim fingerprints, the role references
// a plan depends on, and the deterministic execution gate that decides whether an approved plan may still be
// consumed. No database, no model, no clock beyond a passed-in `nowMs`, so every refusal rule is unit-tested.
//
// The DB half (mint / approve / atomically consume) lives in reviewed-plan-db.ts and only ever calls these.
import { createHash } from "crypto";
import type { PlannedVerification } from "./verification-lane";
import { coverageReport } from "./coverage";
import { canonicalClaim } from "@/app/api/v1/verifications/_shared";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (s: string) => s.trim().toLowerCase();

// A deployment URL, reduced to the parts that identify the same target: scheme + host (lowercased) + path with
// any trailing slash removed + query (order-preserved). The fragment is dropped — it never reaches the server
// and so cannot change what is deployed. A parse failure falls back to a trimmed, lowercased string so a
// malformed URL still fingerprints deterministically rather than throwing.
export function canonicalDeploymentUrl(raw: string): string {
  const s = (raw ?? "").trim();
  try {
    const u = new URL(s);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return s.toLowerCase();
  }
}

export function deploymentFingerprint(url: string): string { return sha(canonicalDeploymentUrl(url)).slice(0, 32); }
export function claimFingerprint(claim: string): string { return sha(canonicalClaim(claim)).slice(0, 32); }

// Canonical projection of a plan: exactly the fields that define what will run, with whitespace normalized and
// optional step fields defaulted so two byte-different serializations of the SAME plan hash identically.
// ORDER IS PRESERVED (requirements, flows, and steps) — a reordered plan is a different artifact and must hash
// differently, because the ordered journey is part of what the coverage gate approved.
function canonicalPlan(plan: PlannedVerification) {
  return {
    requirements: (plan.requirements ?? []).map((r) => ({ text: (r.text ?? "").trim(), category: r.category ?? "", severity: r.severity ?? null })),
    flows: (plan.flows ?? []).map((f) => ({
      name: (f.name ?? "").trim(),
      goal: (f.goal ?? "").trim(),
      role: f.role ?? null,
      steps: (f.steps ?? []).map((s) => ({ action: s.action, target: s.target ?? "", value: s.value ?? "", expect: s.expect ?? "" })),
    })),
  };
}

// The immutable identity of a plan's CONTENT. Two mints that produced the same requirements + flows hash the
// same; any change to a requirement, a flow, a step, or their order changes it. This is what an approval binds
// to, and what execution re-checks against the stored value to prove the plan was not altered after approval.
export function planHash(plan: PlannedVerification): string { return sha(JSON.stringify(canonicalPlan(plan))); }

// The test-account roles a plan depends on: every flow-level role plus every identity a sign_in_as step names.
// Execution refuses if any of these is no longer available to the tenant, because a plan that signs in as a
// role that has since been removed would not run as reviewed.
export function planRoleRefs(plan: PlannedVerification): string[] {
  const set = new Set<string>();
  for (const f of plan.flows ?? []) {
    if (f.role) set.add(norm(f.role));
    for (const s of f.steps ?? []) {
      if (s.action === "sign_in_as" && s.target) set.add(norm(s.target));
    }
  }
  return [...set].sort();
}

// ── The execution gate ────────────────────────────────────────────────────────────────────────────────────
// The stored reviewed plan, as read back for execution. Field names mirror the v_reviewed_plans columns.
export type StoredReviewedPlan = {
  id: string;
  user_id: string;
  deployment_fp: string;
  claim_fp: string;
  plan_hash: string;
  plan: PlannedVerification;
  role_refs: string[];
  approval_state: "pending" | "approved";
  execution_state: "unconsumed" | "consuming" | "consumed";
  expires_at: string; // ISO
};

export type ExecContext = {
  owner: string;
  deploymentUrl: string;
  claim: string;
  availableRoles: string[];
  nowMs: number;
};

export type ExecRefusal = { ok: false; code: string; status: number; message: string };
export type ExecVerdict = { ok: true } | ExecRefusal;
const refuse = (code: string, status: number, message: string): ExecRefusal => ({ ok: false, code, status, message });

// Decide whether an approved reviewed plan may be consumed by THIS request. Pure and total: the same inputs
// always give the same verdict. The DB consume step re-guards approval/consumption atomically against races,
// but every business rule (tenant, expiry, deployment, claim, integrity, credentials, coverage) is decided
// here so it can be tested without a database. The ORDER of checks is deliberate: identity and integrity
// first (never leak or act on a tampered/foreign row), then state, then input-drift, then coverage.
export function evaluateForExecution(stored: StoredReviewedPlan, ctx: ExecContext): ExecVerdict {
  // Wrong tenant: reported as not-found so a plan's existence never leaks across tenants.
  if (norm(stored.user_id) !== norm(ctx.owner)) return refuse("reviewed_plan_not_found", 404, "No reviewed plan with that id.");
  // Integrity: the stored plan must still hash to the stored hash. A mismatch means the row was altered after
  // it was written, so nothing about it can be trusted — refuse rather than run something never approved.
  if (planHash(stored.plan) !== stored.plan_hash) return refuse("reviewed_plan_integrity_error", 409, "This reviewed plan failed its integrity check and cannot be run. Create and approve a new one.");
  // Approval is a separate, required event. Possessing the id is not approval.
  if (stored.approval_state !== "approved") return refuse("reviewed_plan_pending", 409, "This reviewed plan has not been approved. Approve it before running.");
  if (new Date(stored.expires_at).getTime() <= ctx.nowMs) return refuse("reviewed_plan_expired", 410, "This reviewed plan has expired. Create and approve a new one against the current build.");
  if (stored.execution_state !== "unconsumed") return refuse("reviewed_plan_already_consumed", 409, "This reviewed plan was already run. A reviewed plan runs exactly once.");
  // Input drift: the request must name the SAME target and the SAME claim the plan was approved for.
  if (deploymentFingerprint(ctx.deploymentUrl) !== stored.deployment_fp) return refuse("reviewed_plan_deployment_changed", 409, "The deployment_url differs from the one this plan was approved for. Approve a new plan for the new deployment.");
  if (claimFingerprint(ctx.claim) !== stored.claim_fp) return refuse("reviewed_plan_claim_changed", 409, "The claim differs from the one this plan was approved for. Approve a new plan for the new claim.");
  // Credentials/connections: every role the plan signs in as must still be available.
  const have = new Set(ctx.availableRoles.map(norm));
  const missing = stored.role_refs.filter((r) => !have.has(norm(r)));
  if (missing.length) return refuse("reviewed_plan_credentials_changed", 409, `A test-account role this plan depends on is no longer available: ${missing.join(", ")}. Reconnect it, then approve a new plan.`);
  // Coverage must STILL pass on the stored plan. This is the deterministic gate only — no model, no recrawl,
  // no correction — run against the exact approved requirements and flows.
  const rep = coverageReport(ctx.claim, stored.plan.requirements.map((r) => r.text), stored.plan.flows);
  if (!rep.readyToLaunch) return refuse("reviewed_plan_coverage_regressed", 422, "The approved plan no longer passes the coverage gate. Create and approve a new plan.");
  return { ok: true };
}

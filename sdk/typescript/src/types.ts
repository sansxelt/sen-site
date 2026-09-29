// Public types for the Vraelis SDK. They mirror the /v1 verification API: a coding agent says what it
// built, a person approves the plan that will check it, and Vraelis runs that plan against the deployed
// app in a real browser and returns verified, failed or blocked with evidence.

export interface CreditsResult {
  [key: string]: unknown;
}

// ── Requests ──

export interface PrepareVerificationInput {
  /** The deployed app to check. Must be a public https URL. */
  deployment_url: string;
  /** What the coding agent says it built, as an outcome a user could observe. */
  claim: string;
  /** Include the coverage diagnostics used to decide whether the claim is provable. */
  diagnostic?: boolean;
}

export interface RunVerificationInput extends PrepareVerificationInput {
  /** The plan a person approved. Send the same deployment_url and claim that prepared it. */
  reviewed_plan_id: string;
}

export interface RecheckVerificationInput {
  /**
   * Where to run the approved plan again. Optional; defaults to the URL the earlier run used. It must be
   * on the same origin the plan was approved for.
   */
  deployment_url?: string;
}

export interface VerificationRequestOptions {
  /** Binds retries to the same payload and prevents duplicate preparation or spend. */
  idempotencyKey?: string;
}

export interface WaitOptions {
  /** Give up after this long. Defaults to 15 minutes. */
  timeoutMs?: number;
  /** Time between status reads. Defaults to 3000 ms for approval and 5000 ms for results. */
  intervalMs?: number;
  /** Stop waiting early. The returned promise rejects with the signal's reason. */
  signal?: AbortSignal;
}

// ── Plans ──

/**
 * Returned by `verifications.prepare()`. Nothing ran and nothing was charged. A person must open
 * `approve_url` and approve the plan before it can run. An API key cannot approve it.
 */
export interface VerificationPlan {
  state: "review_required";
  claim: string;
  requirements: string[];
  human_reviewed: false;
  review_required: true;
  contract_id: string;
  contract_version: number;
  reviewed_plan_id?: string;
  reviewed_plan_expires_at?: string;
  /** Where a signed-in person reviews and approves this plan. Hand it to them. */
  approve_url?: string;
  message: string;
}

export interface VerificationPlanFlow {
  name: string;
  goal: string;
  /** Number of browser steps in this flow. */
  steps: number;
}

/** Returned by `verifications.getPlan()` and `verifications.waitForApproval()`. */
export interface VerificationPlanStatus {
  reviewed_plan_id: string;
  approval_state: "pending" | "approved";
  execution_state: "unconsumed" | "consuming" | "consumed";
  plan_hash: string;
  deployment_url: string;
  claim: string;
  coverage: Record<string, unknown> | null;
  role_refs: string[];
  approved_by: string | null;
  approved_at: string | null;
  /** The run that used this plan, once it has been run. A raw run id, not a `vrf_` id. */
  run_id: string | null;
  expires_at: string;
  requirements: string[];
  flows: VerificationPlanFlow[];
  human_reviewed: boolean;
  /** Present only while the plan is still pending, unused and unexpired. */
  approve_url?: string;
}

// ── Runs and results ──

/** Returned by `verifications.run()`, `verifications.recheck()` and `verifications.get()` while running. */
export interface VerificationRunning {
  verification_id: string;
  state: "running";
  status_url: string;
  claim?: string | null;
  requirements?: string[];
  reviewed_plan_id?: string | null;
  human_reviewed?: boolean;
  /** Set on a re-check: the verification it ran again. */
  recheck_of?: string;
  /** Set on a re-check: the URL this run checks. */
  deployment_url?: string;
  /** Set on a re-check: the person whose approval this run stands on. */
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  /** Set on a re-check: how many more re-checks this approval allows. */
  rechecks_left?: number;
  /** Set on a re-check: when this approval stops allowing re-checks. */
  recheck_window_ends_at?: string;
}

export type VerificationDecision = "verified" | "failed" | "blocked";

export interface VerificationFailure {
  severity: string | null;
  title: string | null;
  expected: string | null;
  observed: string | null;
  reproduce: string | null;
}

export interface VerificationEvidence {
  checking: string | null;
  result: string | null;
  failed_at_step: number | null;
}

export interface VerificationCompleted {
  verification_id: string;
  state: "completed";
  /** verified: the claim held. failed: it did not, see failures and repair_prompt. blocked: no verdict was reached. */
  decision: VerificationDecision;
  claim: string | null;
  requirements: string[];
  failures: VerificationFailure[];
  evidence: VerificationEvidence[];
  /** Text to hand back to the coding agent when the decision is failed. */
  repair_prompt: string | null;
  /** Where a person opens the full record. */
  console_url: string;
  human_reviewed: boolean;
  reviewed_plan_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  guarantee_id?: string | null;
  guarantee_title?: string;
  guarantee_plan_version?: number | null;
  guarantee_plan_hash?: string | null;
  /** The raw run id this run re-verified, or null. Kept for existing callers; prefer `recheck_of`. */
  reverification_of?: string | null;
  reverification_of_url?: string;
  /** The `vrf_` id this run re-checked, or null for a first run. */
  recheck_of?: string | null;
  decision_status: "current" | "legacy";
  contract_review_status: string;
  requirement_order: string;
}

export type VerificationResult = VerificationRunning | VerificationCompleted;

// The single product boundary between authenticated UI and the public verification API.
//
// EVERY authenticated surface goes through this file to reach /v1/verifications. Nothing else in the app
// may fetch that endpoint, and nothing that comes back out of here carries an internal identifier.
//
// WHY THAT MATTERS, concretely: pass ids, contract revision ids, flow database ids and run settlement
// fields are the vocabulary of the old product. If they leak into components, the interface starts
// depending on them, and the restructure quietly reverses. Keeping the boundary in one file makes that a
// review question rather than an archaeology question.
//
// It also means the app is a client of its own public API, on exactly the terms an external caller gets.
// If the API is awkward here, it is awkward for everyone, and we find that out by using it.
//
// NO HOST IS HARDCODED. Requests are same-origin relative, and /v1 is rewritten ahead of the host split, so
// the same code works on app.vraelis.com, on localhost, and in a preview deployment. A component that
// wrote out a hostname would break in two of those three.

/** The public decision vocabulary. Deliberately not the internal ready / needs_review / blocked strings. */
export type Decision = "verified" | "failed" | "blocked";

export type Requirement = string;

export type Failure = {
  severity: string;
  title: string;
  expected: string | null;
  observed: string | null;
  reproduce: unknown;
};

export type Evidence = {
  /** What was being checked, named in product terms rather than by flow identity. */
  checking: string | null;
  result: string | null;
  failedAtStep: number | null;
};

export type Started = {
  verificationId: string;
  /** Always present. The caller must be able to see what Vraelis understood before trusting a verdict. */
  requirements: Requirement[];
  humanReviewed: boolean;
  claim: string;
};

export type Verification = {
  verificationId: string;
  /** "running" until a verdict exists. `decision` is null exactly when running. */
  state: "running" | "completed";
  decision: Decision | null;
  claim: string | null;
  requirements: Requirement[];
  failures: Failure[];
  evidence: Evidence[];
  repairPrompt: string | null;
  humanReviewed: boolean;
};

// Errors are mapped once, here, so every surface says the same thing about the same failure and no component
// invents its own wording for "out of balance".
export type ClientError = {
  code: string;
  /** Written for the person reading it, in the interface's voice. Never a raw server string. */
  message: string;
  /** True when trying again later could plausibly succeed without the user changing anything. */
  retryable: boolean;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: ClientError };

const MESSAGES: Record<string, { message: string; retryable: boolean }> = {
  signin_required: { message: "Your session expired. Sign in again to continue.", retryable: false },
  invalid_api_key: { message: "That API key is not valid.", retryable: false },
  insufficient_scope: { message: "This key cannot launch verifications. It needs the run:create scope.", retryable: false },
  validation_error: { message: "Check the deployment URL and the outcome you described.", retryable: false },
  deployment_unreachable: { message: "Nothing loaded from that URL. Check it is public and serving pages.", retryable: true },
  claim_not_testable: { message: "No browser flow could be derived from that outcome. Try describing what a person does and what should be true afterwards.", retryable: false },
  claim_not_provable: { message: "Vraelis understood this outcome but could not build a browser flow that would prove it. See what is still missing below, adjust the outcome, and review the plan again.", retryable: false },
  reviewed_plan_not_found: { message: "That plan no longer exists. Review the outcome again to build a fresh plan.", retryable: false },
  reviewed_plan_expired: { message: "This plan expired. Review the outcome again to build a fresh one against the current build.", retryable: false },
  reviewed_plan_already_consumed: { message: "This plan has already been run. A reviewed plan runs exactly once. Review the outcome again to run it again.", retryable: false },
  reviewed_plan_deployment_changed: { message: "The deployment changed since this plan was approved. Review and approve a new plan for the new deployment.", retryable: false },
  reviewed_plan_claim_changed: { message: "The outcome changed since this plan was approved. Review and approve a new plan for the new outcome.", retryable: false },
  reviewed_plan_coverage_regressed: { message: "This plan no longer proves the outcome. Review the outcome again to build a fresh plan.", retryable: false },
  synthesis_failed: { message: "The outcome could not be analyzed against this deployment. Try again.", retryable: true },
  synthesis_unavailable: { message: "Outcome analysis is unavailable right now.", retryable: true },
  runs_paused: { message: "New verifications are paused right now. Existing results are unaffected.", retryable: true },
  runs_busy: { message: "Vraelis is at capacity. Try again in a moment.", retryable: true },
  insufficient_balance: { message: "Not enough balance to run this verification.", retryable: false },
  key_daily_ceiling: { message: "This key reached its daily spend limit.", retryable: true },
  concurrency_limit: { message: "You already have verifications running. Wait for one to finish.", retryable: true },
  daily_limit: { message: "You have reached today's verification limit.", retryable: true },
  idempotency_key_reused: { message: "That request key was already used for a different verification.", retryable: false },
  not_found: { message: "No such verification.", retryable: false },
};

function mapError(code: string | undefined, serverMessage: string | undefined, status: number): ClientError {
  const known = code ? MESSAGES[code] : undefined;
  if (code && known) return { code, message: known.message, retryable: known.retryable };
  // An unmapped code is still surfaced by name so a new server error is debuggable, but the sentence the
  // user reads is ours. A 5xx is retryable by default; a 4xx is the caller's to change.
  return {
    code: code ?? "request_failed",
    message: serverMessage || (status >= 500 ? "Vraelis could not complete that request. Try again." : "That request could not be completed."),
    retryable: status >= 500 || status === 429,
  };
}

/** Both response envelopes: /v1 uses { error: { code, message } }, internal routes use { error, message }. */
function readError(body: unknown, status: number): ClientError {
  const b = (body ?? {}) as { error?: unknown; message?: string };
  if (b.error && typeof b.error === "object") {
    const e = b.error as { code?: string; message?: string };
    return mapError(e.code, e.message, status);
  }
  if (typeof b.error === "string") return mapError(b.error, b.message, status);
  return mapError(undefined, undefined, status);
}

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    // Same-origin session cookies. The browser is authenticated as the person, not as a key.
    credentials: "same-origin",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* a non-JSON body is handled as an unmapped error below */ }
  return { status: res.status, body };
}

// Normalization happens on the way in so the API never has to guess. A pasted URL commonly arrives without a
// scheme or with trailing whitespace, and rejecting that would be pedantry rather than validation.
export function normalizeDeploymentUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

export function normalizeClaim(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Start a verification.
 *
 * An idempotency key is always sent, generated when the caller does not supply one, so a double-clicked
 * button or a retried submit returns the original verification instead of paying for a second identical run.
 */
export async function startVerification(input: {
  deploymentUrl: string;
  claim: string;
  idempotencyKey?: string;
}): Promise<Result<Started>> {
  const deploymentUrl = normalizeDeploymentUrl(input.deploymentUrl);
  const claim = normalizeClaim(input.claim);
  if (!deploymentUrl || !claim) {
    return { ok: false, error: { code: "validation_error", message: MESSAGES.validation_error.message, retryable: false } };
  }

  const { status, body } = await call("/v1/verifications", {
    method: "POST",
    headers: { "idempotency-key": input.idempotencyKey ?? newIdempotencyKey() },
    body: JSON.stringify({ deployment_url: deploymentUrl, claim, context: { source: "app" } }),
  });

  const b = (body ?? {}) as Record<string, unknown>;
  if (!b.verification_id) return { ok: false, error: readError(body, status) };
  return {
    ok: true,
    value: {
      verificationId: String(b.verification_id),
      requirements: Array.isArray(b.requirements) ? (b.requirements as string[]) : [],
      humanReviewed: b.human_reviewed === true,
      claim,
    },
  };
}

/** Read a verification. Returns state "running" until a verdict exists. */
export async function getVerification(id: string, opts: { signal?: AbortSignal } = {}): Promise<Result<Verification>> {
  const { status, body } = await call(`/v1/verifications/${encodeURIComponent(id)}`, { method: "GET", signal: opts.signal });
  const b = (body ?? {}) as Record<string, unknown>;
  if (!b.verification_id) return { ok: false, error: readError(body, status) };

  const decision = b.decision as Decision | undefined;
  return {
    ok: true,
    value: {
      verificationId: String(b.verification_id),
      state: b.state === "completed" ? "completed" : "running",
      // Trust only the three published values. An unrecognized decision reads as no verdict rather than
      // being passed through for a component to guess at.
      decision: decision === "verified" || decision === "failed" || decision === "blocked" ? decision : null,
      claim: typeof b.claim === "string" ? b.claim : null,
      requirements: Array.isArray(b.requirements) ? (b.requirements as string[]) : [],
      failures: Array.isArray(b.failures) ? (b.failures as Failure[]) : [],
      evidence: Array.isArray(b.evidence)
        ? (b.evidence as Record<string, unknown>[]).map((e) => ({
            checking: (e.checking as string) ?? null,
            result: (e.result as string) ?? null,
            failedAtStep: typeof e.failed_at_step === "number" ? e.failed_at_step : null,
          }))
        : [],
      repairPrompt: typeof b.repair_prompt === "string" ? b.repair_prompt : null,
      humanReviewed: b.human_reviewed === true,
    },
  };
}

/**
 * Poll until a verdict, calling `onUpdate` with each reading so the interface can show progress.
 *
 * Cancellation is cooperative and CLIENT-side only: aborting stops watching, it does not stop the run. The
 * run is already paid for and the worker keeps going, so pretending otherwise would be a lie the UI tells.
 * A transient read failure does not end the poll, because a network blip is not a verdict.
 */
export async function pollVerification(
  id: string,
  opts: { onUpdate?: (v: Verification) => void; signal?: AbortSignal; intervalMs?: number; timeoutMs?: number } = {},
): Promise<Result<Verification>> {
  const interval = opts.intervalMs ?? 4000;
  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
  let lastError: ClientError | null = null;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) return { ok: false, error: { code: "cancelled", message: "Stopped watching. The verification is still running and stays available under Verifications.", retryable: false } };

    const r = await getVerification(id, { signal: opts.signal });
    if (r.ok) {
      opts.onUpdate?.(r.value);
      if (r.value.state === "completed") return r;
      lastError = null;
    } else {
      // A permanent error ends the poll; a transient one does not.
      if (!r.error.retryable) return r;
      lastError = r.error;
    }

    await new Promise((res) => setTimeout(res, interval));
  }

  return {
    ok: false,
    error: lastError ?? { code: "timeout", message: "This verification is taking longer than expected. It is still running.", retryable: true },
  };
}

// ── Reviewed-plan two-step contract ──
//
// The canonical safe path: mint an immutable plan (a free dry run), let a human REVIEW the exact requirements
// and journeys it will run, EXPLICITLY approve it, then execute EXACTLY that plan. Possessing the id is not
// approval; approval and execution are two distinct, audited events. This client mirrors that contract 1:1
// and never regenerates a plan after approval — the composer drives it, it does not reinvent it.

export type PlanFlow = { name: string; goal: string | null; steps: number };

/** The persisted plan, read from the server so the UI reflects real state, never a local guess. */
export type PlanView = {
  reviewedPlanId: string;
  approvalState: "pending" | "approved";
  executionState: "unconsumed" | "consuming" | "consumed";
  planHash: string;
  deploymentUrl: string;
  claim: string;
  requirements: string[];
  flows: PlanFlow[];
  expiresAt: string | null;
  approvedAt: string | null;
  runId: string | null;
};

/** What a fresh dry run returns: either a minted, reviewable plan, or the honest reason it could not be built. */
export type PlanDraft = {
  reviewedPlanId: string | null; // null when the outcome is not provable (no plan minted, nothing charged)
  wouldLaunch: boolean;
  claim: string;
  requirements: string[];
  flows: PlanFlow[];
  expiresAt: string | null;
  blockedReason: string | null;
  remainingObligations: string[];
  repairPrompt: string | null;
};

function readFlows(raw: unknown): PlanFlow[] {
  return Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map((f) => ({
        name: String(f.name ?? ""),
        goal: typeof f.goal === "string" ? f.goal : null,
        steps: typeof f.steps === "number" ? f.steps : 0,
      }))
    : [];
}

/**
 * Mint a reviewed plan (a free dry run: synthesis + the coverage gate, no browser, no hold, no charge).
 * `wouldLaunch === false` means the outcome could not be proven even after Vraelis tried to repair the plan;
 * nothing is charged and `remainingObligations` + `repairPrompt` say what is still missing.
 */
export async function createReviewedPlan(input: { deploymentUrl: string; claim: string; idempotencyKey?: string }): Promise<Result<PlanDraft>> {
  const deploymentUrl = normalizeDeploymentUrl(input.deploymentUrl);
  const claim = normalizeClaim(input.claim);
  if (!deploymentUrl || !claim) {
    return { ok: false, error: { code: "validation_error", message: MESSAGES.validation_error.message, retryable: false } };
  }
  const { status, body } = await call("/v1/verifications", {
    method: "POST",
    headers: { "idempotency-key": input.idempotencyKey ?? newIdempotencyKey() },
    body: JSON.stringify({ deployment_url: deploymentUrl, claim, dry_run: true, context: { source: "app" } }),
  });
  const b = (body ?? {}) as Record<string, unknown>;
  // The gate can BLOCK (422 claim_not_provable) and still return the coverage telemetry, which is exactly the
  // "not provable" draft the composer shows. So a 422 with that code is a value, not an error.
  const errCode = (b.error as { code?: string } | undefined)?.code;
  if (status >= 400 && errCode !== "claim_not_provable" && !b.would_launch) {
    return { ok: false, error: readError(body, status) };
  }
  return {
    ok: true,
    value: {
      reviewedPlanId: typeof b.reviewed_plan_id === "string" ? b.reviewed_plan_id : null,
      wouldLaunch: b.would_launch === true,
      claim,
      requirements: Array.isArray(b.requirements) ? (b.requirements as string[]) : [],
      flows: readFlows(b.flows),
      expiresAt: typeof b.reviewed_plan_expires_at === "string" ? b.reviewed_plan_expires_at : null,
      blockedReason: typeof b.blocked_reason === "string" ? b.blocked_reason : null,
      remainingObligations: Array.isArray(b.remaining_obligations) ? (b.remaining_obligations as string[]) : [],
      repairPrompt: typeof b.repair_prompt === "string" ? b.repair_prompt : null,
    },
  };
}

/** Read the persisted plan (the source of truth for approval + consumption state). */
export async function getReviewedPlan(id: string, opts: { signal?: AbortSignal } = {}): Promise<Result<PlanView>> {
  const { status, body } = await call(`/v1/verifications/plans/${encodeURIComponent(id)}`, { method: "GET", signal: opts.signal });
  const b = (body ?? {}) as Record<string, unknown>;
  if (!b.reviewed_plan_id) return { ok: false, error: readError(body, status) };
  return {
    ok: true,
    value: {
      reviewedPlanId: String(b.reviewed_plan_id),
      approvalState: b.approval_state === "approved" ? "approved" : "pending",
      executionState: b.execution_state === "consumed" ? "consumed" : b.execution_state === "consuming" ? "consuming" : "unconsumed",
      planHash: typeof b.plan_hash === "string" ? b.plan_hash : "",
      deploymentUrl: typeof b.deployment_url === "string" ? b.deployment_url : "",
      claim: typeof b.claim === "string" ? b.claim : "",
      requirements: Array.isArray(b.requirements) ? (b.requirements as string[]) : [],
      flows: readFlows(b.flows),
      expiresAt: typeof b.expires_at === "string" ? b.expires_at : null,
      approvedAt: typeof b.approved_at === "string" ? b.approved_at : null,
      runId: typeof b.run_id === "string" ? b.run_id : null,
    },
  };
}

/** Approve a plan. A distinct, audited event; idempotent (re-approving returns alreadyApproved). */
export async function approveReviewedPlan(id: string): Promise<Result<{ approved: true; alreadyApproved: boolean }>> {
  const { status, body } = await call(`/v1/verifications/plans/${encodeURIComponent(id)}/approve`, { method: "POST" });
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.approval_state !== "approved") return { ok: false, error: readError(body, status) };
  return { ok: true, value: { approved: true, alreadyApproved: b.already_approved === true } };
}

/** Execute an APPROVED plan verbatim. Consumes exactly this plan once; never re-synthesizes. */
export async function executeReviewedPlan(input: { deploymentUrl: string; claim: string; reviewedPlanId: string }): Promise<Result<Started>> {
  const { status, body } = await call("/v1/verifications", {
    method: "POST",
    headers: { "idempotency-key": `rvp:${input.reviewedPlanId}` },
    body: JSON.stringify({ deployment_url: normalizeDeploymentUrl(input.deploymentUrl), claim: normalizeClaim(input.claim), reviewed_plan_id: input.reviewedPlanId }),
  });
  const b = (body ?? {}) as Record<string, unknown>;
  if (!b.verification_id) return { ok: false, error: readError(body, status) };
  return {
    ok: true,
    value: {
      verificationId: String(b.verification_id),
      requirements: Array.isArray(b.requirements) ? (b.requirements as string[]) : [],
      humanReviewed: b.human_reviewed === true,
      claim: normalizeClaim(input.claim),
    },
  };
}

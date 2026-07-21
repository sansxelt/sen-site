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
    if (opts.signal?.aborted) return { ok: false, error: { code: "cancelled", message: "Stopped watching this verification. It is still running.", retryable: false } };

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

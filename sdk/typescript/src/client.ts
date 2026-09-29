import { VraelisAPIError } from "./errors";
import { verifyWebhookSignature } from "./webhooks";
import type {
  CreditsResult,
  PrepareVerificationInput,
  RecheckVerificationInput,
  RunVerificationInput,
  VerificationCompleted,
  VerificationPlan,
  VerificationPlanStatus,
  VerificationRequestOptions,
  VerificationResult,
  VerificationRunning,
  WaitOptions,
} from "./types";

const DEFAULT_BASE_URL = "https://vraelis.com";
const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_APPROVAL_INTERVAL_MS = 3000;
const DEFAULT_RESULT_INTERVAL_MS = 5000;

export interface VraelisOptions {
  /** Your API key (vr_live_...). Keep it server-side only. */
  apiKey: string;
  /** Override the API base URL (defaults to https://vraelis.com). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global fetch; required on Node < 18). */
  fetch?: typeof fetch;
}

export class Vraelis {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(opts: VraelisOptions) {
    if (!opts || !opts.apiKey) throw new Error("Vraelis: `apiKey` is required.");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = opts.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("Vraelis: no global fetch found. Pass `fetch` in options (Node < 18).");
    this._fetch = f;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this._fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json", ...extraHeaders },
        body: body != null ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      // Remember that this failure never reached the API, so a polling helper may retry it.
      if (typeof err === "object" && err !== null) networkErrors.add(err);
      throw err;
    }
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) throw VraelisAPIError.fromResponse(res.status, json, text);
    return json as T;
  }

  readonly verifications = {
    /**
     * Build the requirements and flows that would check the claim. Nothing runs and nothing is charged.
     * A person approves the plan at `approve_url`; an API key cannot. Throws a VraelisAPIError with code
     * `claim_not_provable` (status 422) when no check could prove the claim; its `body` carries
     * `remaining_obligations` and `repair_prompt`.
     */
    prepare: (input: PrepareVerificationInput, opts?: VerificationRequestOptions): Promise<VerificationPlan> =>
      this.request<VerificationPlan>("POST", "/api/v1/verifications", input, idempotencyHeader(opts)),

    /** Read a plan: what it will check, and whether a person has approved it yet. */
    getPlan: (reviewedPlanId: string, opts?: { signal?: AbortSignal }): Promise<VerificationPlanStatus> =>
      this.request<VerificationPlanStatus>(
        "GET", `/api/v1/verifications/plans/${encodeURIComponent(reviewedPlanId)}`, undefined, undefined, opts?.signal,
      ),

    /**
     * Poll a plan until a person approves it. Resolves with the approved plan. Rejects if the plan
     * expires, was already used by a run, or is still pending when the timeout passes.
     */
    waitForApproval: (reviewedPlanId: string, opts?: WaitOptions): Promise<VerificationPlanStatus> =>
      poll(opts, DEFAULT_APPROVAL_INTERVAL_MS, async (signal) => {
        const plan = await this.verifications.getPlan(reviewedPlanId, { signal });
        if (plan.execution_state !== "unconsumed") {
          const used = plan.run_id ? ` Its verification is vrf_${plan.run_id}.` : "";
          throw new Error(`Vraelis: plan ${reviewedPlanId} was already used by a run and cannot run again.${used} Prepare a new plan to verify again.`);
        }
        // An expired plan cannot run even once approved, so expiry is checked first.
        if (Date.parse(plan.expires_at) <= Date.now()) {
          const when = plan.approval_state === "approved" ? "before it was run" : "before a person approved it";
          throw new Error(`Vraelis: plan ${reviewedPlanId} expired at ${plan.expires_at} ${when}. Prepare a new plan.`);
        }
        if (plan.approval_state === "approved") return plan;
        return undefined;
      }, (waited) => `Vraelis: plan ${reviewedPlanId} was still waiting for a person to approve it after ${waited}.`),

    /**
     * Run exactly the plan a person approved. Send the same deployment_url and claim that prepared it,
     * plus `reviewed_plan_id`.
     */
    run: (input: RunVerificationInput, opts?: VerificationRequestOptions): Promise<VerificationRunning> =>
      this.request<VerificationRunning>("POST", "/api/v1/verifications", input, idempotencyHeader(opts)),

    /** Read a running verification, or its decision and evidence once it has finished. */
    get: (verificationId: string, opts?: { signal?: AbortSignal }): Promise<VerificationResult> =>
      this.request<VerificationResult>(
        "GET", `/api/v1/verifications/${encodeURIComponent(verificationId)}`, undefined, undefined, opts?.signal,
      ),

    /**
     * Poll a verification until it finishes. Resolves with the decision and evidence. Rejects if it is
     * still running when the timeout passes; the verification keeps running on Vraelis either way.
     */
    waitForResult: (verificationId: string, opts?: WaitOptions): Promise<VerificationCompleted> =>
      poll(opts, DEFAULT_RESULT_INTERVAL_MS, async (signal) => {
        const result = await this.verifications.get(verificationId, { signal });
        return result.state === "completed" ? result : undefined;
      }, (waited) => `Vraelis: verification ${verificationId} was still running after ${waited}. It keeps running; call waitForResult again or read it with verifications.get().`),

    /**
     * Run the same person-approved plan again after a fix, with no new approval. Returns a new
     * verification id. Allowed within 24 hours of the approval and at most 10 times per approval.
     * `deployment_url`, when given, must be on the origin the plan was approved for.
     */
    recheck: (
      verificationId: string,
      input?: RecheckVerificationInput,
      opts?: VerificationRequestOptions,
    ): Promise<VerificationRunning> =>
      this.request<VerificationRunning>(
        "POST", `/api/v1/verifications/${encodeURIComponent(verificationId)}/recheck`, input ?? {}, idempotencyHeader(opts),
      ),
  };

  readonly credits = {
    /** Get the account's current credit balance. */
    get: (): Promise<CreditsResult> => this.request<CreditsResult>("GET", "/api/v1/credits"),
  };

  readonly webhooks = {
    /** Verify a webhook delivery's HMAC signature. See verifyWebhookSignature. */
    verifySignature: verifyWebhookSignature,
  };
}

function idempotencyHeader(opts?: VerificationRequestOptions): Record<string, string> | undefined {
  return opts?.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : undefined;
}

// Read until `check` returns a value, sleeping `intervalMs` between reads. A transient failure (a network
// error, 429, or 5xx) is retried until the deadline instead of ending a long wait early.
async function poll<T>(
  opts: WaitOptions | undefined,
  defaultIntervalMs: number,
  check: (signal?: AbortSignal) => Promise<T | undefined>,
  timeoutMessage: (waited: string) => string,
): Promise<T> {
  const intervalMs = Math.max(0, opts?.intervalMs ?? defaultIntervalMs);
  const timeoutMs = Math.max(0, opts?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
  const signal = opts?.signal;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    throwIfAborted(signal);
    try {
      const done = await check(signal);
      if (done !== undefined) return done;
    } catch (err) {
      throwIfAborted(signal);
      if (!isTransient(err) || Date.now() >= deadline) throw err;
    }
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(timeoutMessage(formatDuration(timeoutMs)));
    await sleep(Math.min(intervalMs, left), signal);
  }
}

// Errors thrown by fetch itself (the request never got a response), as opposed to API refusals or bugs.
const networkErrors = new WeakSet<object>();

function isTransient(err: unknown): boolean {
  if (err instanceof VraelisAPIError) return err.status === 429 || err.status >= 500;
  return typeof err === "object" && err !== null && networkErrors.has(err);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("Vraelis: the wait was aborted.");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function formatDuration(ms: number): string {
  if (ms >= 60_000 && ms % 60_000 === 0) {
    const m = ms / 60_000;
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  if (ms >= 1000) return `${Math.round(ms / 1000)} seconds`;
  return `${ms} ms`;
}

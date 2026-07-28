// Vraelis Preflight worker — shared contracts. The worker (Railway) owns the run lifecycle; the browser
// provider (Browserbase) and the run store (Postgres) sit behind interfaces so both are replaceable and
// the whole lifecycle is testable with in-memory fakes (no DB, no browser, no credentials). Nothing here
// imports Next or a specific vendor SDK.
import type { TestBoundaries } from "../../lib/preflight/boundaries"; // pure module (type-only; erased)

// ── Browser provider ──────────────────────────────────────────────────────────────────────────────
export type CreateBrowserSessionInput = {
  runId: string;
  flowRunId?: string;
  environment: string;         // "preview" | "production" | "internal"
  workerId: string;
  viewport?: { width: number; height: number };
  timeoutMs?: number;          // provider-side max session duration (Vraelis also enforces its own)
};
export type BrowserSession = {
  providerSessionId: string;
  page: PreflightPage;         // the bounded, allowlisted page surface (wraps Playwright in the real impl)
  close: () => Promise<void>;  // idempotent
};
export type BrowserDebugInfo = { replayUrl?: string; providerSessionId: string };

export interface BrowserProvider {
  readonly name: string;
  createSession(input: CreateBrowserSessionInput): Promise<BrowserSession>;
  closeSession(providerSessionId: string): Promise<void>;
  getDebugInfo?(providerSessionId: string): Promise<BrowserDebugInfo | null>;
}

// ── Bounded page surface (the ONLY actions V1 allows; no arbitrary JS/eval) ──────────────────────────
// The semantic AUTH actions (S6) are additive: a flow that uses NONE of them is an unauthenticated flow
// and behaves EXACTLY as before. sign_in_as/switch_role target a ROLE LABEL (never a username); the worker
// resolves the role to an approved sealed test account and decrypts it at the moment of use — the plaintext
// never reaches the step, the observation, or any artifact. See execute-run.ts.
export type StepAction =
  | "navigate" | "click" | "fill" | "select" | "check" | "uncheck" | "press"
  | "wait_for" | "assert_visible" | "assert_text" | "assert_url" | "refresh"
  | "new_context" | "screenshot"
  | "sign_in_as" | "verify_authenticated" | "verify_unauthorized" | "switch_role" | "sign_out" | "reset_context";

export type Step = { action: StepAction; target?: string; value?: string; expect?: string; timeoutMs?: number };

// The auth step actions, as a set: a flow that contains ANY of these is an authenticated flow.
export const AUTH_ACTIONS: ReadonlySet<StepAction> = new Set<StepAction>([
  "sign_in_as", "verify_authenticated", "verify_unauthorized", "switch_role", "sign_out", "reset_context",
]);
export function flowRequiresAuth(steps: { action: StepAction }[]): boolean {
  return steps.some((s) => AUTH_ACTIONS.has(s.action));
}
// The roles a flow signs into (sign_in_as / switch_role targets), de-duplicated, in first-seen order.
export function flowRoles(steps: { action: StepAction; target?: string }[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if ((s.action === "sign_in_as" || s.action === "switch_role") && s.target && !out.includes(s.target)) out.push(s.target);
  }
  return out;
}

// A single deterministic observation from executing one step. `ok` is the ground truth; `detail` is a
// short factual note (never an AI interpretation). Candidate targets record what the resolver saw.
export type StepObservation = {
  action: StepAction; target?: string; ok: boolean; detail: string;
  url?: string; status?: number; screenshotRef?: string; ms: number;
  candidates?: string[];        // accessible-name candidates the resolver considered
  selected?: string;            // which candidate was chosen
  // WHAT THIS STEP WAS ACTUALLY LOOKING FOR, OR ACTUALLY TYPED, AFTER RESOLUTION.
  //
  // Without these the record shows that a field was filled and an assertion passed, but never with WHAT, so
  // no past verdict can be audited: 342 stored steps, every one of them expected=null. The question you
  // cannot answer from that is the one that matters — was the assertion satisfied by this run's write, or by
  // a row an earlier run left behind?
  //
  // RESOLVED, not as authored. The plan says {{unique}}; the run typed vr-3f9a2b71. The resolved form is
  // what proves whose write satisfied the assertion, and it is the only form worth keeping.
  //
  // Redacted before storage (run-store-postgres). A value is never a credential by contract — flow-steps.ts
  // rejects credential-shaped values and auth actions carry role labels rather than secrets — but this is
  // the kind of field where defence in depth is cheap and a mistake is permanent.
  value?: string;               // what a fill actually typed
  expect?: string;              // what an assertion actually looked for
};

// What a login screen looks like once detected: the accessible handles the executor will fill/submit.
// Values are NEVER carried here — this is structure only (was a field found, of what kind).
export type LoginUi = {
  found: boolean;                 // a password field (type=password) was located
  identifierKind: "email" | "username" | null; // the identity field's detected kind (accessible name/type)
  hasSubmit: boolean;             // a submit control was located
};

// Whether the current page is authenticated, judged by DETERMINISTIC observed evidence only (an expected
// route, a visible authenticated element, or a session/cookie presence). Never an AI verdict.
export type AuthState = {
  authenticated: boolean;
  via: "route" | "element" | "session" | "none"; // which signal decided it (for owner-safe step detail)
  detail: string;                 // short, owner-safe note (NEVER a credential value)
  // The session-ish storage/cookie KEY NAMES seen at this moment. Names only, never values — a session
  // token must not be read into the worker. Returned so a caller can take a BEFORE snapshot and ask what
  // signing in actually changed, which is the only way to tell a real sign-in from a page that always had
  // an auth-shaped cookie sitting on it.
  sessionKeys?: string[];
};

// The page surface the executor drives. Real impl wraps a Playwright Page; the fake is scripted. Each
// method returns a deterministic StepObservation (it never throws for an assertion failure — a failed
// assertion is a valid observation with ok:false).
export interface PreflightPage {
  perform(step: Step): Promise<StepObservation>;
  currentUrl(): string;
  // Deterministic side-channel evidence captured continuously by the provider.
  drainConsoleErrors(): string[];        // sanitized console error lines
  drainNetworkFailures(): { method: string; path: string; status: number }[]; // sanitized (no bodies/secrets)
  // Capture the current viewport as PNG bytes for evidence upload. Null when unavailable (fake / no-op).
  captureScreenshot(): Promise<Buffer | null>;
  // Resize the viewport for the flow about to run (mobile flows run narrow so viewport-gated defects
  // reproduce; desktop flows run wide). No-op in the fake.
  setViewport(width: number, height: number): Promise<void>;

  // ── Auth primitives (S6) ──────────────────────────────────────────────────────────────────────────
  // Detect a login UI on the current page by ACCESSIBLE structure (email/username input by name/type, a
  // password input by type=password, a submit control). Structure only — never reads or returns a value.
  detectLoginUi(): Promise<LoginUi>;
  // Fill the identity field (email or username) with a value that MAY be logged only as a mask — the raw
  // value is scrubbed by the executor before any observation is recorded. Returns ok on success.
  fillIdentifier(kind: "email" | "username", value: string): Promise<boolean>;
  // Fill a SECRET field (the password). The value NEVER enters any observation, log, or artifact — it is
  // typed into the field and discarded. Returns ok on success. Callers null the value immediately after.
  fillSecret(value: string): Promise<boolean>;
  // Submit the login form (click the submit control or press Enter). Returns ok on success.
  submitLogin(): Promise<boolean>;
  // Read the current authenticated state from DETERMINISTIC evidence. `expectRoute` (a path/substring) and
  // `expectElement` (an accessible name) are optional expectations; when absent the page falls back to a
  // session/cookie presence signal. Reads no credential.
  // baselineKeys: the session-ish key names present BEFORE a sign-in was attempted. When given, only a key
  // that was NOT there already counts as evidence of a session. Omitted by callers asking "what is the
  // state now" (verify_authenticated, sign_out) rather than "did signing in work".
  readAuthState(opts?: { expectRoute?: string; expectElement?: string; baselineKeys?: string[] }): Promise<AuthState>;
  // Clear cookies + storage and open a FRESH browser context (role isolation / reset_context). After this
  // the page is unauthenticated. No-op-safe in the fake.
  resetContext(): Promise<void>;
  // Whether the flow currently executing must SKIP screenshots for the step in progress (set true while a
  // password is being entered so the artifact sink never captures a filled secret field). Executor toggles.
  screenshotsSuppressed?: boolean;
}

// Uploads run evidence (e.g. screenshots) to private storage and records it. Best-effort: an upload failure
// must NEVER fail the run (evidence is supplementary to the deterministic decision). Injected into the
// executor for real runs; absent for the in-memory fake lifecycle tests.
export interface ArtifactSink {
  saveScreenshot(runId: string, flowId: string, bytes: Buffer): Promise<void>;
}

// ── Run store (the job queue behind an interface) ────────────────────────────────────────────────────
// A test account available to THIS run, as METADATA ONLY (resolved owner-scoped at claim time; NO secret
// ever loaded here). The worker decrypts the credential lazily via openTestAccount at the moment a
// sign_in_as step for its role executes. `role` and `label` come straight from the connection meta; a
// missing meta.role falls back to the label so a role target can still resolve.
export type TestAccountRef = { connectionId: string; label: string; role: string; environment: string | null };

export type ClaimedRun = {
  runId: string;
  applicationId: string;
  // The run's owner (lowercased email). openTestAccount is owner + application scoped, so the worker needs
  // this to decrypt a sealed test account for a sign_in_as step. Empty string on a legacy fake enqueue.
  owner: string;
  deploymentUrl: string;
  environment: string;
  flows: FlowSpec[];            // the run snapshot's SELECTED approved flows (authoritative)
  // The application's approved sealed test accounts, METADATA ONLY (id, label, role, environment). Loaded
  // owner-scoped at claim time; NEVER decrypted here. Empty when the application has none. See execute-run.
  testAccounts: TestAccountRef[];
  // Whether the selection covers EVERY enabled+approved CRITICAL flow of the run's contract. A targeted
  // rerun (partial coverage) that passes proves its repair, never full production readiness: its best
  // decision is repair_verified, and it can never become the application's launch health. Computed by the
  // store at claim time from this single run's own contract snapshot — coverage is NEVER aggregated across
  // runs (different deployment URLs / contract versions must not combine into a READY).
  fullCoverage: boolean;
  // The application's test boundaries (v_applications.test_boundaries via the run's application), read at
  // claim time. null = never recorded / column unapplied — enforced as the MOST conservative policy
  // (every permit off), which is still fully backward compatible because core actions (all that existing
  // approved flows do) are always allowed. See lib/preflight/boundaries.ts.
  boundaries: TestBoundaries | null;
  leaseExpiresAt: number;       // epoch ms
};
export type FlowSpec = { flowId: string; name: string; priority: "critical" | "important" | "informational"; startPath?: string; steps: Step[]; maxMs: number; destructiveAllowed: boolean; viewport?: { width: number; height: number } };

export type FlowEvidence = { consoleErrors: string[]; networkFailures: { method: string; path: string; status: number }[] };

// Distinct AUTH failure classifications (S6). Only ONE of these is a real application finding:
// auth_rejected_by_app — the app refused VALID test credentials (a broken login). Every other code is a
// worker-config / environment / provider fact that is NEVER an application defect: it fails the flow safely,
// opens no issue, and (when nothing executed) refunds. worker_vault_failure covers a missing/malformed key
// or a decrypt failure — the run NEVER falls back to unauthenticated execution for a role-requiring flow.
export type AuthFailureCode =
  | "invalid_or_revoked_credential" // the role resolved to nothing (revoked/deleted account) — fail safe
  | "login_ui_not_found"            // no login screen detected where a sign-in was required
  | "credential_field_not_found"    // login screen present but the identity/password field was not locatable
  | "auth_rejected_by_app"          // THE application defect: valid test creds were rejected (broken login)
  | "mfa_required"                  // MFA / 2FA challenge — stop safely, manual setup required, never bypass
  | "captcha_encountered"           // CAPTCHA / bot-protection — stop safely, never attempt to bypass
  | "boundary_blocked"              // an auth action was refused by the S5 test boundaries (blocked_by_policy)
  | "worker_vault_failure"          // vault key absent/malformed, or decrypt failed — fail closed, never unauth
  | "provider_infra_failure";       // the browser provider failed during an auth step

// The auth-flow summary the UI shows (never a secret): which role was used, environment, the account LABEL
// (from meta.label, NEVER the username), the resolved credential state, and whether a successful auth
// verification was observed. Present only on authenticated flows; absent on unauthenticated ones.
export type AuthFlowMeta = {
  requiresAuth: true;
  roles: string[];                                    // role labels the flow signs into
  accountLabel: string | null;                        // meta.label of the active account (never a username)
  environment: string | null;                         // the account's environment (or the run's)
  credentialState: "active" | "missing" | "revoked";  // resolved state of the role's credential
  sessionReuse: boolean;                              // whether the flow keeps a session across sub-flows
  verifiedAuthAt: string | null;                      // ISO of the last observed successful auth (or null)
  authFailure?: AuthFailureCode;                      // set when an auth step failed (owner-safe)
};

// "blocked_by_policy" (S5): a step was REFUSED by the application's test boundaries before it executed.
// NEVER an application defect: it opens no issue, is excluded from pass/fail evidence, and can only ever
// soften a decision to needs_review (a human must widen the boundary) — never READY, never BLOCKED.
// "auth_config_failed" (S6): a role-requiring flow could not authenticate for a WORKER/ENVIRONMENT reason
// (missing/revoked credential, vault failure, MFA/CAPTCHA, provider infra). Like blocked_by_policy it is
// NEVER an application defect and opens no issue; it softens the decision to needs_review and, when NOTHING
// executed, refunds. auth_rejected_by_app is the ONE auth failure that is a real defect: it surfaces as a
// normal "failed" flow so it opens an issue like any broken journey.
export type FlowResult = {
  flowId: string;
  state: "passed" | "failed" | "blocked" | "skipped" | "blocked_by_policy" | "auth_config_failed";
  severity?: "critical" | "high" | "medium" | "low";
  steps: StepObservation[];
  evidence?: FlowEvidence;
  auth?: AuthFlowMeta;             // present only on authenticated flows
};
// ready is a LAUNCH decision and requires full critical coverage on one run target; repair_verified is the
// best outcome of a passing partial-coverage (targeted) run — the repair is proven, readiness is not.
export type RunDecision = "ready" | "needs_review" | "blocked" | "repair_verified";

export interface RunStore {
  // Atomic claim of one queued run + lease. Returns null when nothing is claimable.
  claim(workerId: string, leaseSecs: number): Promise<ClaimedRun | null>;
  // Extend the lease ONLY if this worker still owns it. Returns false if ownership was lost (worker must
  // then abort all browser work immediately).
  heartbeat(runId: string, workerId: string, leaseSecs: number): Promise<boolean>;
  // Cooperative cancellation flag set by the API.
  cancelRequested(runId: string): Promise<boolean>;
  setState(runId: string, state: string): Promise<void>;
  setProviderSession(runId: string, provider: string, providerSessionId: string): Promise<void>;
  persistFlowResult(runId: string, result: FlowResult): Promise<void>;
  // Finalize atomically: decision + summary; also settle the billing reservation (charge on completion).
  finalizeRun(runId: string, decision: RunDecision, summary: Record<string, unknown>): Promise<void>;
  // Terminal failure with a coarse code; refunds the reservation if no flow executed.
  failRun(runId: string, code: string, message: string, executedAnyFlow: boolean): Promise<void>;
}

// ── Logging (structured; secrets never included) ─────────────────────────────────────────────────────
export type LogFields = {
  worker_id?: string; run_id?: string; flow_run_id?: string; step_id?: string;
  application_id?: string; provider_session_id?: string; event: string; duration_ms?: number; result?: string;
};

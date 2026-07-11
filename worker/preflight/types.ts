// Vraelis Preflight worker — shared contracts. The worker (Railway) owns the run lifecycle; the browser
// provider (Browserbase) and the run store (Postgres) sit behind interfaces so both are replaceable and
// the whole lifecycle is testable with in-memory fakes (no DB, no browser, no credentials). Nothing here
// imports Next or a specific vendor SDK.

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
export type StepAction =
  | "navigate" | "click" | "fill" | "select" | "check" | "uncheck" | "press"
  | "wait_for" | "assert_visible" | "assert_text" | "assert_url" | "refresh"
  | "new_context" | "screenshot";

export type Step = { action: StepAction; target?: string; value?: string; expect?: string; timeoutMs?: number };

// A single deterministic observation from executing one step. `ok` is the ground truth; `detail` is a
// short factual note (never an AI interpretation). Candidate targets record what the resolver saw.
export type StepObservation = {
  action: StepAction; target?: string; ok: boolean; detail: string;
  url?: string; status?: number; screenshotRef?: string; ms: number;
  candidates?: string[];        // accessible-name candidates the resolver considered
  selected?: string;            // which candidate was chosen
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
}

// Uploads run evidence (e.g. screenshots) to private storage and records it. Best-effort: an upload failure
// must NEVER fail the run (evidence is supplementary to the deterministic decision). Injected into the
// executor for real runs; absent for the in-memory fake lifecycle tests.
export interface ArtifactSink {
  saveScreenshot(runId: string, flowId: string, bytes: Buffer): Promise<void>;
}

// ── Run store (the job queue behind an interface) ────────────────────────────────────────────────────
export type ClaimedRun = {
  runId: string;
  applicationId: string;
  deploymentUrl: string;
  environment: string;
  flows: FlowSpec[];            // approved, enabled flows only
  leaseExpiresAt: number;       // epoch ms
};
export type FlowSpec = { flowId: string; name: string; priority: "critical" | "important" | "informational"; startPath?: string; steps: Step[]; maxMs: number; destructiveAllowed: boolean; viewport?: { width: number; height: number } };

export type FlowEvidence = { consoleErrors: string[]; networkFailures: { method: string; path: string; status: number }[] };
export type FlowResult = { flowId: string; state: "passed" | "failed" | "blocked" | "skipped"; severity?: "critical" | "high" | "medium" | "low"; steps: StepObservation[]; evidence?: FlowEvidence };
export type RunDecision = "ready" | "needs_review" | "blocked";

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

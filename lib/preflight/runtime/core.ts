// Vraelis platform-neutral verification core (Multi-Platform Program, Phase A).
//
// This is the THIN CORE the adversarial redline prescribes — NOT the original 13-method mega-interface.
// It defines the runtime-independent vocabulary every execution adapter (web, api, and future
// mobile/desktop) composes: runtime targets, a capability declaration, an async run lifecycle with an
// infra-vs-product failure axis, a provenance-tagged evidence envelope, and a normalized decision grain.
//
// It contains NO execution logic and NO I/O — adapters implement the behavior. Kept as pure types +
// interfaces so it can land, be reviewed, and be built against BEFORE the web worker is touched (the web
// adapter will WRAP the existing worker, never edit it). No SQL is applied by this file; the matching
// additive migration is authored separately for the operator to run.

// ── Runtime taxonomy ────────────────────────────────────────────────────────────────────────────────
// The current product supports only "web". Every other runtime is declared here for the model's sake but
// is NOT claimed as supported until its live canary passes (public-claim progression is enforced elsewhere).
export const RUNTIME_KINDS = ["web", "api", "android", "ios", "electron", "windows", "macos"] as const;
export type RuntimeKind = (typeof RUNTIME_KINDS)[number];

// A runtime target = one platform surface of a product (a web deployment, an API base, an Android build...).
// One application may declare several targets; they share the requirements graph, roles, and issue/repair/
// release history, but each carries its own builds, flows, matrix, credentials, evidence, and DECISION.
export type RuntimeTarget = {
  id: string;
  applicationId: string;
  kind: RuntimeKind;
  label: string;                 // owner-facing ("Web production", "Public API", "Android beta")
  environment: string | null;    // production | preview | staging | ...
};

// ── Capability model ────────────────────────────────────────────────────────────────────────────────
// Each adapter DECLARES the semantic step classes and evidence kinds it supports. The core rejects any flow
// step an adapter doesn't declare (a flow can't contain a step its runtime can't run). This is the fix for
// the "leaked web assumptions" risk: screenshots, viewports, URLs are capabilities, not universal methods.
export type StepClass =
  // universal
  | "navigate" | "act" | "input" | "assert_text" | "assert_state" | "assert_route" | "reset"
  // auth
  | "sign_in" | "sign_out" | "verify_auth"
  // web/mobile/desktop interaction
  | "viewport" | "screenshot" | "gesture" | "lifecycle" | "window" | "menu" | "permission" | "deep_link"
  // api
  | "http_request" | "http_auth" | "assert_status" | "assert_schema" | "assert_json" | "extract" | "verify_persisted";

export type EvidenceKind = "image" | "log" | "http_txn" | "state_snapshot" | "console" | "network";

export type AdapterCapabilities = {
  runtime: RuntimeKind;
  version: string;               // capability-set version (pinned onto each run for reproducibility)
  steps: ReadonlySet<StepClass>;
  evidence: ReadonlySet<EvidenceKind>;
  // Does this runtime execute an UNTRUSTED customer artifact (binary/installer)? Governs isolation policy.
  // web + api = false; android/ios/desktop = true. Gated: no true-artifact runtime runs until red-teamed.
  executesUntrustedArtifact: boolean;
};

// ── Async run lifecycle ─────────────────────────────────────────────────────────────────────────────
// The redline's core fix: a run is a LIFECYCLE, not a synchronous step call. Web collapses most states
// (running -> analyzing -> completed/failed/cancelled), but device/binary runtimes need the full set so a
// provider drop mid-install is "infra_failure", never a false "blocked" (product failure).
export const RUN_STATES = [
  "queued", "provisioning", "downloading_artifact", "validating_artifact", "installing", "launching",
  "waiting_ready", "executing", "backgrounded", "disconnected", "retrying", "collecting_evidence",
  "cleaning_up", "cleanup_failed", "quarantined", "completed", "timed_out", "cancelled",
  "infra_failure", "indeterminate",
] as const;
export type RunState = (typeof RUN_STATES)[number];

// Every failure MUST be classified before a decision. This is what prevents a counterfeit BLOCKED: an
// infra failure (provider lost the device) is NOT a product defect and must never read as a launch blocker.
export type FailureClass = "infra" | "product" | "indeterminate";

// ── Provenance-tagged evidence envelope ─────────────────────────────────────────────────────────────
// The redline demands evidence carry provenance so provider-attested evidence is never silently treated as
// Vraelis-verified. A READY may not rest on provider_attested evidence alone.
export type EvidenceProvenance = "factual" | "inferred" | "provider_attested" | "vraelis_generated";

export type EvidenceItem = {
  kind: EvidenceKind;
  provenance: EvidenceProvenance;
  capturedAt: string;            // ISO; the adapter's clock, recorded for chain-of-custody
  // Opaque, already-REDACTED payload reference. The core never holds a secret; adapters redact before this.
  ref: string;                   // storage ref / inline sanitized text depending on kind
  meta?: Record<string, string>; // sanitized, non-secret (status, path, orientation, window, device...)
};

// ── One executed step's observation (runtime-neutral) ───────────────────────────────────────────────
export type StepObservation = {
  stepClass: StepClass;
  ok: boolean;
  detail: string;                // owner-safe outcome; never a secret
  ms: number;
  evidence: EvidenceItem[];      // 0..n; kinds must be declared in the adapter's capabilities
};

// ── Normalized flow result + decision grain ─────────────────────────────────────────────────────────
export type FlowState = "passed" | "failed" | "blocked" | "skipped" | "blocked_by_policy" | "auth_not_ready";
export type FlowResult = { flowId: string; state: FlowState; steps: StepObservation[] };

// The launch decisions — identical vocabulary to the web engine (worker/preflight/types.ts RunDecision)
// plus the infra + not-verified states the multi-runtime model needs at the product level.
export type Decision = "ready" | "needs_review" | "blocked" | "repair_verified" | "infra_failure" | "not_verified";

// A decision is bound to an EXACT (target, build, env, contract version, matrix) — NEVER to the application.
// This is what stops an Android READY from implying web coverage, or a web decision from being read as the
// product's state. The product-level state is a DERIVED per-target matrix, never a single scalar.
export type DecisionBinding = {
  applicationId: string;
  runtimeTargetId: string;
  runtimeKind: RuntimeKind;
  buildId: string;
  environment: string | null;
  contractVersion: number;
  matrixHash: string;            // hash of the device/browser matrix this decision covers
  adapterVersion: string;        // pins the capability set for reproducibility
};

export type PlatformDecision = { binding: DecisionBinding; decision: Decision; failureClass?: FailureClass; summary: Record<string, unknown> };

// The product rollup: per-target, never collapsed. "READY ON web,api / BLOCKED ON android / NOT VERIFIED ios".
export type ProductRollup = {
  applicationId: string;
  perTarget: { runtimeTargetId: string; runtimeKind: RuntimeKind; label: string; decision: Decision }[];
};

// A target with no passing full-coverage run is NOT_VERIFIED by default — never inherits another target's
// READY. Pure helper so the rollup rule lives in one place.
export function rollupProduct(applicationId: string, per: ProductRollup["perTarget"]): ProductRollup {
  return { applicationId, perTarget: per };
}

// ── The composed adapter surface (thin core) ────────────────────────────────────────────────────────
// Per the redline: NOT one 13-method interface. The adapter is a thin orchestrator that exposes a small
// neutral surface; heavier concerns (session lifecycle, artifact install, evidence collection, cost) are
// separate composed interfaces so lifecycle/security/testing boundaries are real and independently testable.

export interface CapabilityProvider {
  capabilities(): AdapterCapabilities;
}

// A generic semantic step: { stepClass, and a runtime-interpreted payload }. The concrete per-runtime step
// shapes (web {action,target,value,expect}; api ApiStep) are validated by each adapter; the core only needs
// the class to enforce capability support.
export type SemanticStep = { stepClass: StepClass; payload: unknown };

export interface ExecutionAdapter extends CapabilityProvider {
  // Cheap, pre-run validations (no session): is this a target/build this adapter can run?
  validateTarget(target: RuntimeTarget): { ok: boolean; reason?: string };
  // A capability check the core uses to reject a flow with an unsupported step BEFORE any session/cost.
  supportsStep(stepClass: StepClass): boolean;
  // Execute one semantic step inside an active session, returning a neutral observation.
  executeStep(step: SemanticStep): Promise<StepObservation>;
  // Classify the terminal failure (infra vs product) — mandatory before a decision.
  classifyFailure(state: RunState, detail: string): FailureClass;
}

// Session lifecycle is split out because web (short, synchronous) and device (long, reconnectable) differ
// fundamentally. Web's implementation wraps the existing createBrowserSession/close; it is not edited.
export interface SessionProvider {
  createSession(target: RuntimeTarget, build: { id: string; ref: string }): Promise<{ sessionId: string }>;
  reconnect?(sessionId: string): Promise<boolean>;   // device runtimes only
  reset(sessionId: string): Promise<{ ok: boolean }>; // role/state reset; returns success (cleanup can fail)
  terminate(sessionId: string): Promise<{ ok: boolean }>;
}

// Evidence normalization + provenance + redaction is cross-cutting and security-relevant, so it is uniform
// across adapters and independently testable — not baked into each adapter.
export interface EvidenceCollector {
  // Given a raw, adapter-produced item, tag provenance and ensure it is redacted before it is recorded.
  normalize(raw: { kind: EvidenceKind; provenance: EvidenceProvenance; payload: string; meta?: Record<string, string>; capturedAt: string }): EvidenceItem;
}

// Cost settlement is audited money and per-runtime (web seconds vs api requests vs device minutes), kept
// out of the execution path.
export type UsageUnit = "web_second" | "api_request" | "emulator_minute" | "device_minute" | "runner_minute" | "artifact_byte";
export interface CostMeter {
  record(runId: string, unit: UsageUnit, quantity: number): Promise<void>;
}

// Artifact install is the SOLE untrusted-code entry point; present ONLY for binary runtimes, absent for
// web/api. Isolated by policy; nothing here runs until the isolation red-team passes (gated).
export interface ArtifactInstaller {
  validateArtifact(ref: string, expectedHash: string): Promise<{ ok: boolean; reason?: string }>;
  install(sessionId: string, ref: string): Promise<{ ok: boolean; reason?: string }>;
}

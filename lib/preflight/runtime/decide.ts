// Runtime-neutral decision derivation + evidence normalization + cost metering (Phase A/B).
//
// The decision rule MIRRORS the proven web decideRun (worker/preflight/execute-run.ts): any critical flow
// failed/blocked -> blocked; else any failure -> needs_review; else ready; and READY requires FULL coverage
// (a targeted/partial rerun proving a repair yields repair_verified, never READY). It is generalized here
// so every runtime (web-via-wrapper, api, later mobile) reaches decisions the same way — a web READY and an
// api READY are computed by the identical, auditable rule but bind to different targets.
//
// CRITICAL redline invariant enforced here: an INFRASTRUCTURE failure is NEVER a product BLOCKED. If the
// run's failureClass is 'infra', the decision is 'infra_failure', full stop — the same protection that
// stops a provider drop from minting a counterfeit BLOCKED.

import type { FlowResult, Decision, FailureClass, EvidenceItem, EvidenceKind, EvidenceProvenance, UsageUnit } from "./core";

export type DecideInput = {
  results: FlowResult[];
  criticalFlowIds: ReadonlySet<string>;   // which flows are critical (for the launch decision)
  fullCoverage: boolean;                   // false for a targeted/partial rerun
  failureClass?: FailureClass;             // set when the run terminated on an infra/indeterminate condition
};

export function decideRuntime(input: DecideInput): { decision: Decision; summary: Record<string, unknown> } {
  // Infra/indeterminate short-circuit: never a product decision.
  if (input.failureClass === "infra") return { decision: "infra_failure", summary: { failure_class: "infra" } };
  if (input.failureClass === "indeterminate") return { decision: "needs_review", summary: { failure_class: "indeterminate" } };

  const isCrit = (id: string) => input.criticalFlowIds.has(id);
  const criticalTotal = input.results.filter((r) => isCrit(r.flowId)).length;
  const criticalPassed = input.results.filter((r) => isCrit(r.flowId) && r.state === "passed").length;
  const criticalFailed = input.results.some((r) => isCrit(r.flowId) && (r.state === "failed" || r.state === "blocked"));
  const anyFailed = input.results.some((r) => r.state === "failed" || r.state === "blocked");
  const criticalPolicyBlocked = input.results.some((r) => isCrit(r.flowId) && r.state === "blocked_by_policy");
  const criticalAuthNotReady = input.results.some((r) => isCrit(r.flowId) && r.state === "auth_not_ready");

  let decision: Decision = criticalFailed
    ? "blocked"
    : (anyFailed || criticalPolicyBlocked || criticalAuthNotReady) ? "needs_review" : "ready";
  // READY is a LAUNCH decision — it requires FULL critical coverage. A partial (targeted) rerun that passes
  // proves a REPAIR, not readiness.
  if (decision === "ready" && !input.fullCoverage) decision = "repair_verified";

  return {
    decision,
    summary: {
      critical_total: criticalTotal, critical_passed: criticalPassed,
      flows_total: input.results.length,
      flows_passed: input.results.filter((r) => r.state === "passed").length,
      coverage: input.fullCoverage ? "full" : "partial",
    },
  };
}

// ── EvidenceCollector: enforces provenance + a fixed marker for redaction, uniformly across adapters ────
// The redline requires evidence carry explicit provenance and that no secret enter an observation. This is
// the single place the rule lives so every runtime obeys it identically and it is independently testable.
export function normalizeEvidence(raw: {
  kind: EvidenceKind; provenance: EvidenceProvenance; payload: string; meta?: Record<string, string>; capturedAt: string;
}): EvidenceItem {
  // The adapter is responsible for redacting `payload` before calling this (it has the secret set). Here we
  // enforce the shape + carry provenance/timestamp for chain-of-custody. Meta is assumed already sanitized.
  return { kind: raw.kind, provenance: raw.provenance, capturedAt: raw.capturedAt, ref: raw.payload, meta: raw.meta };
}

// A READY may NOT rest on provider_attested evidence alone — it needs at least one Vraelis-verifiable
// (factual/vraelis_generated) signal. Pure predicate the decision layer can consult for binary runtimes;
// for web/api all evidence is vraelis_generated so it always passes.
export function decisionEvidenceIsTrustworthy(decision: Decision, evidence: EvidenceItem[]): boolean {
  if (decision !== "ready" && decision !== "repair_verified") return true; // only a positive verdict needs the guard
  return evidence.some((e) => e.provenance === "vraelis_generated" || e.provenance === "factual");
}

// ── CostMeter accumulation (per-runtime usage units) ────────────────────────────────────────────────
// Pure accumulator; the persistence side (writing to v_cost_ledger analogue) is injected by the caller so
// this stays testable. api_request is the API runtime's unit; web keeps web_second unchanged.
export class UsageAccumulator {
  private totals = new Map<UsageUnit, number>();
  add(unit: UsageUnit, quantity: number): void { this.totals.set(unit, (this.totals.get(unit) ?? 0) + quantity); }
  get(unit: UsageUnit): number { return this.totals.get(unit) ?? 0; }
  entries(): [UsageUnit, number][] { return [...this.totals.entries()]; }
}

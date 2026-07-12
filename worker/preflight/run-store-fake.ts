// In-memory RunStore for deterministic lifecycle tests (no DB, no applied migration). Models the same
// contract the Postgres store will implement: atomic claim + lease, ownership-checked heartbeat,
// cancellation, incremental persistence, atomic finalize, and billing settlement. Single-process only.
import type { RunStore, ClaimedRun, FlowResult, RunDecision, FlowSpec } from "./types";

type Row = {
  runId: string; applicationId: string; deploymentUrl: string; environment: string; flows: FlowSpec[];
  state: string; decision: RunDecision | null; summary: Record<string, unknown>;
  leaseOwner: string | null; leaseExpiresAt: number; attempts: number; maxAttempts: number;
  cancelRequested: boolean; provider: string | null; providerSessionId: string | null;
  flowResults: FlowResult[]; failureCode: string | null; billing: "held" | "charged" | "refunded";
};

export class FakeRunStore implements RunStore {
  private rows = new Map<string, Row>();
  constructor(private now: () => number = () => Date.now()) {}

  // ── test helpers ──
  enqueue(input: { runId: string; applicationId: string; deploymentUrl: string; environment?: string; flows: FlowSpec[]; maxAttempts?: number }) {
    this.rows.set(input.runId, {
      runId: input.runId, applicationId: input.applicationId, deploymentUrl: input.deploymentUrl, environment: input.environment ?? "preview",
      flows: input.flows, state: "queued", decision: null, summary: {}, leaseOwner: null, leaseExpiresAt: 0,
      attempts: 0, maxAttempts: input.maxAttempts ?? 3, cancelRequested: false, provider: null, providerSessionId: null,
      flowResults: [], failureCode: null, billing: "held",
    });
  }
  get(runId: string) { return this.rows.get(runId); }
  requestCancel(runId: string) { const r = this.rows.get(runId); if (r) r.cancelRequested = true; }
  expireLease(runId: string) { const r = this.rows.get(runId); if (r) r.leaseExpiresAt = this.now() - 1; } // force lease loss

  // ── RunStore ──
  async claim(workerId: string, leaseSecs: number): Promise<ClaimedRun | null> {
    for (const r of this.rows.values()) {
      const claimable = (r.state === "queued") && (!r.leaseOwner || r.leaseExpiresAt < this.now());
      if (!claimable) continue;
      if (r.attempts >= r.maxAttempts) { r.state = "failed"; r.failureCode = "max_attempts"; if (r.billing === "held") r.billing = "refunded"; continue; }
      r.state = "running"; r.leaseOwner = workerId; r.leaseExpiresAt = this.now() + leaseSecs * 1000; r.attempts += 1;
      return { runId: r.runId, applicationId: r.applicationId, deploymentUrl: r.deploymentUrl, environment: r.environment, flows: r.flows, leaseExpiresAt: r.leaseExpiresAt };
    }
    return null;
  }
  async heartbeat(runId: string, workerId: string, leaseSecs: number): Promise<boolean> {
    const r = this.rows.get(runId);
    if (!r || r.leaseOwner !== workerId || r.leaseExpiresAt < this.now()) return false; // lost ownership
    if (r.cancelRequested) return false;                                                // stop extending on cancel
    r.leaseExpiresAt = this.now() + leaseSecs * 1000; return true;
  }
  async cancelRequested(runId: string): Promise<boolean> { return !!this.rows.get(runId)?.cancelRequested; }
  async setState(runId: string, state: string): Promise<void> { const r = this.rows.get(runId); if (r) r.state = state; }
  async setProviderSession(runId: string, provider: string, providerSessionId: string): Promise<void> { const r = this.rows.get(runId); if (r) { r.provider = provider; r.providerSessionId = providerSessionId; } }
  async persistFlowResult(runId: string, result: FlowResult): Promise<void> { this.rows.get(runId)?.flowResults.push(result); }
  async finalizeRun(runId: string, decision: RunDecision, summary: Record<string, unknown>): Promise<void> {
    const r = this.rows.get(runId); if (!r) return;
    r.state = "completed"; r.decision = decision; r.summary = summary; r.leaseOwner = null;
    if (r.billing === "held") r.billing = "charged";            // charge on completion (any flow executed)
  }
  async failRun(runId: string, code: string, message: string, executedAnyFlow: boolean): Promise<void> {
    const r = this.rows.get(runId); if (!r) return;
    // Requeue if attempts remain and it wasn't a terminal/cancel; else fail terminally. target_mismatch is
    // deterministic (a retry cannot heal it), so it is terminal immediately, matching the Postgres store.
    const terminal = code === "cancelled" || code === "target_mismatch" || r.attempts >= r.maxAttempts;
    r.state = terminal ? "failed" : "queued"; r.failureCode = code; r.leaseOwner = null; r.leaseExpiresAt = 0;
    if (!executedAnyFlow && r.billing === "held") r.billing = "refunded"; // no charge if nothing ran
  }
}

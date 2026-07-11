// The worker loop: poll -> claim -> execute -> repeat, with a background heartbeat (belt-and-suspenders
// alongside the executor's per-step heartbeat) and graceful shutdown. Concurrency-capped. Framework-free
// (no Next request lifecycle). Real deployment wires a RunStore (Postgres) + BrowserProvider (Browserbase);
// tests wire the fakes.
import type { BrowserProvider, RunStore } from "./types";
import type { WorkerConfig } from "./config";
import { executeRun, type ExecLimits } from "./execute-run";
import { log } from "./redaction";

export class PreflightWorker {
  private stopping = false;
  private active = 0;
  private loopDone: Promise<void> | null = null;
  constructor(private cfg: WorkerConfig, private store: RunStore, private provider: BrowserProvider) {}

  private limits(): ExecLimits {
    return { leaseSecs: this.cfg.leaseSecs, maxRunMs: this.cfg.maxRunMs, maxFlowMs: this.cfg.maxFlowMs, maxStepsPerFlow: this.cfg.maxStepsPerFlow };
  }

  // Claim + execute a single run (used by the loop and directly by tests).
  async tick(): Promise<boolean> {
    if (this.stopping || this.active >= this.cfg.maxConcurrentRuns) return false;
    const run = await this.store.claim(this.cfg.workerId, this.cfg.leaseSecs);
    if (!run) return false;
    this.active++;
    // Background heartbeat extends the lease during long steps; the executor also heartbeats per step and
    // aborts on loss/cancel, so a heartbeat failure here is non-fatal.
    const hb = setInterval(() => { void this.store.heartbeat(run.runId, this.cfg.workerId, this.cfg.leaseSecs).catch(() => {}); }, this.cfg.heartbeatSecs * 1000);
    try {
      await executeRun(run, { store: this.store, provider: this.provider, workerId: this.cfg.workerId, limits: this.limits() });
    } finally {
      clearInterval(hb);
      this.active--;
    }
    return true;
  }

  start(): void {
    this.loopDone = (async () => {
      while (!this.stopping) {
        const did = await this.tick().catch((e) => { log({ worker_id: this.cfg.workerId, event: "tick_error", result: (e as Error).message.slice(0, 120) }); return false; });
        if (!did) await new Promise((r) => setTimeout(r, this.cfg.pollMs)); // idle backoff
      }
    })();
  }

  // Stop claiming, let in-flight runs finish (the executor is bounded), then resolve. Called from
  // SIGTERM/SIGINT handlers; the executor closes provider sessions in its finally.
  async shutdown(graceMs = 30000): Promise<void> {
    this.stopping = true;
    log({ worker_id: this.cfg.workerId, event: "shutdown_begin", result: `active=${this.active}` });
    const deadline = Date.now() + graceMs;
    while (this.active > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    if (this.loopDone) await Promise.race([this.loopDone, new Promise((r) => setTimeout(r, 1000))]);
    log({ worker_id: this.cfg.workerId, event: "shutdown_done", result: `active=${this.active}` });
  }

  health(): { workerId: string; stopping: boolean; active: number } {
    return { workerId: this.cfg.workerId, stopping: this.stopping, active: this.active };
  }
}

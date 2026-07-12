// Worker configuration from server-only env. Fails fast + clearly when configured for Browserbase but
// credentials are missing. Never logs secret VALUES (only presence). A stable generated worker id is used
// when PREFLIGHT_WORKER_ID is absent.
import crypto from "node:crypto";

export type WorkerConfig = {
  workerId: string;
  provider: "browserbase" | "fake" | "local";
  browserbase?: { apiKey: string };
  pollMs: number; leaseSecs: number; heartbeatSecs: number;
  maxRunMs: number; maxFlowMs: number; maxStepsPerFlow: number; maxConcurrentRuns: number;
};

const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const provider = (env.BROWSER_PROVIDER || "fake").toLowerCase() as WorkerConfig["provider"];
  // A production worker may NEVER run a non-real browser: the fake provider "passes" every step in
  // milliseconds, so a misconfigured deploy would mint counterfeit READY decisions into customer data
  // (this happened: a Railway service without BROWSER_PROVIDER defaulted to fake and finalized a READY).
  // Fail the boot loudly instead — there is deliberately no override.
  if (env.NODE_ENV === "production" && provider !== "browserbase") {
    throw new Error(`BROWSER_PROVIDER is "${env.BROWSER_PROVIDER || "(unset)"}" but this is a production runtime (NODE_ENV=production): a deployed worker must run a real browser. Set BROWSER_PROVIDER=browserbase and BROWSERBASE_API_KEY on the service. The fake provider exists only for local lifecycle tests.`);
  }
  const cfg: WorkerConfig = {
    workerId: env.PREFLIGHT_WORKER_ID || `worker-${crypto.randomBytes(4).toString("hex")}`,
    provider: provider === "browserbase" || provider === "local" ? provider : "fake",
    pollMs: num(env.PREFLIGHT_WORKER_POLL_MS, 2000),
    leaseSecs: num(env.PREFLIGHT_WORKER_LEASE_SECONDS, 90),
    heartbeatSecs: num(env.PREFLIGHT_WORKER_HEARTBEAT_SECONDS, 20),
    maxRunMs: num(env.PREFLIGHT_MAX_RUN_SECONDS, 900) * 1000,
    maxFlowMs: num(env.PREFLIGHT_MAX_FLOW_SECONDS, 180) * 1000,
    maxStepsPerFlow: num(env.PREFLIGHT_MAX_STEPS_PER_FLOW, 30),
    maxConcurrentRuns: num(env.PREFLIGHT_MAX_CONCURRENT_RUNS, 1),
  };
  if (cfg.provider === "browserbase") {
    const apiKey = env.BROWSERBASE_API_KEY;
    if (!apiKey) {
      throw new Error("BROWSER_PROVIDER=browserbase but BROWSERBASE_API_KEY is missing. Set it (server-only, never NEXT_PUBLIC) or use BROWSER_PROVIDER=fake for lifecycle tests. The Browserbase project is inferred from the API key; no project id is needed.");
    }
    cfg.browserbase = { apiKey };
  }
  // Loud one-time startup notes for operational flags (loadWorkerConfig runs once at boot). Values only,
  // never secrets.
  if (env.PREFLIGHT_SEED_ALLOW_PROD === "1") {
    console.warn("[preflight-worker] unsafe flag set: PREFLIGHT_SEED_ALLOW_PROD=1 lets seed/fixture scripts target production. Unset it when the deliberate seeding session is over.");
  }
  if (env.VRAELIS_RUNS_DISABLED === "1") {
    console.warn("[preflight-worker] kill switch is ON (VRAELIS_RUNS_DISABLED=1): the app routes refuse NEW runs; this worker keeps draining already-claimed work until the queue is empty.");
  }
  return cfg;
}

// Presence-only summary (safe to log at startup).
export function configSummary(c: WorkerConfig): Record<string, unknown> {
  return { workerId: c.workerId, provider: c.provider, browserbaseConfigured: !!c.browserbase, pollMs: c.pollMs, leaseSecs: c.leaseSecs, maxRunMs: c.maxRunMs, maxConcurrentRuns: c.maxConcurrentRuns };
}

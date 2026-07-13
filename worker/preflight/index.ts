// Vraelis Preflight worker entrypoint (Railway). Long-running; NOT a Next request. Loads config (fails
// fast on missing Browserbase creds), builds the Postgres run store + the configured browser provider,
// starts the claim loop, exposes a health endpoint for Railway, and shuts down gracefully on SIGTERM/
// SIGINT (stop claiming, let the bounded in-flight run finish, close sessions, exit).
import http from "node:http";
import { loadLocalEnv } from "./local-env";
import { loadWorkerConfig, configSummary } from "./config";
import { PreflightWorker } from "./worker";
import { PostgresRunStore } from "./run-store-postgres";
import { FakeBrowserProvider } from "./providers/fake";
import { BrowserbaseBrowserProvider } from "./providers/browserbase";
import { uploadPreflightArtifact, artifactObjectPath } from "../../lib/preflight/artifacts";
import { openTestAccount } from "../../lib/preflight/connections-db";
import { vaultConfigured } from "../../lib/preflight/secret-vault";
import type { BrowserProvider, ArtifactSink } from "./types";
import type { WorkerAuthDeps } from "./worker";
import { log } from "./redaction";

async function main() {
  // Local dev: load .env.local / .env / .env.preflight so the worker connects without exporting env by hand.
  // On Railway (env injected into process.env, no .env files) this is a no-op and never overrides a set var.
  loadLocalEnv();
  const cfg = loadWorkerConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Worker needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only).");

  const store = new PostgresRunStore(url, key);
  let provider: BrowserProvider;
  if (cfg.provider === "browserbase") provider = new BrowserbaseBrowserProvider(cfg.browserbase!);
  else provider = new FakeBrowserProvider(); // "fake"/"local": deterministic no-op browser for dev/tests
  log({ event: "worker_start", ...configSummary(cfg) } as never);

  // Real evidence sink: upload each flow's screenshot to the DEDICATED private artifact bucket + record it.
  // Only wired for the real browser path. Best-effort inside the executor: a missing bucket throws
  // ArtifactBucketMissingError, which the executor logs (artifact_save_failed) without failing the run.
  const artifacts: ArtifactSink | undefined = cfg.provider === "browserbase" ? {
    async saveScreenshot(runId, flowId, bytes) {
      const path = artifactObjectPath(runId, "screenshot", "png");
      await uploadPreflightArtifact(path, bytes, "image/png");
      await store.persistArtifact(runId, flowId, path, "screenshot");
    },
  } : undefined;

  // Auth deps (S6): the credential opener is openTestAccount (owner+application scoped, decrypt-at-use); it
  // is bound to the SAME service-role client the store uses. vaultConfigured lets the executor fail closed
  // when VRAELIS_SECRET_KEY is absent/malformed WITHOUT falling back to unauthenticated execution. Both are
  // read-only w.r.t. the credential and NEVER echo a value. A run that touches no auth step never calls them.
  const auth: WorkerAuthDeps = { credentialOpener: openTestAccount, vaultConfigured: vaultConfigured() };
  if (!auth.vaultConfigured) log({ worker_id: cfg.workerId, event: "vault_unconfigured", result: "auth flows will fail closed (set VRAELIS_SECRET_KEY)" });

  const worker = new PreflightWorker(cfg, store, provider, artifacts, auth);
  worker.start();

  // Health endpoint for Railway (no secrets).
  const port = Number(process.env.PORT) || 8080;
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, ...worker.health() })); }
    else { res.writeHead(404); res.end(); }
  });
  server.listen(port, () => log({ worker_id: cfg.workerId, event: "health_listening", result: String(port) }));

  const stop = async (sig: string) => {
    log({ worker_id: cfg.workerId, event: "signal", result: sig });
    server.close();
    await worker.shutdown(Number(process.env.PREFLIGHT_SHUTDOWN_GRACE_MS) || 30000);
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((e) => { console.error("worker fatal:", (e as Error).message); process.exit(1); });

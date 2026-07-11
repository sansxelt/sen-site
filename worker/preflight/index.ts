// Vraelis Preflight worker entrypoint (Railway). Long-running; NOT a Next request. Loads config (fails
// fast on missing Browserbase creds), builds the Postgres run store + the configured browser provider,
// starts the claim loop, exposes a health endpoint for Railway, and shuts down gracefully on SIGTERM/
// SIGINT (stop claiming, let the bounded in-flight run finish, close sessions, exit).
import http from "node:http";
import { loadWorkerConfig, configSummary } from "./config";
import { PreflightWorker } from "./worker";
import { PostgresRunStore } from "./run-store-postgres";
import { FakeBrowserProvider } from "./providers/fake";
import { BrowserbaseBrowserProvider } from "./providers/browserbase";
import type { BrowserProvider } from "./types";
import { log } from "./redaction";

async function main() {
  const cfg = loadWorkerConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Worker needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only).");

  const store = new PostgresRunStore(url, key);
  let provider: BrowserProvider;
  if (cfg.provider === "browserbase") provider = new BrowserbaseBrowserProvider(cfg.browserbase!);
  else provider = new FakeBrowserProvider(); // "fake"/"local": deterministic no-op browser for dev/tests
  log({ event: "worker_start", ...configSummary(cfg) } as never);

  const worker = new PreflightWorker(cfg, store, provider);
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

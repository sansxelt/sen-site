# Worker deploy runbook (Railway)

Operator guide for deploying the Preflight worker to a host. Railway is the chosen target. **This deploy has
not been executed yet**; it is explicitly gated by the founder (see docs/v1-release-progress.md, Blockers).
Everything below describes artifacts that already exist in the repo (`worker/preflight/Dockerfile`,
`worker/preflight/railway.toml`, the worker itself) and how to use them when the gate opens.

Prerequisite: the full local loop must already pass, per docs/preflight-activation.md (migrations applied,
`npm run preflight:verify-db` green, `npm run preflight:worker:test` all-pass, the Browserbase smoke green
against the owned fixture). Do not deploy a worker whose local loop has never run.

---

## 1. What gets deployed

One long-running Node process (`worker/preflight/index.ts`). It polls the queue in the existing Supabase
(`v_preflight_claim` RPC), drives an isolated Browserbase browser over CDP, persists results incrementally,
computes the launch decision, settles billing, and uploads screenshots to the private artifact bucket.

It is deployed as its **own Railway service**, separate from the Next web app on Vercel. It shares only the
Supabase data plane with the web app.

- Dockerfile: `worker/preflight/Dockerfile`. Base `node:24-slim`, installs the repo deps plus the two
  worker-only runtime deps (`playwright-core`, `@browserbasehq/sdk`) and `tsx`. No local Chromium is
  installed; Browserbase hosts the browser and the worker only connects to it.
- Service config: `worker/preflight/railway.toml`. Dockerfile builder, start command
  `npx tsx worker/preflight/index.ts`, health check on `/health` (30s timeout), restart policy `on_failure`
  with max 10 retries.

Point the Railway service at this repo with that Dockerfile path. Build context is the repo root (the worker
imports shared `lib/` code).

## 2. Required environment variables

Set these in the Railway service environment. The canonical list lives in `.env.preflight.example`; the table
below is the deploy-time view. Every value marked secret is server-only.

| Variable | Required | Value / default | Notes |
| --- | --- | --- | --- |
| `BROWSER_PROVIDER` | yes | `browserbase` | `fake` exists only for the deterministic lifecycle test. |
| `BROWSERBASE_API_KEY` | yes | secret | The project is inferred from the key; there is **no project id variable**. Worker fails fast at boot if missing. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | same URL the web app uses | The name carries `NEXT_PUBLIC_` for historical reasons; the URL itself is not a secret. Must point at the SAME Supabase project as the web app or the queue and the reports split. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | secret | Bypasses RLS. Never expose, never rename to a `NEXT_PUBLIC_` name. |
| `PREFLIGHT_WORKER_ID` | optional | stable id, e.g. `railway-1` | A random id is generated when absent; a stable one makes logs and lease ownership easier to read. |
| `PREFLIGHT_WORKER_POLL_MS` | optional | 2000 | Claim poll interval. |
| `PREFLIGHT_WORKER_LEASE_SECONDS` | optional | 90 | Run lease length. Governs how fast a dead worker's run is recovered. |
| `PREFLIGHT_WORKER_HEARTBEAT_SECONDS` | optional | 20 | Lease renewal interval. |
| `PREFLIGHT_SHUTDOWN_GRACE_MS` | optional | 30000 | Drain window on SIGTERM. |
| `PREFLIGHT_MAX_RUN_SECONDS` | optional | 900 | Per-run cap. |
| `PREFLIGHT_MAX_FLOW_SECONDS` | optional | 180 | Per-flow cap. |
| `PREFLIGHT_MAX_STEPS_PER_FLOW` | optional | 30 | Per-flow step cap. |
| `PREFLIGHT_MAX_CONCURRENT_RUNS` | optional | 1 | In-flight runs per worker instance. Leave at 1 for launch. |
| `PORT` | provided by Railway | | The health endpoint binds to it (default 8080 when absent). Do not set by hand. |

Not needed on the worker: `VRAELIS_PREFLIGHT_INTERNAL_ONLY`, `NEXT_PUBLIC_VRAELIS_PREFLIGHT`, and the other
web-app flags. Those gate the Vercel routes, not the worker.

## 3. Health endpoint

The worker serves `GET /health` (and `GET /`) on `PORT`:

```json
{ "ok": true, "workerId": "railway-1", "stopping": false, "active": 0 }
```

No secrets, no run payloads. Railway's health check (`healthcheckPath = "/health"`, 30s timeout) uses it to
gate deploys; you can also curl it directly to confirm liveness. `active` is the number of in-flight runs;
`stopping` flips to true during a drain.

## 4. Restart policy and crash behavior

`railway.toml` sets `restartPolicyType = "on_failure"` with `restartPolicyMaxRetries = 10`. The worker exits
non-zero only on a fatal boot error (missing Browserbase key, missing Supabase env), so a crash loop at deploy
time almost always means a missing or wrong env var; read the first log line, it says exactly what is absent
and never prints a value.

A worker that dies mid-run does not lose the run: see section 7.

## 5. Scaling

Start with **1 instance** and `PREFLIGHT_MAX_CONCURRENT_RUNS=1`. That is one browser session at a time, which
matches the launch posture and the current Browserbase allowance.

When more throughput is needed, two independent knobs, in preferred order:

1. More instances at concurrency 1. The claim RPC (`v_preflight_claim`) is advisory-locked and atomic, so
   multiple workers never double-claim a run, and the lease reaper is idempotent across workers. Give each
   instance its own `PREFLIGHT_WORKER_ID`.
2. Raise `PREFLIGHT_MAX_CONCURRENT_RUNS` per instance. Each concurrent run is a live Browserbase session, so
   check the Browserbase plan limit first.

The per-owner cap (2 active runs per owner, enforced in the web routes) is separate and does not change with
worker scale.

## 6. Graceful shutdown (SIGTERM drain)

Railway sends SIGTERM on redeploy and stop. The worker traps it and:

1. Stops claiming new runs and closes the health server.
2. Lets the bounded in-flight run finish, up to `PREFLIGHT_SHUTDOWN_GRACE_MS` (default 30s). Runs are hard-
   capped by `PREFLIGHT_MAX_RUN_SECONDS`, so the drain is finite either way.
3. Closes browser sessions (the executor closes its session in a finally block) and exits 0.

If the grace window expires with a run still going, the process exits anyway; that run's lease then expires
and it is requeued (section 7). Nothing is stranded. If typical runs exceed 30s, raise the grace window
toward the run cap so redeploys do not routinely cut runs short.

## 7. Provider outage / dead-worker behavior

- A run in flight when the worker dies (or Browserbase drops) stays `running` with a lease that stops being
  renewed. Every claim cycle (at most every 30s) the lease reaper finds expired-lease running runs and routes
  them through the normal failure path: attempts remaining means requeued (the credit hold is kept for the
  retry); attempts exhausted (`max_attempts`, default 3) means terminal `failed` with
  `failure_code = lease_expired`.
- A provider failure before any browser work (session create fails) is a failed attempt the same way:
  requeue while attempts remain, terminal after `max_attempts`.
- Refunds: a terminal failure where **no flow ever executed** refunds the full credit hold. If flows did
  execute, the hold is retained (flat per-run pricing; completed work is settled). This is automatic; do not
  hand-edit the ledger.
- During a full Browserbase outage the queue simply backs up: runs cycle attempts until they either succeed
  or go terminal. There is nothing to do on the worker itself; if the outage is long, pause new runs with the
  kill switch (docs/rollback-runbook.md, section 3) so users do not burn attempts into a dead provider.

## 8. Verify after deploy

1. `GET /health` returns `{ "ok": true, ... , "stopping": false }`.
2. Logs show `worker_start` (with `browserbaseConfigured:true`, presence only, never a key) and
   `health_listening`.
3. Queue a fixture run against the deployed owned fixture (`fixtures/preflight-demo` on Vercel, see
   docs/preflight-activation.md section 6). Either drive it through the UI as the owner, or use the internal
   seed driver from a trusted shell (never in the worker env):
   `PREFLIGHT_SEED_RUN=1 npm run preflight:seed-run -- --mode=broken --owner=<owner-email>`.
4. Watch the worker logs for the run lifecycle: `session_created`, one `flow_done` per flow (result
   `passed` / `failed` / `blocked`), then `run_finalized` with the decision. The broken fixture mode should
   finalize `blocked`.
5. Confirm the report: run header, flow runs, steps, issues, and artifacts per the SQL in
   docs/preflight-activation.md section 8, or open the run report in the UI. Screenshots should be present
   (no `artifact_save_failed` events; if you see them, the private bucket is missing, section 2b of the
   activation runbook).
6. Run the log redaction check (activation runbook section 11): grep the captured logs for the `bb_` key
   prefix and the service-role key prefix; expect zero matches.

## 9. DO NOT

- **Never** put a secret behind a `NEXT_PUBLIC_` name. On this service the only `NEXT_PUBLIC_` name is
  `NEXT_PUBLIC_SUPABASE_URL`, and only because the worker reuses the web app's variable; the URL is not a
  secret. Everything else (Browserbase key, service-role key) is server-only.
- **Never** commit env values. `.env.preflight.example` stays value-free; real values live in Railway's
  service env or local `.env.local` only.
- **Never** set `PREFLIGHT_SEED_RUN`, `PREFLIGHT_SEED_ALLOW_PROD`, or `PREFLIGHT_INTERNAL_BILLING_BYPASS` on
  the deployed worker. The billing bypass is ignored in production by design (and warns loudly), but its
  presence in a prod env is a red flag in any audit.
- **Never** point the worker at a different Supabase project than the web app.
- **Never** deploy without the local gate: lifecycle test, verify-db, and the Browserbase smoke must be green
  first.
- **Never** "roll back" by editing queue rows by hand. Use the lease/attempt machinery (it self-heals) or the
  kill switch.

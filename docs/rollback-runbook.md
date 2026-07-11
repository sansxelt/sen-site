# Rollback runbook

Operator guide for undoing a bad release, in escalating order: web rollback, worker rollback, kill switch,
flag rollback. Each section says what it touches and, just as important, what it deliberately leaves alone.
Nothing here deletes data or history.

---

## 1. Web rollback (Vercel)

The web app deploys to Vercel. Rolling back is promoting a previous deployment; it does not touch the
database, the worker, or the queue.

- Dashboard: project -> Deployments -> pick the last known-good production deployment -> promote it
  ("Instant Rollback" / promote to production).
- CLI: `vercel rollback` (interactive pick of the previous production deployment), or
  `vercel rollback <deployment-url>` for a specific one.

Notes:

- Environment variables are NOT part of a deployment rollback. If the incident was caused by a flag flip,
  fix the flag (section 4) and redeploy; promoting an old build with the same bad env reproduces the problem.
- Queued and running Production Passes are unaffected: the worker, not the web app, executes them. Rolling
  the web back mid-run is safe; the report appears when the worker finalizes.

## 2. Worker rollback (Railway)

The worker is a separate Railway service (see docs/worker-deploy-runbook.md).

- Roll back: redeploy the previous image/deployment from the Railway dashboard (Deployments -> previous ->
  redeploy). Config changes in `worker/preflight/railway.toml` ride with the commit being deployed.
- Stop entirely: stop/remove the service. New runs then sit `queued` until a worker exists again; nothing
  errors on the user side except time.

In-flight runs during either action:

- Railway sends SIGTERM; the worker stops claiming and drains the in-flight run for up to
  `PREFLIGHT_SHUTDOWN_GRACE_MS` (default 30s).
- Any run that did not finish in the grace window keeps state `running` until its lease (default 90s)
  expires; the next claim cycle requeues it through the normal failure path. Attempts remaining: requeued,
  credit hold kept for the retry. Attempts exhausted (`max_attempts`, default 3): terminal `failed`, and the
  hold is refunded automatically if no flow ever executed.
- Flow results already persisted are kept (persistence is incremental). Nothing needs manual repair.

## 3. Kill switch: pause new runs

`VRAELIS_RUNS_DISABLED=1` pauses NEW runs only. It is the fastest safe brake and the first thing to reach for
when runs are misbehaving but the site itself is fine.

What it does:

- The run and rerun routes refuse to queue: HTTP 503, error `runs_paused`, message "New Production Passes are
  temporarily paused. Existing reports remain available."
- Every existing report, run history, issue, and screenshot stays readable. No read route is touched.
- The worker keeps draining already-claimed work to a clean finish; nothing in flight is cut.
- No credits are taken for refused launches (the refusal happens before the credit hold).

Procedure:

1. Set `VRAELIS_RUNS_DISABLED=1` in the Vercel project's Production environment.
2. Redeploy the current production build so the env change takes effect (Vercel env changes apply to new
   deployments only).
3. Verify: launching a pass from the UI fails with the paused message; an existing report still loads.
4. Optionally stop the Railway worker if the problem is the worker or the browser provider (section 2).

Resume: remove the variable (or set it to `0`), redeploy, verify a run queues.

## 4. Flag rollback matrix

All server flags live in the Vercel project env; each change needs a redeploy to take effect. Names and
semantics are defined in `lib/v-preflight-flags.ts`.

| Goal | Flag change | Effect | Leaves alone |
| --- | --- | --- | --- |
| Pause new runs | `VRAELIS_RUNS_DISABLED=1` | Run + rerun routes 503 `runs_paused` | All history, reads, in-flight work |
| Retreat to internal-only | unset `VRAELIS_PREFLIGHT_ENABLED`, keep `VRAELIS_PREFLIGHT_INTERNAL_ONLY=1` | Preflight reachable by internal/owner only | Data, worker, legacy checker |
| Hide the nav entry | unset `NEXT_PUBLIC_VRAELIS_PREFLIGHT` | Applications nav item hidden (visibility only, not a security boundary) | Route access flags |
| Go fully dark | unset both `VRAELIS_PREFLIGHT_ENABLED` and `VRAELIS_PREFLIGHT_INTERNAL_ONLY` | Every Preflight route 404s; guessed URLs are no-ops | All Preflight data (kept), legacy checker |
| Re-enable the legacy checker | ensure `VRAELIS_LEGACY_CHECKER_ENABLED` is unset or `1` (it defaults ON; only `0` disables it) | /app/legacy/checks works again | Preflight entirely (independent product) |

The legacy checker rollback is internal-only in spirit: it restores the old AI-output checker as a fallback
surface while Preflight is dark. It is independent of every Preflight flag, so flipping Preflight flags never
breaks it and vice versa.

## 5. What NEVER to roll back

- **Applied migrations.** All Preflight migrations are additive and idempotent (`create table if not exists`,
  `add column if not exists`). Old code simply ignores new tables and columns, so an applied migration is
  safe to leave in place under any web or worker rollback. Do not drop tables or columns to "match" an older
  build; that destroys run history, issues, and evidence rows for no benefit.
- **The credit ledger.** Holds, charges, and refunds are settled automatically and idempotently (refunds are
  keyed per reservation). Hand-reversing ledger rows to undo a release risks double-refunds or stranded
  escrow. If billing looks wrong, investigate the run's settlement fields first
  (`credits_held`, `cost_reservation_id`, `state`, `failure_code`).
- **The private artifact bucket.** Do not delete or make public `vraelis-preflight-artifacts` as part of any
  rollback. Reports reference objects in it by path; reads are short-TTL signed URLs.
- **Finalized runs.** Runs are immutable records. A rerun is always a NEW linked run; there is no supported
  way, and no reason, to mutate or delete a finalized run during an incident.

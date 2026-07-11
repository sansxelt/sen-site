# Vraelis Preflight activation runbook

Operator guide for the two manual actions that turn Preflight on (apply the migrations, supply Browserbase
credentials) plus running the full queue to browser to report loop **locally** before any Railway deploy.
Everything else (the discovery engine, the worker lifecycle, redaction, the safe fetcher) is already built
and verified.

**Local-first:** prove the full queue -> browser -> report loop locally with the owned fixture before you
deploy the Railway worker.

All secrets in this runbook are **server-only**. Never place an API key, service-role key, or Browserbase
credential behind a `NEXT_PUBLIC_` name. `NEXT_PUBLIC_` values are shipped to the browser.

---

## 0. Prerequisites

- Node with the repo dependencies installed (`npm install`).
- Access to the existing Supabase project (the SQL editor and the service-role key).
- A Browserbase account for the real browser provider (a free session is enough to start).
- The commands below use POSIX inline-env form (`VAR=value npm run ...`). On Windows PowerShell set the
  variable first instead: `$env:VAR="value"; npm run ...`.

---

## 1. Apply the migrations (manual action 1)

The tables are additive and idempotent (`create table if not exists`, `add column if not exists`). Run them
in the Supabase SQL editor, **in this order**:

1. Open the Supabase dashboard for the project, go to **SQL Editor**, **New query**.
2. Paste the full contents of `sql/vraelis-preflight.sql` and run it.
3. Paste the full contents of `sql/vraelis-preflight-2-discovery.sql` and run it.

Migration 2 depends on migration 1 (it alters `v_contract_requirements`, `v_test_flows`, and
`v_preflight_runs`, and creates `v_discovery_snapshots`). Running out of order fails loudly and changes
nothing. Re-running either file is safe.

---

## 2. Verify the database is ready

The verify script is **read-only**. It projects one migration-2 column per table so a half-applied schema is
caught, and it probes the `v_preflight_claim()` RPC without side effects.

It needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (loaded from `.env.local` / `.env`).

```
npm run preflight:verify-db
```

Machine-readable variant for CI:

```
npm run preflight:verify-db -- --json
```

The JSON prints `{ "ready": <bool>, "checks": <n>, "passed": <n>, "failed": [ ... ] }`.

- `"ready": true` means every Preflight table, the migration-2 columns, and the claim RPC are present. The
  script exits `0`. You may proceed.
- `"ready": false` lists the missing tables/columns in `failed` and exits non-zero. Re-apply the migrations
  from step 1, then re-run.

---

## 3. Configure environment (manual action 2, part A)

Copy `.env.preflight.example` and fill in real values. Keep local values in `.env.local` for the web app and
the verify script. The worker process reads `process.env` directly, so also export the same values into the
shell you launch the worker from (or source them). See step 5.

| Variable | Required | Purpose |
| --- | --- | --- |
| `BROWSER_PROVIDER` | yes | `browserbase` for real runs, `fake` for the deterministic lifecycle test. |
| `BROWSERBASE_API_KEY` | when `BROWSER_PROVIDER=browserbase` | Browserbase API key. Server-only. Worker fails fast if missing. |
| `BROWSERBASE_PROJECT_ID` | when `BROWSER_PROVIDER=browserbase` | Browserbase project id. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. Reused by the worker as the data plane. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key (BYPASSRLS). **Server-only.** Never `NEXT_PUBLIC`. |
| `VRAELIS_PREFLIGHT_INTERNAL_ONLY` | yes (Phase 1) | `1` gates route access to internal/owner only. |
| `NEXT_PUBLIC_VRAELIS_PREFLIGHT` | optional | `1` shows the Applications nav item to internal testers (visibility only, not a security boundary). |
| `VRAELIS_LLM_API_KEY` or `ANTHROPIC_API_KEY` | for discovery synthesis | LLM key the discovery synthesis reads. Server-only. Synthesis degrades to no suggestions when absent. |
| `PREFLIGHT_WORKER_ID` | optional | Stable worker id. A random one is generated when absent. |
| `PREFLIGHT_WORKER_POLL_MS` | optional | Claim poll interval (default 2000). |
| `PREFLIGHT_WORKER_LEASE_SECONDS` | optional | Run lease length (default 90). |
| `PREFLIGHT_WORKER_HEARTBEAT_SECONDS` | optional | Heartbeat interval (default 20). |
| `PREFLIGHT_SHUTDOWN_GRACE_MS` | optional | Graceful drain window on SIGTERM/SIGINT (default 30000). |
| `PREFLIGHT_MAX_RUN_SECONDS` | optional | Per-run cap (default 900). |
| `PREFLIGHT_MAX_FLOW_SECONDS` | optional | Per-flow cap (default 180). |
| `PREFLIGHT_MAX_STEPS_PER_FLOW` | optional | Per-flow step cap (default 30). |
| `PREFLIGHT_MAX_CONCURRENT_RUNS` | optional | In-flight run cap (default 1). |

Reminder: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_VRAELIS_PREFLIGHT` are the **only** two Preflight names
that may carry the `NEXT_PUBLIC_` prefix. The URL is not a secret and the flag is a client-readable nav toggle.
Every other value above is a secret and must stay server-side.

---

## 4. Create a Browserbase project and API key (manual action 2, part B)

No key values belong in the repo or in any `NEXT_PUBLIC_` name.

1. Sign in to the Browserbase dashboard.
2. Create (or select) a project. Copy its **Project ID** into `BROWSERBASE_PROJECT_ID`.
3. Open the API keys area for that project, generate a new key, and copy it once into `BROWSERBASE_API_KEY`.
   Store it in your secret manager / `.env.local`; the dashboard will not show it again.
4. Confirm both values are set as server-only env, not committed, not `NEXT_PUBLIC_`.

---

## 5. Run the worker locally

### 5a. Deterministic lifecycle test first (no DB, no browser, no credentials)

This exercises the entire worker lifecycle against the in-memory fake store and fake browser: claim, lease,
session, flows, incremental persistence, decision, charge-on-completion, close, plus the failure and recovery
cases (provider fail, cancel, lease loss, close throws, requeue, recovery, max attempts).

```
npm run preflight:worker:test
```

Expect an all-pass count and exit `0`. Run this before wiring any real credentials.

### 5b. Real worker against Browserbase (local)

The real provider uses two worker-only runtime deps that are not in the web app's `node_modules`. Install them
before the first real run:

```
npm install @browserbasehq/sdk playwright-core
```

Then export the env from step 3 into your shell (the worker reads `process.env` directly and does not auto-load
`.env` files) and start it:

```
BROWSER_PROVIDER=browserbase npm run preflight:worker
```

The worker fails fast with a clear message if `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` are missing. On
start it logs a presence-only summary (`browserbaseConfigured:true`, never the key value) and serves a health
endpoint on `PORT` (default 8080) at `/health`. Stop it with Ctrl-C (SIGINT); it stops claiming, lets the
bounded in-flight run finish, closes sessions, then exits.

---

## 6. Deploy the owned fixture and set the smoke target

The smoke run drives an app **you own**, never a third-party site. The fixture lives at
`fixtures/preflight-demo` and deploys as a Vercel static app.

1. Deploy `fixtures/preflight-demo` to Vercel (static). A preview deployment is sufficient.
2. Copy the resulting deployment URL.
3. Set it as the smoke target (server-only, not `NEXT_PUBLIC_`):

```
PREFLIGHT_SMOKE_URL=https://<your-fixture-deployment>.vercel.app
```

---

## 7. Run the owned-fixture smoke

With the fixture deployed, `PREFLIGHT_SMOKE_URL` set, and the Browserbase env from steps 3 and 4 in the shell:

```
VRAELIS_SMOKE=1 npm run preflight:smoke:browserbase
```

This opens a real Browserbase session against your owned fixture and exercises the provider pipeline only:
session create, navigate, one heading assertion, screenshot, one controlled failing assertion (which the
smoke expects), a clean session close, and secret-redaction checks. It does NOT run full FlowSpecs, drain
console/network evidence, or compute a launch decision (those are the worker's job, proven separately by
`npm run preflight:worker:test`). Use it to confirm the real Browserbase provider before deploying the
Railway worker.

---

## 8. Inspect a failed run

Preflight persists deterministic run state to Postgres. Query by the run id (a `v_preflight_runs.id` uuid) in
the Supabase SQL editor or psql.

Run header (state, decision, failure code, attempts):

```
select id, state, decision, failure_code, failure_message, attempts, error_category
from v_preflight_runs
where id = '<run-uuid>';
```

Per-flow results:

```
select id, name, state, severity
from v_flow_runs
where preflight_run_id = '<run-uuid>'
order by created_at;
```

Per-step observations (deterministic; where a flow actually failed):

```
select idx, action, target, expected, observed, status, ms
from v_run_steps
where flow_run_id in (select id from v_flow_runs where preflight_run_id = '<run-uuid>')
order by flow_run_id, idx;
```

Issues and evidence:

```
select severity, category, title, expected, observed
from v_issues
where run_id = '<run-uuid>';
```

Artifacts (private bucket; the DB stores only the path, objects are reached by signed URL, never public):

```
select kind, storage_path, meta
from v_run_artifacts
where preflight_run_id = '<run-uuid>';
```

The run report UI presents the same run once the Applications surface is enabled
(`NEXT_PUBLIC_VRAELIS_PREFLIGHT=1` for visibility, `VRAELIS_PREFLIGHT_INTERNAL_ONLY=1` for access). The SQL
above is the source of truth for a headless investigation.

---

## 9. Disable Preflight safely

Preflight ships dark and the legacy AI-output checker is independent of it.

1. Unset the server access flags: remove `VRAELIS_PREFLIGHT_ENABLED` and `VRAELIS_PREFLIGHT_INTERNAL_ONLY`.
   With neither set, `preflightEnabled()` is false and every Preflight route returns 404, so a guessed URL is a
   no-op.
2. Unset the visibility flag `NEXT_PUBLIC_VRAELIS_PREFLIGHT` to hide the Applications nav item.
3. Stop the worker (Ctrl-C / SIGTERM). It drains gracefully.

The legacy checker is controlled by `VRAELIS_LEGACY_CHECKER_ENABLED` (default on) and is **unaffected** by any
of the above. Do not set it to `0` when disabling Preflight.

---

## 10. Remove test artifacts

1. Owned fixture: remove or expire the Vercel deployment of `fixtures/preflight-demo` and unset
   `PREFLIGHT_SMOKE_URL`.
2. Test application rows: delete the test `v_applications` rows, scoped to the test owner email. Deleting an
   application cascades to its contracts, runs, flow runs, run steps, issues, and artifact rows
   (`on delete cascade`). Scope every delete to avoid touching real data:

```
delete from v_applications
where user_id = '<test-owner-email-lowercased>'
  and name like 'smoke%';
```

3. Storage note: the cascade removes the `v_run_artifacts` **rows**, but the underlying objects live in the
   private storage bucket referenced by `storage_path`. Delete those objects separately from Supabase Storage
   so no screenshots, traces, or recordings are left behind.

---

## 11. Confirm no production secrets entered the logs

The worker redacts by design (`worker/preflight/redaction.ts`): it strips secret-ish keys (authorization,
cookie, token, secret, api-key, bearer, session, signature), replaces emails, and cuts signed-URL query
params. Browserbase metadata (`safeMetadata`) is string values only, no arrays, and serializes under 512 chars,
carrying only compact ids (run/flow/worker/env), never user identity or secrets. Startup logs presence only
(`browserbaseConfigured:true`), never the key value.

To confirm on a captured worker log:

1. Grep the log for your Browserbase key prefix (Browserbase keys begin with `bb_`). Expect zero matches.
2. Grep for the leading characters of the service-role key value. Expect zero matches.
3. Confirm metadata lines are compact id maps (no arrays, no emails, well under 512 chars).

If any of these return a hit, stop and treat the log as compromised: rotate the exposed credential before
continuing.

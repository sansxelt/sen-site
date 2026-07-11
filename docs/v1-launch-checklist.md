# V1 launch checklist

The definition-of-done for the V1 Production Release Program, mapped to current status, plus the flag matrix,
the canary plan, and the kill-switch procedure. Companion docs: docs/v1-release-progress.md (running
checkpoint), docs/preflight-activation.md (local activation), docs/worker-deploy-runbook.md (Railway),
docs/rollback-runbook.md (undo paths).

Status legend:

- **done**: built and verified in this repo.
- **pending operator**: requires a human action (SQL apply, env flip, signup, dashboard click). Cannot be done
  autonomously.
- **pending paid infra**: requires spending money (Railway service, paid Browserbase sessions).

---

## 1. Definition of done, with current status

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Signed-in restructure: new nav, real-data dashboard, legacy checker demoted to /app/legacy/checks behind a flag | done | |
| 2 | Owner-wide pages on real tables: passes, issues, repairs, deployments, app-scoped tabs | done | |
| 3 | Linked reruns: parent_run_id migration, reconcile engine, worker reconciliation, fixture-rerun driver | done | Migration 3 SQL apply itself is item 12. |
| 4 | Report + app overview redesign: verdict hero, blocker stories, live Run Production Pass button | done | |
| 5 | Approved contracts immutable, revisions via new draft, server guard | done | |
| 6 | Kill switch (VRAELIS_RUNS_DISABLED) + per-owner run caps (concurrency 2, daily 20) + provider error mapping | done | Code plus verify scripts on the release branch; ships with the release merge. |
| 7 | Copy audit: no old-checker copy on primary surfaces, no invented metrics, honest empty states | done | |
| 8 | Real production proof: a genuine run BLOCKED with real issues and real Browserbase screenshots | done | Run b833713d: 2 real issues, 3 screenshots. |
| 9 | Docs and runbooks: activation, worker deploy, rollback, user guide, this checklist | done | You are reading them. |
| 10 | Hosted always-on worker on Railway | pending paid infra + operator | Runbook ready (docs/worker-deploy-runbook.md); deploy explicitly gated by the founder. |
| 11 | Real-browser test matrix beyond the existing safe allowance | pending paid infra | Paid Browserbase sessions. |
| 12 | Apply migration 3 (sql/vraelis-preflight-3-linked-reruns.sql) in Supabase | pending operator | Additive and idempotent, same procedure as migrations 1 and 2. |
| 13 | Vercel prod env flips to the safe launch values (section 2) | pending operator | Names audited via vercel env ls. |
| 14 | Fresh-account E2E through the UI (real signup, connect, approve, run, report) | pending operator + paid infra | Needs a human signup and the hosted worker. |
| 15 | Canary stages through full availability (section 3) | pending operator | Each stage is an explicit operator decision. |

Nothing outside this table is promised for V1. Repo analysis, DB inspection, Stripe auditing, auto PRs,
deployment control, and continuous monitoring are future modules and appear nowhere in the product as
controls.

## 2. Flag matrix: safe launch values

All flags live in the Vercel project env (worker env is separate, see the deploy runbook). Every change needs
a redeploy to take effect.

| Flag | Prod today | Safe launch value | Who flips / when |
| --- | --- | --- | --- |
| VRAELIS_PREFLIGHT_ENABLED | set | 1 | Product on. |
| VRAELIS_PREFLIGHT_INTERNAL_ONLY | set | 1 until canary passes, then 0 | Operator, at the limited-public stage. |
| NEXT_PUBLIC_VRAELIS_PREFLIGHT | set | 1 | Nav visibility only, not a security boundary. |
| VRAELIS_LEGACY_CHECKER_ENABLED | absent (defaults ON) | 0 before public launch | Operator. Set explicitly to 0; absence means on. |
| VRAELIS_RUNS_DISABLED | absent | absent | Kill switch; set to 1 only during an incident (section 4). |
| PREFLIGHT_MAX_RUNS_PER_DAY | absent (defaults 20) | absent | Raise deliberately, never preemptively. |
| PREFLIGHT_INTERNAL_BILLING_BYPASS | absent | absent | Ignored in prod by code anyway; keep absent. |
| PREFLIGHT_SEED_RUN | absent | absent | Seed drivers refuse without it; never set in prod. |
| PREFLIGHT_SEED_ALLOW_PROD | absent | absent | Prod override for seed drivers; never set. |
| BROWSERBASE_API_KEY / BROWSER_PROVIDER | set | set | Server-only, never NEXT_PUBLIC. |

## 3. Canary stages

Each stage has entry criteria (all must hold before entering) and the metrics to watch while in it. Advancing
a stage is an operator decision; retreating is always allowed and costs nothing (flag matrix in
docs/rollback-runbook.md).

Where do the metrics come from today: run and issue tables (the SQL in docs/preflight-activation.md section
8), worker logs (flow_done, run_finalized, run_failed, artifact_save_failed), the credit ledger, and the
Railway/Vercel dashboards. There is no metrics pipeline yet; counting is manual SQL, and that is fine at
these volumes.

### Stage 0: owner-only

- Entry: migrations 1-3 applied and verify-db green; artifact bucket exists; worker deployed and /health ok;
  flags at internal-only; a fixture run queued through the real UI finalizes with the expected decision
  (broken fixture -> BLOCKED with screenshots).
- Track: runs finalized vs terminal failed (target: zero infrastructure failures); requeues (failure_code
  lease_expired); artifact_save_failed events (target zero); credit settlement on every run (hold -> charge,
  or refund when nothing ran); a redaction grep over captured worker logs (zero secret hits).

### Stage 1: invited (internal testers)

- Entry: stage 0 clean for at least 10 consecutive runs with zero infrastructure failures and correct
  settlement on all of them.
- Track: everything from stage 0, plus queue-to-report time per run; rerun behavior (issue continuity
  resolves/continues correctly on linked runs); questions per tester that indicate unclear UI or report copy.

### Stage 2: five external users

- Entry: stage 1 clean; the fresh-account E2E (item 14) has passed at least once; the user guide
  (docs/user-guide-production-pass.md) is published.
- Track: connect -> approved contract conversion; first-pass completion rate; refund rate (a high rate means
  provider trouble); how many users run a rerun after a repair (the core loop working); support requests per
  user.

### Stage 3: limited public

- Entry: all five external users completed at least one pass and one rerun; zero unresolved billing
  discrepancies; daily and concurrency caps observed working; operator flips
  VRAELIS_PREFLIGHT_INTERNAL_ONLY to 0 (VRAELIS_PREFLIGHT_ENABLED stays 1).
- Track: queue depth and wait time; worker saturation (health endpoint active vs configured concurrency);
  Browserbase session count and cost per run; daily-cap and concurrency-cap hits (429s); failure_code
  distribution; kill-switch readiness (procedure rehearsed once).

### Stage 4: full availability

- Entry: limited public stable for two weeks with no incident requiring the kill switch; support load
  sustainable; legacy checker retired (VRAELIS_LEGACY_CHECKER_ENABLED=0).
- Track: the stage 3 operational set as an ongoing routine, plus credits purchased vs consumed and runs per
  returning user.

## 4. Kill-switch procedure

Full detail in docs/rollback-runbook.md section 3. Short form:

1. Set `VRAELIS_RUNS_DISABLED=1` in the Vercel Production env and redeploy the current build.
2. Verify: launching a pass returns the paused message (503 runs_paused); an existing report still loads.
3. New runs are refused before any credit hold; run history, reports, and screenshots stay fully readable;
   the worker drains already-claimed work to a clean finish.
4. If the incident is the worker or the browser provider, additionally stop the Railway service; queued runs
   wait, in-flight runs requeue via lease expiry.
5. Resume: remove the variable, redeploy, verify a run queues and finalizes.

Rehearse this once during stage 0, while the only user it can affect is the owner.

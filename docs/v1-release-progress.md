# Vraelis V1 Production Release: progress checkpoint

Working doc for the V1 Production Release Program. Updated after every meaningful workstream.
Branch: release/v1-production-pass (merged to main only after gates pass; safe UI work may merge earlier).

## V1 promise (only what already works)

Connect an AI-built app, define and approve a Production Contract, run approved flows in a real browser,
catch launch blockers with deterministic evidence (screenshots, repro steps, technical details), rerun failed
flows after a repair, track issue continuity across linked runs, get an explainable BLOCKED / NEEDS REVIEW /
READY decision. Everything else (repo analysis, DB inspection, Stripe auditing, auto PRs, deployment control,
continuous monitoring) is labeled future and has no fake controls.

## Release flag matrix (audited via vercel env ls, names only)

| Flag | Prod today | Safe launch value | Notes |
| --- | --- | --- | --- |
| VRAELIS_PREFLIGHT_ENABLED | set | 1 | product on |
| VRAELIS_PREFLIGHT_INTERNAL_ONLY | set | 1 until canary passes, then 0 | operator flips |
| NEXT_PUBLIC_VRAELIS_PREFLIGHT | set | 1 | nav visibility |
| VRAELIS_LEGACY_CHECKER_ENABLED | absent (defaults ON) | 0 before public launch | operator flips |
| PREFLIGHT_INTERNAL_BILLING_BYPASS | absent | absent | code ignores it in prod anyway |
| PREFLIGHT_SEED_RUN | absent | absent | drivers refuse without it |
| PREFLIGHT_SEED_ALLOW_PROD | absent | absent | prod override, never set |
| BROWSERBASE_API_KEY / BROWSER_PROVIDER | set | set | server-only |

## Completed (verified)

- Signed-in restructuring: nav (Overview / Applications / Production Passes / Issues / Repairs / Deployments /
  Activity + Settings incl. Plans + Credits), dashboard on real data, legacy checker moved to
  /app/legacy/checks behind VRAELIS_LEGACY_CHECKER_ENABLED with middleware redirects.
- Owner-wide pages on real tables: /app/passes, /app/issues, /app/repairs, /app/deployments; app-scoped tabs.
- Linked reruns: migration 3 (parent_run_id), planReconcile engine (14/14), worker reconciliation
  (resolve / continue / regression / unverified), fixture-rerun driver (25/25).
- Font: no monospace anywhere in UI (tokens.css); .codeblock is the only true-mono surface. Desktop scale 0.8.
- Old-copy audit: 15 flagged surfaces cleaned; site metadata repositioned.
- Real production proof: run b833713d BLOCKED with 2 real issues + 3 Browserbase screenshots.

## Completed this session (verified, all suites green)

- Evidence redesign shipped to prod: report verdict hero with large evidence and collapsed technical
  details, health-first application overview with a live Run Production Pass button, immutable approved
  contracts (server 409 guard, idempotent re-approve, create-draft revision endpoint, runs verify against
  the latest APPROVED version).
- Worker reliability: expired-lease reaper (stranded running runs requeue or fail terminally through the
  same failRun semantics, refunds included), provider error classification (auth / quota / capacity /
  outage / timeout mapped to owner-safe codes, raw messages stay server-side).
- Kill switch VRAELIS_RUNS_DISABLED (pauses new runs, history stays), per-owner daily run cap
  (PREFLIGHT_MAX_RUNS_PER_DAY, default 20, checked before any credit hold), credit estimate on the launch
  button, safe failure sentences on the report.
- Interactive landing: PassDemo (broken to fixed animated Production Pass) + TwoUserDemo, reduced-motion
  aware, ad-ready.
- Security suite: 118/118 static assertions (ownership on every data-layer function, route auth plus
  owner-loader ordering, artifact TTL, SSRF gates, internal-tool lockdown, secret hygiene).
- UX states: loading skeletons, error boundaries, not-found for the app shell.
- Docs: worker deploy runbook, rollback runbook, user guide, launch checklist.

## Test matrix (this checkpoint)

tsc 0, eslint 0, build 0. Suites: reconcile 14/14, fixture-rerun 25/25, seed-run 25/25, worker lifecycle
26/26, artifacts 14/14, transport 18/18, limits 43/43, security 118/118.

## Blockers (operator or paid infra; cannot be done autonomously)

- Hosted always-on worker (Railway deploy is explicitly gated by the founder).
- Real-browser test matrix beyond the existing safe allowance (paid Browserbase sessions).
- Fresh-account E2E through the UI (needs a human signup + the hosted worker).
- Canary stages (owner-only onward) and any public availability change.
- Env flag flips in Vercel prod (documented above; operator action).
- Migration 3 SQL must be applied by the operator (sql/vraelis-preflight-3-linked-reruns.sql).

## Next tasks

1. Verify + commit + deploy the evidence redesign.
2. Release branch; fan out workstreams: front-page interactivity (ad-ready), kill switch + run caps +
   provider error mapping, ownership/SSRF test suite, loading/error states, docs + runbooks.
3. Full verify matrix, merge safe work, final release report.

## 2026-07-11: targeted rerun scope + dedup correctness
- Fixed: the worker executed every approved contract flow regardless of the rerun's selection. The selection is now stored on the run snapshot (v_preflight_runs.flow_ids, migration 4) and is authoritative at claim time; a missing/invalid selection fails as flow_selection_invalid BEFORE any browser session (terminal, refunded, no issue reconciliation).
- Fixed: invalidated/cancelled/infrastructure-failed runs no longer block rerun deduplication; in-flight and completed-valid runs still do (replacement submission ids: base-r2, -r3, ...).
- Billing estimate, reservation, stored selection, execution, report counts, and settlement all read one selected-flow set (lib/preflight/flow-selection.ts).
- New suite: npm run preflight:scope:test (39/39). All other suites green.
- Marketing shell now renders at 0.72 on desktop (90% of the prior 0.8) so the front page hero + demo fit one viewport.
- OPERATOR: apply sql/vraelis-preflight-4-selected-flows.sql before queueing new runs (enqueue is fail-closed without it).

## 2026-07-11: launch decision requires full critical coverage
- A passing targeted (partial-coverage) rerun now finalizes as decision 'repair_verified': the repair is proven, readiness is not. READY requires every enabled+approved critical flow executed against one run's own target + contract snapshot; coverage is never aggregated across runs.
- pickHealthRun: launch health = newest valid FULL-coverage completed decision; targeted runs may resolve issues but never replace health. App overview shows the previous launch health plus a separate "Latest repair: <blocker> verified as resolved" line.
- Repair-verified report: REPAIR VERIFIED hero, honest "full verification still required" copy, CTA "Run full critical verification" (new rerun scope=critical).
- Historical repair tool: npm run preflight:repair-decision (dry-run default) rewrites ONLY the decision on partial-coverage READY runs; full-coverage READY runs are protected.
- New suite: npm run preflight:decision:test (29/29, spec tests A-L). All suites green (security now 119/119).

## 2026-07-12: Railway worker deployed and verified
- Railway service (project appealing-love, Hobby) builds via root railway.toml -> worker/preflight/Dockerfile; /health green.
- INCIDENT during rollout: the service initially had no BROWSER_PROVIDER, the worker defaulted to the fake provider and finalized a counterfeit READY (run d9a1252f). Contained: run invalidated (failed/infra_misconfigured), zero issues touched, health verified back on the real pass. Root cause fixed in worker/preflight/config.ts: a production runtime refuses to boot on any non-real provider (no override). Tests added (decision suite 33/33).
- Verification run e5709fc2 through the deployed worker: provider browserbase, real session, 3/3 critical passed, 3 screenshots, READY full coverage, 9s. Dedup fix proven live: the invalidated occupant of the submission key was superseded (-r2), not blocking.
- Remaining gate: fresh-account UI-only canary.

## 2026-07-12: pricing correction (copy phase)
- Old feedback-network economics ($1 = 10 credits, a credit per approved flow, 1 credit = 1 AI check, human-judgment credits) removed from every user-facing surface: pricing page + metadata, free-report, refunds, terms, dashboard, account, api-keys, plans, credits, checkout, nurture emails, Stripe line-item copy, user guide.
- New early-access model published: Free (one complete pass, 3 critical flows, no card) and $10/Production Pass (5 flows included, $2/additional). Pro/Scale render only as a disabled preview; no subscription checkout wired.
- Billing LOGIC unchanged by design: ledger still holds 1 credit/flow. Migration plan (cents ledger, price-paid balance conversion, Stripe changes, flag-gated estimator swap) in docs/pricing-migration-plan.md; execute it as a unit, never piecemeal.
- Guard: npm run pricing:copy:test (21/21) fails the build of any resurfaced stale economics.

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

## 2026-07-12: Connect an app -> production-context onboarding workspace
- New /app/apps/new: 6 grouped sections (application, source+deployment, product definition, data+auth, billing+services, test boundaries) with a sticky connection summary, setup progress, and a local draft (credentials excluded).
- Three honest connection states: available fields; MANUAL connection cards (GitHub repo/branch/commit, Vercel, custom deploy, Supabase, custom auth, Stripe test-mode marker, Sentry DSN, webhooks); Coming later chips (OAuth, Railway, Netlify, Firebase, Clerk, Auth0, Better Auth, Lemon Squeezy, Paddle, Resend, Twilio, PostHog, OpenAPI import). No fake OAuth anywhere.
- Secrets: lib/preflight/secret-vault.ts (AES-256-GCM, VRAELIS_SECRET_KEY, fail-closed, fresh IV, GCM tamper-proof), sealed test accounts in v_app_connections.encrypted_ref via the dedicated /secrets route (masked-only responses, honest 404 on zero-row revoke). Adversarial review (9 agents) confirmed 3 findings, all fixed: value-channel credential redaction, attempt-all + on-page retry for secret storage (no plaintext loss), row-counted deletes.
- Boundaries conservative by default (all permits off; fixed never-rules displayed). Context sources bounded + typed. Suite: preflight:connect:test 46/46; security suite auto-grew to 122/122.
- OPERATOR: apply sql/vraelis-preflight-5-connections.sql and set VRAELIS_SECRET_KEY (64 hex chars) in Vercel before storing test accounts; storing fails closed with a clear 503 until then.

## 2026-07-12: app.vraelis.com migration
- Product moved to app.vraelis.com with clean renamed routes (/applications, /applications/[id]/passes/[runId], /activity, /api); marketing + auth stay on vraelis.com. Session cookie scoped to .vraelis.com in production only (one-time session reset). Legacy /app/* 308s across with full segment mapping incl. /app/checks -> /legacy/checks. /api/* namespace never redirected (exact /api is the product page). Localhost dev works without subdomains (rewrites). Suite: routes:test 38/38. Spec + operator checklist: docs/subdomain-migration-plan.md.

## 2026-07-12: approved pass pricing built FLAG-GATED (VRAELIS_PASS_PRICING, default OFF)
- Pure money core (lib/preflight/pass-pricing.ts, 33/33): $15 pass / 5 flows incl / $3 extra; rerun $3 x flows capped at pass price; builder_v1 $49/$490, pro_v1 $149/$1,490, scale_v1 $399/$3,990 (annual = 10 months); anchor-based monthly windows meter annual subs monthly with no cron.
- Enforcement (82/82): flow-unit allowance metering (reruns deduct selected flows only), app caps, flow caps, lifetime free pass, cents PAYG holds via existing ledger (unit column), _v1 webhook wiring, signup-grant cut at flip only, balance-conversion tool (dry-run). Legacy behavior byte-identical flag-off.
- NOT done until founder flips: Stripe prices (operator creates 6), migration 6 SQL, conversion --apply, public pricing UI + checkout (step 11). Rollback = unset flag BEFORE any cent rows exist.

## 2026-07-12: PRICING CUTOVER EXECUTED
- Six _v1 Stripe prices verified live (7/7); portal configured by founder; sandbox checkout tested by founder.
- Sequence run exactly as approved: runs paused -> queue confirmed empty (0 active) -> balance converted (25 promo credits -> 250 cents, sources untouched) -> VRAELIS_PASS_PRICING=1 on Vercel + Railway -> both redeployed -> live verification (v1 ladder up, zero legacy numbers, zero forbidden claims, $15 PAYG) -> kill switch removed, runs resumed.
- Production is now on per-pass pricing: Builder/Pro/Scale live with monthly/yearly, PAYG $15/$3, one-lifetime free pass, entitlement metering active. NEXT: fresh-account UI-only canary on the new system, then Browserbase Developer upgrade immediately before beta invites/ads.

## 2026-07-12/13: V1.1 AFK window report (founder away ~8h; autonomous execution)
DEPLOYED to Vercel: S1 billing returns + link audit (39a09fc, earlier) and S2 connection management
(a1bdaaf): /applications/[id]/settings/connections with six-state lifecycle, SSRF-guarded read-only
health checks, atomic stale-edit guard, audit rail, idempotent creation; a four-angle code review found
9 issues, all fixed and locked into the suite (connections:manage:test 104/104).
COMMITTED + PUSHED, NOT DEPLOYED TO VERCEL (migration gates, per the addendum):
- S3 context snapshots (31be578): immutable versioned context graph, Context tab, contract + run pinning;
  fail-clear everywhere migration 7 is missing. context:test 61/61.
- S4 deployment identity (e4209b6): v_deployments recording + dedupe, report-hero tested-deployment block,
  New-deployment-unverified banner (never alters the health decision), comparison UI, manual recording;
  fail-clear on migration 8. deployments:test 77/77.
LIVE ON RAILWAY via push (backward compatible by design, proven by the untouched suites):
- S5 worker boundary enforcement (21f3a65): pre-step policy gate, blocked_by_policy flow state (never a
  defect, never billable when nothing ran, critical policy-block -> needs_review). boundaries:test 77/77.
SUITE COUNT at window end: 18 suites, all green (security 135/135).
BLOCKED (operator): migration 7 then 8 per docs/v1.1-operator-return-checklist.md (then I deploy S3/S4);
S6 authenticated flows needs VRAELIS_SECRET_KEY on Railway; S12 needs the GitHub App registered.
ALSO COMMITTED (no migration needed; deploys with S3/S4 at the migration flip): S7 contract provenance (provenance:test 69/69): context-aware synthesis + closed provenance set + chips; keyless path emits review-gated connection-signal suggestions.
STOP-GATES HONORED: no migrations applied, no Stripe/provider changes, no destructive anything.

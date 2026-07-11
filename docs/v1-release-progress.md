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

## In flight

- Evidence redesign (report verdict hero, health-first app overview + live Run Production Pass button,
  immutable approved contracts + server guard + create-draft flow): agents done, verifying now.

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

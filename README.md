# Vraelis

**Production validation for AI-built systems: know how your system behaves before it ships.**

AI can build it. That is not proof it works in production. Vraelis takes the behavior a system is required to hold, runs it against the exact build in a real environment, and returns one truthful decision backed by evidence. Not a green checkmark. Proof of how it actually behaved.

Live at **[vraelis.com](https://vraelis.com)**. Follow: [X](https://x.com/vraelis) · [LinkedIn](https://linkedin.com/company/vraelis) · [Instagram](https://instagram.com/usevraelis) · [YouTube](https://www.youtube.com/@usevraelis) · [Facebook](https://facebook.com/vraelis)

> Web and API verification are live. Mobile, desktop, SDK, and connected-device runtimes are expanding from the same verification architecture. Physical / connected systems are the direction the architecture is built for, not a capability offered today.

---

## What Vraelis is

A system for proving production behavior. It connects requirements, builds, execution, evidence, issues, and production history into one truthful decision.

The unit of work is a **Production Pass**: a full verification run against a real deployment. Verification is the product; the pass is the mechanism (and the priced unit). Each pass drives a real browser through the behaviors an app is required to hold and returns one of four outcomes:

| Outcome | Meaning |
|---|---|
| **READY** | The complete approved production contract passed. This is the normal result when the system does what it must. |
| **BLOCKED** | A critical required behavior genuinely failed. |
| **NEEDS REVIEW** | The result could not be determined reliably. |
| **REPAIR VERIFIED** | A known issue passed against a later build, without claiming full coverage. |

Vraelis verifies defined behavior and production requirements with evidence. It does not certify safety or guarantee a system is harmless.

**What it is not:** a website scanner, a generic AI audit, a prompt wrapper, a screenshot generator, a test-script recorder, or an autonomous coding agent.

---

## The core loop

A repeatable process, not a one-time check. The same discipline runs on every build, so a passing result means the same thing three releases from now as it does today.

1. **Define what must work.** A Production Contract of required behaviors (requirements) and the journeys that prove them (flows).
2. **Bind the exact build and environment.** The run pins the deployment, target, environment, role, and contract version it verified against.
3. **Execute approved verification flows.** A real browser drives each flow's bounded steps.
4. **Capture observed evidence.** Deterministic observations, console/network errors, and a final-state screenshot per flow.
5. **Receive a production decision.** READY, BLOCKED, NEEDS REVIEW, or REPAIR VERIFIED, explained, never an aggregate score.
6. **Preserve history across releases.** Issues open, continue, and resolve as status transitions, so history is never lost.

Proof is tied to the exact thing you shipped: build, runtime target, environment, user role, contract version, configuration, execution steps, and expected-vs-observed. A green screen is not proof.

---

## Architecture

Two host-split surfaces on one Next.js app, plus a separate long-running worker that drives the real browser.

```
  vraelis.com  ── marketing (Vraelis Rank)      app.vraelis.com ── the signed-in product
  clean paths ─rewrite→ /rank/*                 clean paths ─rewrite→ /rank/app/*
  (/pricing, /how-it-works, /enterprise, …)     (/applications, /passes, /issues, …)
  /signin, /signup, /auth/* live here           marketing here is bounced to vraelis.com
                                │
                                ▼   POST /api/preflight/apps/[id]/runs   (gated, reserves a job)
                    ┌───────────────────────────────┐
                    │  v_preflight_runs (job queue)  │  state: queued
                    │  Supabase Postgres              │  unique(user_id, submission_id)
                    └───────────────┬─────────────────┘
                                    ▼   v_preflight_claim()  (advisory lock, FOR UPDATE SKIP LOCKED)
                    ┌───────────────────────────────┐
                    │  Preflight worker (Railway)    │  claim → execute → repeat, leased + heartbeat
                    │  worker/preflight/*             │  framework-free Node process, /health endpoint
                    └───────────────┬─────────────────┘
                                    ▼   ONE isolated session per run
                    ┌───────────────────────────────┐
                    │  Browserbase (hosted Chromium) │  driven by playwright-core over CDP
                    │  bounded steps, no arbitrary JS │  deterministic observations, no AI verdict
                    └───────────────┬─────────────────┘
                                    ▼
        Evidence (private bucket, signed URLs) · explainable decision · issues reconciled · report
```

### The Preflight pipeline

**Discovery (AI suggests your contract).** `POST /api/preflight/apps/[id]/discover` kicks off a bounded, SSRF-safe crawl (max 12 pages, depth 2) that, with an LLM key, synthesizes evidence-backed requirements and flows via strict structured output (`discover-run.ts` then `discover-synthesis.ts`). It is fail-soft: with no key or on any model error it finalizes on the deterministic crawl and contributes only connection-signal suggestions. Merges are pure and non-destructive: new suggestions land as `review_state: "suggested"` (disabled until approved); user-approved or edited requirements are never overwritten; rejected ones stay rejected; unobserved discovery suggestions go stale, never deleted.

**Contract.** Stored as `v_production_contracts` (draft | approved) with child `v_contract_requirements` and `v_test_flows`. An approved contract is immutable; revising it copies forward into a new version. Approval is the gate before any paid run.

**Enqueue.** `POST /api/preflight/apps/[id]/runs` only reserves credits and inserts a `queued` job. It never touches a browser, Playwright, provider secrets, or signed URLs. It runs a long gate ladder first (flag, kill switch, cost-governor auto-pause, global in-flight brake, auth, team access, editor role, velocity, DB-ready, contract approved, at least one enabled+approved flow, safe HTTPS target, per-owner concurrency cap, daily cap, idempotency, billing hold). The eligible flow selection is snapshotted onto `v_preflight_runs.flow_ids`; the worker executes exactly that stored set. Enqueue is idempotent via `unique(user_id, submission_id)`.

**Claim + execute.** The Railway worker polls, atomically claims one run via the advisory-locked `v_preflight_claim()` RPC, takes a time-boxed lease, and executes. Before any paid session it enforces a target invariant (first navigation must resolve onto the run's snapshot target, same origin); a violation is a harness failure with a full refund, never an app blocker. Each flow runs bounded, allowlisted steps (navigate, click, fill, select, assert, screenshot, and auth primitives, with no arbitrary JS). Observations are deterministic ground truth; the flow verdict and the run decision are derived by explainable rules, not a model.

**Decision.** Any critical flow failed or blocked yields **BLOCKED**; else any failure (or a critical policy/auth-config block) yields **NEEDS REVIEW**; else **READY**. READY additionally requires full critical coverage, so a passing *partial* (targeted rerun) downgrades to **REPAIR VERIFIED**.

**Evidence + report.** Per flow, the worker drains console and network errors, persists the result, and best-effort uploads a final-state screenshot to a private bucket (suppressed while a secret is being entered). `finalizeRun` settles billing (retaining the enqueue hold *is* the charge; full refund if no flow executed) and reconciles issues. The report route (`GET /api/preflight/runs/[runId]`) returns owner-safe fields only, never a provider session id, storage path, signed URL, or lease/billing field. Artifacts are fetched separately through an owner-checked route that mints a fresh short-TTL signed URL.

### The worker

`worker/preflight/` is a standalone Node process (not a Next request): it loads env, builds a store + browser provider, runs the claim loop with a concurrency cap and a background heartbeat, exposes `/health`, and shuts down on SIGTERM/SIGINT. The real browser is **Browserbase-hosted Chromium** driven by `playwright-core` over CDP; session create/release go over native `fetch` (the SDK sets an invalid Content-Length). Leases are two-layered heartbeats: a lost lease or a cooperative cancel aborts browser work before the next step. A reaper requeues runs whose lease expired. In production the worker hard-refuses to boot with anything but the Browserbase provider.

> **Status:** the Postgres queue path and the Browserbase provider are implemented but the additive Preflight migrations are not yet applied against a live database, and the Browserbase provider has not yet been exercised on a full external customer-path run. Lifecycle logic is proven by a DB-free, browser-free test harness (`FakeRunStore` + `FakeBrowserProvider`, cases A–I) and a staged real-Browserbase smoke test (gated by `VRAELIS_SMOKE=1`). Do not treat the live queue as production-verified until confirmed against a real deployment.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js `16.2.3`, React `19.2.4`, TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), design-token CSS |
| Backend | Next.js route handlers + a standalone Preflight worker (Railway) |
| Database | Supabase Postgres (`@supabase/supabase-js`), server-only service-role client |
| Auth | NextAuth (Auth.js) v5, JWT sessions, Credentials + Google + GitHub; `bcryptjs` for passwords |
| AI | Anthropic Claude via `@anthropic-ai/sdk`, model pinned to `claude-sonnet-4-6` (override `VRAELIS_EVAL_MODEL`), Zod structured output |
| Browser | Browserbase (hosted Chromium) driven by `playwright-core` over CDP |
| Payments | Stripe (Vraelis's own account; no Connect on the Preflight path) |
| Email | Resend |
| Desktop | Tauri app under `desktop/` |

> This is a customized Next.js with breaking changes vs. common knowledge (see `AGENTS.md`). Read the relevant guide in `node_modules/next/dist/docs/` before writing code.

---

## Data model and security

- **Tenancy.** Every Preflight table carries a `user_id` (the lowercased, trimmed email) and every read/write filters on it. The owner email comes from the NextAuth session, never from the request body.
- **Auth is NextAuth, not Supabase Auth**, so `auth.uid()`-based RLS would match nothing. The service-role client bypasses RLS; ownership is enforced in application code. Sensitive tables (`v_app_connections`, `v_run_artifacts`, `v_issues`) enable RLS with no permissive policies as a deny-anon backstop. Child tables (`v_run_steps`) have no `user_id` and are reachable only transitively through an owner-scoped parent read.
- **Secrets** (test-account logins, API credentials) are sealed with AES-256-GCM using a key only from `VRAELIS_SECRET_KEY`: fail-closed, no plaintext fallback. Ciphertext lives in `v_app_connections.encrypted_ref`, is never selected by list reads, never returned to a client, never logged. Plaintext is decrypted only at moment-of-use inside the worker/executor and nulled after. Connection metadata is defense-in-depth sanitized (secret-looking keys dropped, credential-shaped values redacted).
- **Evidence** lives in a private Supabase Storage bucket with unguessable object paths, served only via short-lived (120s) signed URLs minted after an owner + artifact ownership check.
- **Abuse control** for run launches is a DB-backed governor, not an IP limiter: per-owner concurrency cap (2), per-owner daily cap, per-account velocity cap, a circuit breaker on infra failures, a global in-flight cap, and a `$`/hour + `$`/day provider-cost auto-pause. Deployment URLs are SSRF-guarded (public HTTPS only) before a run queues.
- **Billing is owner-anchored across teams:** the app creator's `user_id` is the billing / credit / free-pass / uniqueness key; a workspace only shares *access*. Free-pass abuse is bounded by a canonical-email cluster with an atomic claim to close the double-spend race.
- **Migrations** are hand-authored idempotent SQL in `sql/`, applied manually in the Supabase SQL editor, strictly additive (`create ... if not exists`, `add column if not exists`), never renaming or dropping. Code is written to run ahead of a migration: each data function tolerates a missing table/column, warns which SQL file to apply, and degrades.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the variables below
npm run dev                  # http://localhost:3000
```

On dev, the product is served in place at clean paths (no subdomain); `/applications`, `/passes`, etc. are rewritten to `/rank/app/*` by `proxy.ts`. Use `npx tsc --noEmit` to typecheck.

**Preflight worker + verification scripts** (all run via `tsx`):

```bash
npm run preflight:worker          # run the worker (worker/preflight/index.ts)
npm run preflight:worker:test     # DB-free, browser-free lifecycle verification
npm run preflight:smoke:browserbase   # staged real-Browserbase smoke (needs VRAELIS_SMOKE=1 + keys)
npm run preflight:verify-db       # read-only migration data-shape check
```

Many more `preflight:*` scripts cover migrations, artifacts, seeding/rerunning runs, reconciliation, limits, security, decision, connect, and entitlements (see `package.json`).

---

## Deployment

The web app and marketing deploy on Vercel; the Preflight worker runs as a separate long-running process on Railway. `proxy.ts` (middleware) does the host split (`vraelis.com` serves the marketing site, `app.vraelis.com` serves the signed-in product) and keeps internal `/rank/*` URLs out of the address bar. Migrations are applied by hand: run the `sql/vraelis-preflight*.sql` files (idempotent) in the Supabase SQL editor, then verify with the schema + data-shape verifiers.

---

## Environment variables

```
# Core
SUPABASE_URL= (or NEXT_PUBLIC_SUPABASE_URL=)   SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_SECRET=
VRAELIS_LLM_API_KEY= (or ANTHROPIC_API_KEY=)   VRAELIS_EVAL_MODEL=   # defaults to claude-sonnet-4-6
VRAELIS_SECRET_KEY=            # 64 hex chars; seals integration credentials (AES-256-GCM). Fail-closed.
RESEND_API_KEY=               VRAELIS_FROM_EMAIL=

# Auth providers
GOOGLE_CLIENT_ID=  GOOGLE_CLIENT_SECRET=   GITHUB_ID=  GITHUB_SECRET=

# Payments (Stripe, Vraelis's own account)
STRIPE_SECRET_KEY=  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  STRIPE_WEBHOOK_SECRET=

# Preflight worker (Railway)
BROWSER_PROVIDER=browserbase   BROWSERBASE_API_KEY=

# Operational flags (optional)
VRAELIS_PASS_PRICING=          # 1 = per-pass subscription/PAYG ladder; off = legacy $10/pass
VRAELIS_RUNS_DISABLED=         # hard kill switch for new runs
PREFLIGHT_MAX_RUNS_PER_DAY=    # per-owner daily cap (default 20)
VRAELIS_SMOKE=                 # 1 = enable the staged real-Browserbase smoke test
```

---

## Pricing

Priced by the run, not the seat. Every Production Pass includes real-browser execution, evidence, issue tracking, and an explainable launch decision, and the first pass is free. The live default is pay-as-you-go per pass; a per-pass subscription ladder exists behind `VRAELIS_PASS_PRICING` and is inert until enabled.

---

## Contributors

Built by the Vraelis team (solo founder + AI pair-engineering).

---

*Vraelis returns evidence-backed decisions about defined behavior. It verifies production requirements; it does not certify safety or guarantee a system is harmless.*

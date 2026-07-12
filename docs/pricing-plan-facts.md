# Vraelis Pricing Plan — Repo Fact Sheet (read-only investigation, 2026-07-12)

## 1. Do the features exist? (What is actually built today)

**Billing engine (live):** append-only credit ledger `v_credit_ledger` (`sql/vraelis-rank.sql:31-42`), balance = sum of live deltas (`lib/v-credits.ts:33-36`). Two buckets: `monthly` (expires at period end) and `purchased` (never expires) (`sql/vraelis-rank.sql:38`). Unit: 1 credit = $0.10 at top-up (`app/api/v/checkout/route.ts:16`, CREDITS_PER_DOLLAR=10).

**Pass billing (live):** `estimateRunCredits(flows)` = 1 credit/flow, min 1 (`lib/preflight/flow-selection.ts:70-74`). Hold at enqueue (`app/api/preflight/apps/[id]/runs/route.ts:126`), hold retained = charge on completion (`worker/preflight/run-store-postgres.ts:194-199`), full refund when no flow executed (`run-store-postgres.ts:146-148, 169`). Idempotent per reservation (`lib/v-credits.ts:126-134`). NOTE: this is still CREDIT units, not the $10-base/$2-per-extra-flow cents model — that migration is designed but NOT executed (`docs/pricing-migration-plan.md:3-4`, "billing logic still runs the legacy credit ledger").

**Plans UI (live):** `app/rank/app/plans/page.tsx:12-15` shows Pro $99/20 passes and Scale $299/75 passes as a NON-purchasable "Preview" (disabled buttons, line 87). These numbers DIFFER from the approved architecture (Builder $49/10, Pro $149/40, Scale $399/150) — the public preview must be updated whatever ships.

**Legacy subscription machinery (live but orphaned):** `lib/v-plans.ts:8-16` PLAN_CATALOG = starter $19/150cr, creator $49/500cr, pro $149/2000cr, scale $399/7500cr (monthly+yearly). Full checkout (`app/api/v/subscribe/route.ts`), webhook grant (`lib/v-subscriptions.ts:47-86`), cancel (`app/api/v/cancel/route.ts`), portal (`app/api/v/portal/route.ts`), and PayPal parallel path (`app/api/v/paypal/create-subscription`, `lib/v-paypal-subs.ts`) all exist and work — but the plans UI no longer links to them (`docs/pricing-migration-plan.md:16-17`). These credits are Rank-product credits; the preflight pass path spends the same ledger, so the plumbing is directly reusable.

## 2. Are the limits enforced? (Approved-ladder benefit classification)

| Benefit | Status | Evidence / mechanism |
|---|---|---|
| Passes/month metering | **IMPLEMENTABLE NOW** | No monthly pass counter exists. Two ready mechanisms: (a) grant N×5 credits into the `monthly` bucket via `grantMonthly` (`lib/v-credits.ts:222-225`) — expiry gives the reset for free; (b) a `ownerRunsThisMonth` count mirroring `ownerRunsToday` (`lib/preflight/runs-db.ts:197-203`). (a) is one webhook line; (b) needs a gate in both run routes. |
| Flows/pass cap (3/5/10/20) | **IMPLEMENTABLE NOW** | No cap today — any number of approved flows accepted (`app/api/preflight/apps/[id]/runs/route.ts:73-77` only dedupes). Add `flowIds.length > planCap → 400` in `runs/route.ts` and `rerun/route.ts` after resolving plan via `getPlan` (`lib/v-db.ts:49-57`). |
| Application caps (1/2/10/more) | **IMPLEMENTABLE NOW** | No cap — `app/api/preflight/apps/route.ts:35` creates unconditionally. Add a count check before `createApplication` (`lib/v-applications.ts`). |
| Free tier = ONE lifetime pass | **NOT IMPLEMENTED** | Today free users get `SIGNUP_FREE_CREDITS = 25` in the never-expiring `purchased` bucket (`lib/v-entitlements.ts:36`, `lib/v-credits.ts:64-77`) — enough for ~25 flow-runs, i.e. ~5-8 full passes, far more generous than the approved "one pass, 3 flows". Needs a lifetime-pass flag or a signup grant cut to 3 credits + a used-free-pass check. |
| Linked repair verification (rerun) | **IMPLEMENTED** | Reruns queue with parent provenance `setParentRun` (`app/api/preflight/runs/[runId]/rerun/route.ts:168`); targeted reruns charge only selected flows (`rerun/route.ts:136`); rerun-cheaper-than-pass cap does NOT exist yet (flat 1cr/flow makes it moot until cents pricing). |
| Evidence retention tiers (30d / longer) | **FUTURE (small)** | Zero retention machinery: artifacts live forever in the private bucket `vraelis-preflight-artifacts` (`lib/preflight/artifacts.ts:10`), deleted only on run/app cleanup (`artifacts.ts:66-71`). Needs a cron + `deletePreflightArtifacts` sweep keyed on plan + `created_at`. Honest phrasing today: "evidence retained" with no tier. |
| Priority queue (Pro/Scale over Free) | **FUTURE (schema change)** | Claim is strict FIFO: `order by created_at asc limit 1 for update skip locked` (`sql/vraelis-preflight.sql:227`). Needs a `priority` column + `order by priority desc, created_at asc` in `v_preflight_claim` + plan lookup at enqueue. Mechanically small, but a real SQL migration. Also note: one worker, `PREFLIGHT_MAX_CONCURRENT_RUNS` default 1 (`worker/preflight/config.ts:34`) — the whole system executes ~1 run at a time, so priority only matters under contention. |
| API access | **PARTIALLY / FUTURE for preflight** | Gate exists and is enforced: `apiAccessAllowed` (Scale+ or allowlist, `lib/v-entitlements.ts:45-49`) enforced at `app/api/v1/_auth.ts:56`, `app/api/v/keys/route.ts:21`, `app/api/v/sandbox/route.ts:21`. But `app/api/v1/**` is the Rank tests API — there are NO public API endpoints for preflight passes. Key infra (`v_api_keys`, `sql/vraelis-rank.sql:112`) is reusable; the preflight v1 endpoints are new work. |
| Higher concurrency (Scale) | **IMPLEMENTABLE NOW (per-owner), FUTURE (real throughput)** | Per-owner cap is a hardcoded const `MAX_ACTIVE_RUNS_PER_OWNER = 2` in both run routes (`runs/route.ts:32`, `rerun/route.ts:37`) — trivially plan-derived. But real concurrency is bounded by the single Railway worker (`maxConcurrentRuns` default 1); selling "higher concurrency" requires raising worker concurrency/instances. |
| Advanced usage controls (Scale) | **FUTURE** | Nothing user-facing exists. Operator-side controls exist: kill switch `VRAELIS_RUNS_DISABLED` (`runs/route.ts:45`), daily cap `PREFLIGHT_MAX_RUNS_PER_DAY` default 20 (`runs/route.ts:104`). |

## 3. Real cost per pass

**AI in the pass pipeline: NONE.** The worker (`worker/preflight/**`) contains zero model calls (grep confirms; `run-store-postgres.ts:161` "no browser, no model"). Claude is used ONLY in discovery/contract synthesis, pre-pass: `lib/preflight/discover-synthesis.ts:14-15,62` — `claude-sonnet-4-6` (env-overridable), temp 0, max_tokens 4000, prompt bounded at ~12k chars snapshot + 6k chars build prompt. At Sonnet 4.6 pricing ($3/$15 per Mtok): ~5-6k input tokens (~$0.017) + ≤4k output (≤$0.06) ≈ **$0.02-0.08 per discovery run** (per contract, not per pass). Fail-soft: no key → discovery still works deterministically (`discover-synthesis.ts:47`).

**Browser (Browserbase Developer $20/mo, 100 hrs included → $0.20/hr effective; $0.12/hr overage).** One session per run (`worker/preflight/execute-run.ts:111`), hard session cap 600s (`worker/preflight/providers/browserbase.ts:21`), per-flow cap 180s, run cap 900s, ≤30 steps/flow (`worker/preflight/config.ts:31-33`). Note the session auto-ends at 10 min even though the run cap is 15 min.

| Scenario | Browser time | Cost (included rate $0.20/hr) | Cost (overage $0.12/hr) |
|---|---|---|---|
| LOW (fixture-like, 30s) | 0.0083 hr | **$0.002** | $0.001 |
| TYPICAL (2 min) | 0.033 hr | **$0.007** | $0.004 |
| HEAVY (session cap 10 min; nominal 15-min run cap) | 0.167-0.25 hr | **$0.033-0.050** | $0.020-0.030 |

**Storage:** screenshots ≤10MB each, PNG typically well under 1MB (`lib/preflight/artifacts.ts:14`); Supabase free tier (1GB) ≈ $0 at current volume; signed URLs 120s TTL cost nothing (`artifacts.ts:57`).

**Stripe:** 2.9% + $0.30 on revenue. On a $10 PAYG pass: **$0.59/pass** (the dominant per-pass cost). On subscriptions it amortizes: $49 → $1.72; $149 → $4.62; $399 → $11.87.

**Cost per customer per month (marginal, TYPICAL 2-min passes; excludes ~$225/mo fixed baseline from `docs/pricing-architecture-approved.md:31-33`):**

| Plan | Passes | Browser | Stripe fee | Total marginal | Gross margin |
|---|---|---|---|---|---|
| Builder $49 | 10 | $0.07 | $1.72 | **~$1.80** | ~96% |
| Pro $149 | 40 | $0.27 | $4.62 | **~$4.90** | ~97% |
| Scale $399 | 150 | $1.00 | $11.87 | **~$12.90** | ~97% |

Worst case (every pass hits the 10-min session cap): Scale = 150 × 10 min = 25 hrs, still inside the 100 included hours → +$5. The >=3x price-over-cost rule (`pricing-architecture-approved.md:31`) is satisfied by enormous margin on marginal cost; the binding constraint is the fixed $225-805/mo baseline — Builder alone needs ~5 customers to cover it. Throughput reality check: 1 worker × 1 concurrent run ≈ 30 typical passes/hour max system-wide.

## 4. Stripe objects: required vs existing

**Exists:** 8 legacy plan price env vars all set locally — STRIPE_PRICE_{STARTER,CREATOR,PRO,SCALE}_{MONTHLY,YEARLY} (`.env.local`, names verified, values not read; `lib/v-plans.ts:18-20` reads them). Migration doc confirms Stripe products exist for the old plans (`docs/pricing-migration-plan.md:16`). Top-ups use dynamic `price_data` per checkout, no fixed product (`app/api/v/checkout/route.ts:42-50`). Two webhook endpoints/secrets accepted (`app/api/stripe/webhook/route.ts:550-553`).

**Required by the approved ladder:** 3 new products (Builder/Pro/Scale) × 2 licensed recurring prices each (monthly+yearly) = 6 prices; NO metered prices needed (passes are gated by the internal ledger/counter, not Stripe usage records). PAYG: keep dynamic `price_data` computed server-side from `estimateRunCents` (the migration plan's preferred single-source approach, `docs/pricing-migration-plan.md:41-44`). Free: no Stripe object. Legacy starter/creator prices: archive, don't delete (`pricing-migration-plan.md:44`). The env-var naming scheme `STRIPE_PRICE_<PLAN>_<CYCLE>` accommodates BUILDER with zero code change to `priceIdFor`.

## 5. Existing balances (structural, no amounts printed)

Ledger rows come from exactly these sources: `signup` grants (25 cr, purchased, one per account, `lib/v-credits.ts:64-77`), `topup`/`pack` purchases (Stripe session-deduped, `app/api/stripe/webhook/route.ts:591-604`), `monthly_reset` (legacy subs), `hold`/`refund`/`check`, `reward` (vote-to-earn), and a one-time founder `comp` grant via the gitignored ops script `scripts/grant-credits.ts` (reason `comp`, bucket `purchased`, ext_ref `comp:dogfood-outreach`, idempotent). Migration plan states production exposure is "founder account; no third-party paid balances" (`docs/pricing-migration-plan.md:50-51`) — verify with a ledger export before conversion, per that doc.

## 6. Annual support

**Code path works end to end for legacy plans:** subscribe accepts `cycle: "yearly"` (`app/api/v/subscribe/route.ts:27`), yearly price IDs exist in env, and `handleRankInvoicePaid` grants **12× monthly credits up front** with expiry at the year's period end (`lib/v-subscriptions.ts:66-70`). PayPal yearly also exists. For the new ladder: mechanism carries over unchanged; only new yearly Prices are needed. Caveat: yearly = 12× credits in the expiring `monthly` bucket, so an early hard cancel claws back the unused remainder (`lib/v-subscriptions.ts:116`) — matches "no partial refunds" policy but should be stated on the pricing page.

## 7. Monthly reset — does usage reset or accumulate?

**Resets, correctly.** Each `invoice.paid` grants a fresh `monthly` bucket expiring at `period_end` and immediately zeroes any PRIOR monthly bucket, sparing the just-granted rows (`lib/v-subscriptions.ts:70-73`, `expireMonthly` with `exceptExtRef`, `lib/v-credits.ts:238-244`). Spends draw monthly-first, tagged with the bucket's expiry so debits expire with the credits they consumed — no negative carry-over (`lib/v-credits.ts:82-96`). Purchased top-ups persist forever. Idempotent per invoice id against Stripe redelivery (`v-credits.ts:222-224`, clawback ref `v-credits.ts:238-243`).

## 8. Overage safety

**Fail-closed, no surprise charges.** Insufficient balance → 402 before anything runs (`runs/route.ts:127-129`); there is NO auto-charge/auto-topup path anywhere. Guards stack: per-owner concurrency 2 → 429; daily cap 20 runs → 429 checked BEFORE the hold (`runs/route.ts:98-106`); kill switch 503 (`runs/route.ts:45`); billing bypass is impossible in production (`runs/route.ts:36-40`). Approved-ladder overage (buy extra passes mid-month) = the existing top-up checkout, already live. No metered billing exists or is needed.

## 9. Downgrade: data and credits

**Data: fully preserved.** No code ties plan status to deletion of applications, contracts, runs, artifacts, or reports; deletion happens only via explicit owner action (`app/api/preflight/apps/route.ts:60-70`) or the manual account-deletion request flow. Caveat: with no retention system, "30-day retention on Builder" cannot truthfully imply Free data is deleted sooner — nothing is deleted.

**Credits:** cancel = `cancel_at_period_end`, tier active until period end (`app/api/v/cancel/route.ts:23`, `lib/v-subscriptions.ts:103`); monthly credits stay usable until their expiry; on hard/early termination the unused monthly bucket is clawed back idempotently (`lib/v-subscriptions.ts:110-116`). `past_due` keeps the tier through dunning (`lib/v-db.ts:54-56`). Purchased credits always survive. Mid-cycle plan change: new tier's grant replaces the prior tier's remainder (`lib/v-subscriptions.ts:72`).

**Refund policy (shipped copy):** purchased balance non-refundable but never expires; no pass executed → automatic hold refund; infra failures never billed; no prorated subscription refunds; billing errors case-by-case (`app/rank/refunds/page.tsx:23-38`). No programmatic Stripe refund exists for Rank/preflight money (the only `refunds.create` is the unrelated lead-agent product, `lib/vraelis-connect.ts:132`) — subscription refunds would be manual via dashboard.

## 10. Fake vs real benefits (what may be displayed publicly today)

**Real now:** real-browser execution w/ screenshots (Browserbase enforced in prod, `worker/preflight/config.ts:22-24`), evidence + explainable decision, hold/charge/refund guarantees, targeted + linked reruns, flat per-flow pricing, kill switch + daily cap, private evidence storage, monthly credit reset mechanics, yearly billing mechanics, in-app cancel, Stripe portal.
**Buildable within the pricing PR (name the gate, then ship it):** passes/mo metering, flows/pass caps, application caps, per-plan active-run cap, true one-lifetime-free-pass, Builder/Pro/Scale Stripe prices.
**Must NOT be displayed yet (FUTURE):** retention tiers (no deletion machinery), priority queue (FIFO SQL), "higher concurrency" (single worker, 1 concurrent run), preflight API access (no endpoints), advanced usage controls, invoicing above Stripe single-charge ceiling (`lib/v-entitlements.ts:55-74`). The current plans page already models the honest pattern: unsupported plans render as disabled "Preview" (`app/rank/app/plans/page.tsx:87`).

**Discrepancies the plan must resolve:** (1) preview page Pro $99/20 & Scale $299/75 vs approved Pro $149/40 & Scale $399/150; (2) legacy PLAN_CATALOG reuses the names "pro"/"scale" at different meanings — reusing plan keys risks `planFromPriceId`/entitlement collisions with the old Rank table (`lib/v-entitlements.ts:17-27`); (3) signup grant (25 purchased credits) contradicts the Free tier definition; (4) approved PAYG says "$3 per additional flow" (`docs/pricing-architecture-approved.md:9`) but the migration plan and live plans page say **$2** (`docs/pricing-migration-plan.md:21`, `app/rank/app/plans/page.tsx:64`) — one number must win; (5) credits→cents ledger migration (`docs/pricing-migration-plan.md` §3-6, flag `VRAELIS_PASS_PRICING`) is a prerequisite for true per-pass dollar pricing and has not been started.
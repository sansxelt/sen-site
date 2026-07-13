# Vraelis revenue-protection audit — findings (2026-07-13, read-only pass)

Scope: billing/entitlement/cost surface under VRAELIS_PASS_PRICING=1. No code changed in this pass.
This is the founder-facing summary + fix plan; the full agent report has file:line evidence.

## STATUS (2026-07-13)

- BLOCKER 1 (OAuth free-pass farming): FIXED IN CODE, adversarially verified CONFIRMED-CLOSED, all suites
  green. NOT YET LIVE — activate by applying sql/vraelis-preflight-9-free-grant-dedup.sql THEN deploying
  (code is deploy-safe ahead of the migration: it fails closed / degrades to the pre-table status quo).
  What shipped: (a) canonical_email on user_profiles written on EVERY signup path incl. OAuth, so the free
  pass is per real inbox (cluster), closing the OAuth alias hole; (b) freePassUsed resolves the canonical
  cluster and FAILS CLOSED to PAYG on any unreliable read; (c) an ATOMIC per-inbox claim
  (v_free_pass_claims, canonical_email PK) taken before createRun, which closes the concurrent-launch
  double-spend race an adversarial review caught in the first version (a lost claim re-prices to PAYG,
  a won claim is released on insert failure, orphans self-heal after 1h); (d) operator comp path
  (v_free_grant_overrides + admin route /api/v/admin/free-grant) as the fail-closed safety valve for a
  wrongly-charged legit user; (e) IP/device/ASN captured as SIGNAL ONLY (hashed, never a denial key) in
  v_free_grant_risk. Tests: scripts/preflight-free-grant-dedup-verify.ts (free:grant:test, 53/53).
- BLOCKER 2 (dispute/chargeback + webhook dedupe): FIXED IN CODE, adversarially verified (two review
  rounds), all suites green. NOT YET LIVE — apply sql/vraelis-preflight-10-dispute-dedupe.sql THEN deploy.
  What shipped: (a) charge.dispute.created FREEZES execution NON-DESTRUCTIVELY (v_profiles
  billing_access_state='frozen_dispute', previous_plan_v1 snapshotted, plan_v1 preserved) blocking ALL
  five spend surfaces via gatePassLaunch mode 'frozen' (403); restore is MANUAL admin-only
  (/api/v/admin/billing-restore) after a won dispute. (b) DB-UNIQUE webhook dedupe
  (stripe_webhook_events, stripe_event_id pk) claimed before dispatch; a failed CRITICAL handler RELEASES
  the claim and returns 500 so Stripe retries and the freeze lands (closes the adversarial-review CRITICAL
  dropped-freeze). (c) _v1 resurrect guard: setPlanV1 refuses to re-activate a frozen owner. (d) retry-safe
  idempotent billing emails (stripe_notifications_sent, keyed event+type+recipient) so a 500-retry never
  double-sends (closes the MEDIUM review regression). (e) attribution keyed on the lowercased owner
  (checkout metadata.user_id = owner). Tests: scripts/preflight-dispute-dedupe-verify.ts
  (dispute:dedupe:test, 36/36). Follow-up (minor, non-blocking): founder alert after dispute-attribution
  retry exhaustion; longer-term a transactional outbox for state+email.
- BLOCKER 3 (cost governor + kill switches): FIXED IN CODE, adversarially verified (initial review found
  a CRITICAL breaker-allowlist drift + 3 more findings; all four fixed and re-verified CONFIRMED-CLOSED;
  a final full-diff interaction review over all three blockers found no critical/medium bug). NOT YET
  LIVE — apply sql/vraelis-preflight-11-cost-governor.sql THEN deploy. What shipped: (a) provider-cost
  ledger (v_cost_ledger; launch estimate + REAL executed seconds at settlement — both sum, over-count
  trips earlier); (b) global ceilings $2/rolling-hour + $8/UTC-day (env-configurable), warn 50% / alert
  80% / AUTO-PAUSE 100%, DB-durable (v_runs_governor survives redeploys), reset OPERATOR-ONLY with a 15m
  grace so in-window spend doesn't instantly re-trip; (c) per-account velocity 8 sessions/rolling-hour
  (429) + circuit breaker 3 provider/infra failures per 15m -> OPEN, 60m cooldown — the breaker set now
  covers EVERY classifyProviderError code (the drift that defeated it is test-locked); (d) global
  in-flight cap 12 (bounds burst overspend + the reset-grace blind spot to ~$3.60/15m); (e) admin surface
  /api/v/admin/governor (reason/threshold/usage/reset) + a SEPARATE audited emergency halt that cancels
  in-flight (never the automatic trip). Launches fail before billing while paused/throttled; reports and
  billing pages stay available. Tests: scripts/preflight-cost-governor-verify.ts (cost:governor:test,
  45/45). Hardening from the final review: webhook stale-'processing' claim self-heal (a hard crash can
  no longer permanently dedupe away an unprocessed dispute).
- ALL THREE BLOCKERS ARE NOW CODE-COMPLETE AND ADVERSARIALLY VERIFIED. Public launch is unblocked ONLY
  after the operator: applies migrations 9 + 10 + 11 (all strictly additive, validated), merges + deploys,
  and confirms the live behavior. Until then the deployed product runs the pre-fix code.

## The two pre-launch BLOCKERS (fix before public availability / any ad)

1. OAUTH FREE-PASS FARMING (highest leverage). [FIXED — see STATUS above.] The lifetime free pass is per lowercased-email owner,
   decided by scanning v_preflight_runs (entitlements-v1.ts freePassUsed). The canonical-email alias dedup
   (register route + user_credentials unique index) covers CREDENTIALS signup ONLY. OAuth signup
   (auth.ts syncUserProfileIdentity) never writes user_credentials.canonical_email, so you+a@gmail /
   you+b@gmail via Google, or a Google + a GitHub account, are DISTINCT owners -> each gets a free pass.
   Compounded by: infra-failed runs never consume the free pass (runConsumesAllowance is false on
   failed/cancelled with no executed flow), and there is NO provider spend budget. Result: effectively
   uncapped provider burn from scripted alias accounts.

2. NO DISPUTE/CHARGEBACK HANDLING. Zero handlers for charge.refunded / charge.dispute.created /
   charge.dispute.closed / payment_intent.payment_failed. A subscriber can pay, consume the full monthly
   allowance, dispute the charge, and KEEP plan_v1 (a dispute does not itself emit subscription.deleted).
   ~$430+/disputing Scale customer, repeatable monthly until manually caught.

## Serious hardening (before meaningful paid volume)

3. PAYG cent hold is check-then-write with NO advisory lock (apps/[id]/runs/route.ts calls hold() directly,
   not the atomic RPC). Concurrent launches can overdraft the balance negative. Bounded only by
   MAX_ACTIVE_RUNS_PER_OWNER=2 and ownerActiveRunCount (which degrades to 0 on a DB read error). No DB
   balance floor. Fix: move the cent hold into an advisory-locked RPC + a one-active-hold-per-run unique index.
4. NO Stripe event-id dedupe table. Idempotency is per-effect (ledger ext_ref, v_payments stripe_id). An
   out-of-order updated(active) arriving after deleted would re-set plan_v1 on the _v1 branch (no resurrect
   guard). Fix: a stripe_webhook_events(event_id pk) insert-once at the switch head + a _v1 resurrect guard.
5. NO cost governor. Nothing tracks Browserbase seconds / artifact bytes / AI cost / estimated provider
   spend per run; no free-tier or global $/hour budget; no auto-pause. Only the manual VRAELIS_RUNS_DISABLED
   kill switch exists. Fix: v_cost_ledger + budgets that auto-throw the kill switch.
6. Refund/infra loop: 20 runs/day x 3 attempts = up to 60 Browserbase sessions/day/account, all refunded,
   free pass never consumed. No per-account/hour session velocity cap, no provider circuit breaker, no retry
   backoff. Fix: v_provider_attempts per-hour counter + circuit breaker + backoff.

## Confirmed SAFE today

- NO free trials anywhere (no trial_period_days/trial_end; _v1 activates only on invoice.paid). LATENT: if
  a trial were ever enabled, handleRankSubChange would grant on 'trialing' before payment -> never enable
  trials on a _v1 price, and (fix pass) gate _v1 activation strictly on paid status.
- Server-authoritative pricing: client never supplies cents/price-id; prices resolve from PLAN_CATALOG_V1;
  top-up amount clamped MIN/MAX. Credentials-signup alias farming is blocked (canonical-email unique index).
- Unit cent/credit separation holds IF migration 6's unit-aware RPCs are applied (operator: confirm applied
  in every runtime).

## OPERATOR ACTIONS (Stripe dashboard, founder only)

- Audit + delete any 100%-off / long-duration promotion codes: allow_promotion_codes:true is set on
  subscribe/checkout/team, so any such code you created is redeemable by any user and would activate a _v1
  allowance at $0.
- Customer Portal: restrict plan-switching to the _v1 product family, disable creating a second
  subscription, keep cancel-at-period-end.
- NEVER enable trial periods on any _v1 price.
- Confirm sql/vraelis-preflight-6-pass-pricing.sql (unit-aware RPCs) is applied in production.

## Required migrations (fix pass, all additive)

stripe_webhook_events (event_id pk); v_provider_attempts (per-hour session counter); v_cost_ledger;
one-active-hold-per-run unique index + an atomic cent-hold RPC; v_disputes; v_free_grant_risk (identity
cluster for OAuth-alias dedup); v_active_subscriptions (one active _v1 sub per owner).

## Safe implementation order

1. DB constraints + stripe_webhook_events table (no behavior change).
2. Webhook idempotency + dispute handlers (freeze execution, snapshot ledger, debt/risk state, founder alert).
3. Atomic PAYG cent hold (advisory-locked RPC).
4. Cost governor: v_cost_ledger + free-tier and global $/hour budgets with auto-pause feeding the kill switch.
5. Free-abuse: OAuth-alias/risk-cluster dedup in gatePassLaunch + email-verification gate before free run.
6. Rate limits: per-account/hour session velocity cap + provider circuit breaker + retry backoff.

## Maximum plausible loss

Before controls: hundreds-to-thousands $/day (free-pass farming via OAuth aliases, self-sustaining because
infra-failure never consumes the pass and there is no budget) + ~$430/disputing Scale customer + small
per-account ledger-race overdraft. After the proposed controls: ~$0.20 per genuinely distinct human with a
hard aggregate $/hour cap; ledger race -> $0; dispute bounded to one partial consumed period + the Stripe fee.

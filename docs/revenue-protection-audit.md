# Vraelis revenue-protection audit — findings (2026-07-13, read-only pass)

Scope: billing/entitlement/cost surface under VRAELIS_PASS_PRICING=1. No code changed in this pass.
This is the founder-facing summary + fix plan; the full agent report has file:line evidence.

## The two pre-launch BLOCKERS (fix before public availability / any ad)

1. OAUTH FREE-PASS FARMING (highest leverage). The lifetime free pass is per lowercased-email owner,
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

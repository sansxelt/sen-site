# Per-pass pricing migration plan (PROPOSED, not yet executed)

Status: public copy migrated (2026-07-12); billing logic still runs the legacy credit ledger. This document
is the required pre-read before ANY change to production billing logic. Do not implement pieces of it ad hoc.

## 1. Existing billing schema and assumptions

- Ledger: `credit_ledger`-style rows via `lib/v-credits.ts` — `grant/hold/refund` with `delta`, `bucket`
  (`purchased` | `monthly`), `expires_at` (monthly bucket only), `ext_ref` idempotency. Balance = sum of
  live deltas. Refunds return to the SAME bucket they were held from; expired monthly holds are gone.
- Unit: 1 credit. Purchase rate (checkout + PayPal): $1 = 10 credits, so 1 credit = $0.10.
- Preflight runs: `estimateRunCredits(selectedFlowCount)` = 1 credit per selected flow, min 1
  (lib/preflight/flow-selection.ts), held at enqueue (`cost_reservation_id`, `credits_held` on the run),
  retained as the charge on completion, refunded in full when no flow executed. Idempotent per reservation.
- Signup grant: `ensureSignupGrant` gives `SIGNUP_FREE_CREDITS` to the `purchased` bucket, deduped by ext_ref.
- Subscriptions: legacy plan catalog with monthly credit grants (Stripe products exist for old plans);
  the plans UI no longer links to plan checkout.

## 2. Target model

- Production Pass: $10 base, includes up to 5 selected approved flows; $2 per additional selected flow.
- Targeted rerun: charges only the flows it executes: $2 x selected flows, min $2, capped at the price a
  fresh full pass of that flow count would cost (a rerun must never cost more than a new pass).
- Free tier: one complete Production Pass (up to 3 critical flows), no card.
- Unchanged invariants: hold before execution, charge only when execution begins, full refund when no flow
  ran or on any Vraelis-side infrastructure failure, idempotent duplicate submissions, kill switch, daily cap.

## 3. Required database migration

- Additive: `alter table credit_ledger add column if not exists unit text default 'credit'` OR (preferred)
  a new `cents` ledger keyed identically (same bucket/ext_ref semantics) with the old table kept read-only.
- Runs: `v_preflight_runs.credits_held` is renamed in meaning only (held units); add `held_cents` alongside
  during the transition so old rows stay interpretable. No destructive change; both columns coexist.
- Conversion job (one-shot, dry-run first): each account's live credit balance converts to cents at the
  PRICE PAID: purchased credits convert at $0.10/credit (exactly what the customer paid); promotional/signup
  credits convert at a published promotional value (proposal: enough for one free pass). Emit a per-account
  audit row (`ext_ref: migration:<user>`), never delete source rows.

## 4. Stripe product/price changes

- New Products: "Production Pass" (one-time, $10) and "Additional flow" ($2) OR keep dynamic `price_data`
  (current approach) computed server-side from the same `estimateRunCents` function — preferred: one source
  of truth, no drift between catalog and estimator.
- Retire (archive, do not delete) the legacy credit-pack and plan Prices so history renders correctly.
- Webhook: grant cents (not credits) on completion, same session-id dedupe.

## 5. Effect on existing balances / balance safety

- Nobody's balance is reinterpreted silently: conversion honors purchase price, is audited per account, and
  runs with a dry-run diff first. Today's production exposure is minimal (founder account; no third-party
  paid balances), so the conversion table should be tiny — verify with a ledger export before running.
- "Balance keeps its full purchase value through the change" is the public promise already shipped; the
  conversion math above is what makes it true.

## 6. Safe transition plan (order matters)

1. (DONE) Public + in-app copy migrated; checkout flagged early access; no behavior change.
2. Land `estimateRunCents` + cents ledger behind `VRAELIS_PASS_PRICING=1` (default off), with the legacy
   path untouched. Both estimators tested side by side.
3. Apply the additive migration; run the balance conversion dry-run; review the diff; apply.
4. Flip `VRAELIS_PASS_PRICING=1` in production; monitor holds/refunds for a day; keep the flag reversible.
5. Remove the legacy estimator after a clean week; archive legacy Stripe prices.

## 7. Tests required before flipping

- Estimator: 3 flows -> $10; 5 -> $10; 6 -> $12; 10 -> $20; rerun of 1 -> $2; rerun of 8 on a 10-flow
  contract capped at fresh-pass price; min charges.
- Ledger: hold/charge/refund parity in cents; idempotent refund per reservation; conversion dry-run
  round-trips (credits -> cents -> audit sum matches).
- Routes: 402 on insufficient balance under both flags; conflict/idempotency unchanged; kill switch.
- Copy: pricing:copy:test stays green (no stale economics reappear).
- E2E: one fixture pass under the flag in a non-production environment before production flip.

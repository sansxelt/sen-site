# FINAL pricing verdict (founder-approved 2026-07-12) — build flag-gated, checkout LAST

Ladder: FREE $0 (1 LIFETIME pass, 3 flows, 1 application; 25-credit signup grant CUT at cutover).
PAYG $15/pass public ($10 stays only as the current early-access price until flip); includes 5 flows,
$3/additional flow; targeted rerun = $3 x selected failed flows, CAPPED at the comparable full-pass price.
BUILDER_V1 $49/mo $490/yr: 10 passes/mo, 5 flows/pass, 2 apps.
PRO_V1 $149/mo $1,490/yr: 40 passes/mo, 10 flows/pass, 10 apps.
SCALE_V1 $399/mo $3,990/yr: 150 passes/mo, 20 flows/pass.

Rulings: (1) $3 not $2 per extra flow. (2) FRESH plan keys builder_v1/pro_v1/scale_v1 - never reuse legacy
meanings. (3) Old Pro $99/Scale $299 preview removed when new pricing UI ships; no conflicting public
numbers. (4) Free grant = one lifetime pass w/ 3 flows, replaces 25-credit grant AT FLAG FLIP only.
(5) Cents ledger first, behind disabled flag (VRAELIS_PASS_PRICING). (6) Annual = 10x monthly. (7) Annual
charges up front but releases usage in MONTHLY buckets (never 12 months of passes on day one).
(8) Cancellation defaults to cancel-at-period-end; customer keeps paid-for access; NO clawback of unused
annual months on mere renewal cancellation. (9) Proportional revocation only with a real refund /
exceptional immediate cancellation. (10) NEVER display until enforced: retention tiers, priority queues,
preflight API access, higher concurrency, advanced usage controls.

Subscription rerun rule: targeted reruns deduct only selected-flow usage, never a full-pass allowance.
Chosen mechanism: subscription allowance metered in FLOW UNITS per subscription month =
passes_per_month x flows_per_pass (e.g. builder_v1: 50 units). A full pass consumes its selected flow
count; a targeted rerun consumes only its selected count. Monthly window computed from the subscription
anchor at request time (no cron needed); UI shows passes-equivalent (unitsUsed / flowsPerPass).

Implementation order (approved): 1 cents-ledger migration flag-gated; 2 versioned plan catalog +
entitlements; 3 app caps; 4 flows/pass caps; 5 monthly pass buckets + annual monthly release; 6 selected-
flow rerun accounting; 7 Stripe products + monthly/yearly prices (operator creates; code reads
STRIPE_PRICE_{BUILDER_V1,PRO_V1,SCALE_V1}_{MONTHLY,YEARLY}); 8 webhook idempotency/upgrade/downgrade/
cancel/refund/portal verification; 9 founder/comp balance conversion (audited, price-paid); 10 cut signup
grant at flip; 11 public pricing + checkout LAST.

Before enabling checkout return: migrations applied; Stripe product/price IDs required; entitlement
enforcement proof; existing-balance conversion report; upgrade/downgrade tests; annual cancellation
behavior; refund behavior; feature-flag rollout + rollback procedure.

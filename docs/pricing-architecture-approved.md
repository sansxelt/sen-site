# Founder-approved pricing architecture to evaluate (2026-07-12) — DO NOT ship until pricing approval

Primary model for the 10-section plan (plan first; WAIT for founder approval before changing public
pricing or checkout; never activate fake subscription checkout):

- FREE: $0. One LIFETIME Production Pass, up to 3 critical flows, 1 application, real-browser evidence,
  full decision, no card.
- PAY AS YOU GO: early access $10/pass, expected public price $15/pass. Includes 5 critical flows,
  +$3 per additional flow. Targeted reruns charge only selected flows. No subscription.
- BUILDER: $49/mo, $490/yr. 10 passes/mo, 5 flows/pass, 2 applications, linked repair verification,
  30-day evidence retention.
- PRO (main plan): $149/mo, $1,490/yr. 40 passes/mo, 10 flows/pass, 10 applications, API access, longer
  retention, priority queue over Free/Builder.
- SCALE: $399/mo, $3,990/yr. 150 passes/mo, 20 flows/pass, higher concurrency, more applications, longer
  retention, advanced usage controls, priority execution.
- Annual = ~10 months (two months free). Monthly/yearly toggle required.

## Must verify BEFORE recommending final numbers
Actual Browserbase cost/pass (Developer: $20/mo, 100 browser hours, $0.12/hr overage; observed fixture
pass ~10s browser time; assume real apps 1-3 min), Claude/API cost per pass, artifact/storage cost, retry
cost, refund behavior, billing schema compatibility, Stripe products/prices required, entitlement
enforcement, overage handling, and whether EVERY listed benefit exists today. Classify each benefit:
implemented / implementable in this pass / future. Unsupported benefits never display publicly.

## Plan must lead with
1 Recommended final pricing; 2 Unit economics + margin model; 3 Monthly/yearly entitlement table;
4 Stripe + database changes; 5 Safe migration from existing pay-as-you-go (credits ledger; see
docs/pricing-migration-plan.md).

## Finance constraints (from the founder operating plan)
- Rule: plan price >= 3x expected direct delivery cost. Fixed baseline today ~$225/mo (Claude Max $200,
  ChatGPT $20, Railway $5); later production estimate $290-805/mo incl. Browserbase ~$20, Vercel Pro ~$20,
  Supabase Pro ~$25, Claude API cap $500 (hard cap, not auto-spend). Keep ~$900-1000/mo available.
- Revenue ladder: $1k MRR = self-paying; first goal 10 customers x $100. Paths to $10k: 100x$100 / 40x$250
  / 20x$500. Bias toward fewer, higher-value customers.
- Entitlements must control: passes, flows/pass, browser minutes, screenshots, retention, concurrency,
  team access, reruns, API access, support level. Track cost per pass + per customer.
- Founder-operated: automate before hiring; margins protected; taxes/refunds reserved separately.

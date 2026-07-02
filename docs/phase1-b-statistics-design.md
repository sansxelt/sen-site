# Phase 1 · Workstream B — Real Statistics (design, not built)

_Design doc. **Do not build until a demand test passes.** The trigger to implement is
a paying customer, not this doc. Written so implementation is a mechanical follow._

## Why

Today the headline decision fields are **threshold labels over a flat, unweighted vote
count** — the code itself admits it: `directional_confidence` is bucketed by
`marginPts`/`total` and commented _"a label, never a statistical guarantee"_
(`lib/v-intelligence.ts:129-134`); the tally is a plain `+1` per valid judgment. The one
real statistic is a Wilson lower bound used only for the secondary `signal_convergence`
field (`lib/v-intelligence.ts:39-47`).

Vraelis's entire moat is "trust the human signal." B replaces the labels with defensible
estimates so that **every number reaching a customer is one we can defend** — a real
probability with an interval, an honest sample-size read, and a consensus measure. The
scaffolding already exists (the Decision Package and report have slots for these fields),
so B is mostly swapping the estimator behind existing fields — not new surfaces.

## Goals / non-goals

**Goals (Phase 1):** reputation-weighted aggregation; honest confidence for the
comparative (k-option) case with credible intervals; sample-size / power guidance;
a real consensus/agreement read; labels *derived from* the numbers.

**Non-goals (deferred, with reasons):**
- **Adaptive / sequential stopping** — peeking inflates false positives; doing it right
  needs always-valid inference (mSPRT / e-values). Ship fixed-N + power first.
- **Krippendorff's α across items** — wrong tool here. A run is *one decision by many
  raters*, not many items; classic α/κ need repeated items. For single-decision runs the
  honest reliability read is **consensus concentration** (below). α becomes right only
  with rubric/Likert methodologies or split-panel agreement (Phase 2+).
- Rubric/Likert methods, per-segment cuts beyond `audience_fit`, media eval.

## The model

### 1. Honest confidence (the core change)
Replace the `marginPts` buckets with a posterior over the vote distribution.

- **2 options:** votes ~ Binomial(n, p), p = P(prefer A). Beta(1,1) prior → posterior
  Beta(1+x, 1+(n−x)). Report **P(p > 0.5)** ("probability A is genuinely preferred") and
  a 95% credible interval on p. Exact and small-n honest; consistent with the Wilson
  bound already present.
- **k options (3–8):** counts ~ Multinomial, Dirichlet(1,…,1) prior → posterior
  Dirichlet(counts+1). By Monte Carlo (10k **seeded** draws — cheap, reproducible):
  **P(winner is truly #1)**, **P(winner beats runner-up)**, and credible intervals on the
  winner's share and the **top-two margin**. This directly answers "is the leader real or
  noise."
- **Label is derived from the number**, never independent:
  `≥0.95 → Strong · 0.80–0.95 → Moderate · <0.80 → Tentative · no winner → None`.

### 2. Reputation-weighted aggregation
Each valid judgment from voter *v* contributes weight *wᵥ* instead of `+1`.

- Reliability with shrinkage toward the pool mean *m* (Beta prior, strength α≈5), so
  low-volume voters aren't extreme: `rᵥ = (validᵥ + α·m) / (validᵥ + rejectedᵥ + α)`.
- Bounded multiplier: `wᵥ = clamp(rᵥ / m, 0.5, 1.5)`; a brand-new voter (no history) gets
  `wᵥ = 1` (neutral). Weighting **nudges, never swings**.
- **Honesty safeguard — weighting must not inflate confidence.** Feed the estimator the
  **Kish effective sample size** `n_eff = (Σwᵥ)² / Σwᵥ²`, which is always `≤ n`. Weighting
  can change the *recommendation* but can only *reduce* the precision claim.
- **Decouple from billing.** Weighting affects the recommendation/confidence ONLY. What
  counts toward `votes_target`, what earns a reward, and what gets refunded stay
  `1 credit = 1 valid judgment` (raw) — the escrow/refund invariant is untouched.
- Always compute and store **both raw and weighted**; the report shows the raw count and
  can show the weighting's effect, so nothing is hidden.

### 3. Consensus / reliability (single-decision runs)
Report **observed agreement** = P(two random raters picked the same option) = `Σ pᵢ²`,
alongside the posterior P(winner is #1). This is the honest "how much do people agree"
read for a one-item run — labelled as consensus, **not** mislabelled as α.

### 4. Power / sample size
2-option: to get a 95% credible interval half-width ≤ *w*: `n ≈ p(1−p)(z/w)²`. Surface
"collect ~N more for a confident call." k-option: recommend *n* to shrink the top-two
margin interval below the observed margin.

## New module: `lib/v-stats.ts` (pure, unit-tested, no DB)

```
wilsonLowerBound(x, n, z=1.96): number                    // moved from v-intelligence
betaBinomPreferProb(x, n, prior=[1,1]):
    { mean, lo, hi, probAboveHalf }
dirichletTopProbs(counts:number[], {prior=1, draws=10000, seed}):
    { pWinnerIsTop, pWinnerBeatsRunner, winnerShareCI:[lo,hi], topTwoMarginCI:[lo,hi] }
kishEffectiveN(weights:number[]): number                  // (Σw)²/Σw², always ≤ n
observedAgreement(counts:number[]): number                // Σ pᵢ²
recommendedSampleSize({p, targetHalfWidth, z=1.96}): number
confidenceLabelFromProb(prob:number): "Strong"|"Moderate"|"Tentative"|"None"
```
Seeded PRNG so Dirichlet draws are reproducible (same run → same package).

## File-level change map

| File | Change | Risk |
|---|---|---|
| `lib/v-stats.ts` | **New.** All estimators above. Pure. | none |
| `lib/v-intelligence.ts` | Replace the `marginPts` buckets (`:119-135`) with `v-stats` calls; keep the **same output field names** (values go from label-only to number+label); `signal_convergence` uses the shared Wilson fn. | med — core logic, but output shape preserved |
| `lib/v-db.ts` (report tally) | Alongside the raw tally, fetch `v_voter_rep` for the run's voters, compute weights + `n_eff`, store **additive** `weighted`/`n_eff` in `v_reports.results`. Raw counting toward `votes_target` **unchanged**. | med — touches report path; additive only |
| `lib/v-readiness.ts` | `decisionReadiness` consumes the real probability + `n_eff` + recommended-n + audience fit (still rule-based, now over honest inputs). | low |
| `lib/v-decision-package.ts` | Bump `DECISION_PACKAGE_VERSION` → `v3`. Additive fields: `win_probability`, `win_probability_ci`, `winner_share_ci`, `top_two_margin_ci`, `effective_sample_size`, `consensus`, `recommended_additional_judgments`. Existing fields kept (label now derived). | low — additive |
| `app/rank/app/tests/[id]/report/page.tsx`, `/r/[token]` | Foreground probability + interval + `n_eff` + consensus in plain language ("87% chance B is genuinely preferred, from 96 effective judgments; ~30 more for 95%"). Always show the interval. | low |
| `app/api/v1/tests/[id]` + export | Surface v3 fields (additive). | low |

**Schema:** no new tables. `v_reports.results` is JSONB → additive. `v_judgments.scores`
(jsonb, already exists) is reserved for future rubric/Likert — unused in Phase 1. Optional
`v_reports.stats_version int` for clarity.

## Validation — how we prove it's honest
1. Unit tests for every `v-stats` fn against known values (Beta/Dirichlet/Wilson/power).
2. **Calibration simulation:** simulate runs with known true *p*; verify the 95% credible
   interval covers truth ≈95% of the time and P(winner #1) is calibrated (reliability
   diagram). This is the artifact that backs "our confidence is defensible."
3. `n_eff ≤ n` invariant test — weighting can never increase the precision claim.

## Build order within B (and the key dependency)
1. `v-stats.ts` (pure, testable) — foundation. **M**
2. Rewrite `v-intelligence.ts` to use it **on raw counts** — kills the fake labels; the
   single biggest honesty win, shippable alone. **M**
3. Readiness + Decision Package v3 + report UI — surface the numbers. **M**
4. Calibration tests. **S-M**
5. Weighted tally + `n_eff` — turn on **after** calibration **and after workstream C**
   (gold-standard/attention checks), because *weighting is only as trustworthy as
   reputation.* **M, gated on C**

**Critical dependency:** honest-confidence (steps 1–4) ships independently and is
immediately valuable. **Weighting (step 5) depends on C** — don't weight by a reputation
you can't yet trust. Total B ≈ **L**.

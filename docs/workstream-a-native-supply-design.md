# Workstream A — Native Supply (design, SHELVED)

_Status: **DESIGNED, NOT BUILT.** Do not implement until a demand signal exists — one
real person saying "I want a QA report." This is the founder's explicit demand-first
freeze. Ready to implement in a few hours the day a real run needs filling. Companion:
`docs/phase1-b-statistics-design.md` (also shelved)._

## Why frozen
The biggest unknown for Vraelis is not whether the engine works — it's whether anyone
wants a report at all, and that's at zero signal. Building the pool now spins up a live
system where real people read other teams' uploads (real consent / trust / liability
surface) to fill runs that don't exist yet, judged by a pool not yet recruited. An empty
room with the lights on. No engine build reduces the one risk that matters: demand.

**Trigger to unfreeze:** one real person saying "I want a report." Until then, designed
not built.

## Foundation already shipped (turn a gated farm into a real panel)
- `/vote` "Evaluate & Earn" surface — the native evaluator front door (gated off for real
  content today).
- `v_voter_rep` — reputation spine keyed by evaluator (valid/rejected), live in prod.
- Quality gates (time-on-task, IP velocity, dedup, gibberish, reputation, screening).
- Rejection + reputation gating — live (v2 `v_record_vote`).
- PII guard on inbound candidate content — `lib/v-content-policy.ts`.
- Cross-tenant farm gated off — `nextTestForVoter` behind `VRAELIS_COMMUNITY_POOL` +
  `visibility='pool'`.

## Phase A1 — evaluator accounts + real earn loop (build first, on signal)

**1. `v_evaluators`** (extends the reputation spine, same key as `v_voter_rep`):
```
v_evaluators(
  voter_id text primary key,        -- = v_voter_rep.voter_id = v_judgments.voter_id
  status text default 'active',     -- active | paused | banned
  consented_at timestamptz,         -- explicit consent to view others' AI output (gate)
  languages text[], locale text,    -- coarse, for A4 targeting; optional
  demographics jsonb,               -- optional/coarse, future targeting
  created_at, updated_at
)
```
Identity is already Google-verified at sign-in; no new PII beyond auth. Join
`v_evaluators ⋈ v_voter_rep` for identity + reputation.

**2. Points ledger (separate from buyer credits — hard guardrail):**
```
v_evaluator_points(id, voter_id, delta int, reason, ref_judgment_id unique,
                   ref_test_id, created_at)   -- append-only; balance = sum(delta)
```
Award N points on a **valid** judgment only (rejected earns nothing — reuse the verdict
from `v_record_vote`); idempotent per judgment. Do NOT reuse `v_credit_ledger` (buyer
money path). Cash-out is A2.

**3. Real judging queue** — repurpose `nextTestForVoter` → `nextTestForEvaluator(voterId)`:
- Evaluator must be `status='active'`, `consented_at` set, pass a reputation floor
  (probation for new ones).
- Serve `is_sandbox=false` runs still needing judgments, not owned / not already judged by
  them.
- **Cross-tenant exposure cap:** limit distinct customer owners one evaluator sees per
  window (derive from `v_judgments` owners); stop serving past the cap.
- PII guard already covers inbound content at submission, so what's served is pre-filtered.

**4. Consent + exposure (safety layer):**
- First real task → consent screen ("you'll review AI-generated content from other teams,
  quality-filtered for personal data"), store `consented_at`. No consent → no real runs.
- Reputation gating stays authoritative; rejected judgments never pay points.

**Files:** new SQL migration (`v_evaluators`, `v_evaluator_points`); `lib/v-evaluators.ts`
(identity/consent/points/exposure); `lib/v-db.ts` (`nextTestForVoter` → gated real-run
selection + points hook); `app/api/v/vote/route.ts` + `/next` (consent gate, exposure
check, points award); `app/rank/vote/page.tsx` (consent + judging UI). **Untouched:** buyer
billing / auth / credits / money path.

**What A1 buys:** for the first time, a submitted real run is fillable by your own
consented, reputation-gated people — points, not cash.

## Phase A2 — rewards / cash-out
Points → gift card / cash at a threshold via an owned payout rail. Start gift-card (fewer
tax/fraud headaches; 1099 over $600/yr). Anti-fraud at cash-out: reputation floor, identity
check, per-person caps.

## Phase A3 — recruitment / seed (ops + light code)
Seed 20–50 evaluators manually (students, microtask communities, networks). `/vote` becomes
the "get paid to judge AI" recruitment landing surface.

## Phase A4 — routing & targeting (later)
Make the stored `Audience` field actually route runs to evaluator segments — replaces FIFO;
lets you charge more than a generic panel.

## Guardrails (all phases)
- PII guard stays on inbound candidate content.
- Consent + cross-tenant exposure limits before serving real customer content to the pool.
- Reputation/quality gates authoritative; rejected judgments never pay.
- Never touch buyer billing / auth / credits / the money path (evaluator points ≠ buyer
  credits; separate ledger).

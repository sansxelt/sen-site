# Vraelis demo runbook — the real fixture, the real product, real evidence

Purpose: a repeatable demonstration that a stranger can watch and understand — a broken AI-built app
becomes an evidence-backed READY through the SAME public product a customer uses. No injected decisions,
no fake evidence, no seed drivers in the recorded demo: every screenshot and decision comes from the real
production worker driving a real browser.

> STATUS (2026-07-14): the demo INFRASTRUCTURE is complete and deployed (Command Center, evidence-first
> report with issue lineage, native repair loop with REPAIR VERIFIED visibly distinct from READY). The
> fixture app + its three modes exist. Recording the demo is **gated on one real S6 canary run** — the live
> worker/Browserbase chain producing a real decision. Do NOT fabricate the recording; run it for real once
> S6 is PASS.
>
> NO $15 REQUIRED. The canary runs on the account's **lifetime free Production Pass** ($0). Verified from
> code: a free pass hits the SAME createRun -> same worker -> same real browser as a paid pass (the payment
> mode only changes the hold/charge branch, not the run). The credit/charging flow was verified separately
> and is done; a paid PAYG pass is a later, optional 30-second check, not a launch gate.

## The fixture (deterministic, already built)

`fixtures/preflight-demo` (static Vercel app) serves three deterministic modes via `?mode=`:

| Mode | The app's behavior | The honest Vraelis decision |
|---|---|---|
| `?mode=broken` | Create-project works, but the created project is LOST on refresh; the mobile nav overlay blocks the primary action | **BLOCKED** — persistence + mobile critical flows fail, with screenshots |
| `?mode=partially_fixed` | Persistence is fixed; mobile nav is still broken | Rerun the persistence flow → **REPAIR VERIFIED** (that flow only). Full critical verification still shows the mobile blocker → not yet READY |
| `?mode=fixed` | Both fixed | Full critical verification passes → **READY** |

The approved contract (3 requirements / 3 flows): *create a project*, *created projects persist after
refresh*, *mobile navigation must not block the primary action*.

## Operator preconditions (once, before recording)

1. S6 canary is PASS (one real pass verified end-to-end on the FREE pass; no leaks; pre-billing block proven).
2. `fixtures/preflight-demo` deployed to Vercel (preview is fine) — see docs/preflight-activation.md.
3. A demo account with its **lifetime free Production Pass available** (no payment needed). A funded balance is optional — only if you also want to sanity-check a PAYG pass, which is not required for S6.
4. The worker is live and healthy (Railway: `worker_start`, `browserbaseConfigured=true`).

Everything below is driven through the PUBLIC product UI (app.vraelis.com) — never the seed driver.

---

## The 15-second FocuSee journey — "broken → the decision"

The hook: an AI-built app that looks done, isn't, and Vraelis proves it in one pass.

| t | On screen | Action |
|---|---|---|
| 0–3s | The connected fixture app on the **Application Command Center**, verdict tone neutral, one dominant action: **Run a Production Pass** | Click it |
| 3–10s | The run report streaming: real browser, real steps | (let it run to a decision) |
| 10–15s | **BLOCKED** in its red tone, the blocker with **expected vs observed** and a **real screenshot** of the lost project | Hold on the evidence |

The point landed in 15s: *Vraelis ran your real critical journeys in a real browser and caught a launch
blocker your users would have hit.* End on the screenshot — the evidence is the product.

## The 45-second FocuSee journey — "broken → repair → READY"

The full loop, the recurring reason to return.

| t | On screen | Action |
|---|---|---|
| 0–6s | Command Center → **Run a Production Pass** on `?mode=broken` | Launch |
| 6–14s | Report resolves **BLOCKED**: persistence blocker (project lost on refresh) + mobile blocker, each with expected/observed + screenshot; each shows **First seen here** | Scan the two blockers |
| 14–20s | On the persistence blocker, click **Copy repair prompt** — the grounded brief the builder pastes into their AI tool | Copy |
| 20–26s | (Builder deploys the persistence fix → the app is now `?mode=partially_fixed`.) Back on the report, **Rerun failed flows** | Rerun the affected flow |
| 26–32s | **REPAIR VERIFIED** in its distinct teal tint (NOT the READY green): the persistence flow passed; copy states full critical verification is still required | Note the honest distinction |
| 32–38s | **Run full critical verification** — mobile nav is still broken (`partially_fixed`), so it comes back with the mobile blocker still open (now **Recurring**) | See the standing issue |
| 38–45s | (Builder fixes mobile → `?mode=fixed`.) Full critical verification → **READY** in the solid green: every critical flow held | End on READY |

The point landed in 45s: *connect once, and Vraelis turns broken AI output into an evidence-backed READY —
and tells you the difference between "the one thing you fixed works" (REPAIR VERIFIED) and "cleared to
launch" (READY).*

---

## What makes it honest (do not shortcut)

- Every decision (BLOCKED / REPAIR VERIFIED / READY) comes from the real worker claiming the run off the
  same Postgres queue and driving the same Browserbase browser a customer's run uses.
- Every screenshot is a real artifact from that run, loaded through the owner-checked artifacts route.
- REPAIR VERIFIED is shown in its own provisional tint so it is never mistaken for launch-cleared READY.
- Issue lineage (First seen here vs Recurring) is read from the real `first_seen_run`, so the standing
  mobile blocker genuinely reads as Recurring on the second pass.
- No `PREFLIGHT_SEED_RUN` driver, no injected decision, no hand-placed evidence in the recording.

## Recording checklist

- [ ] Record at a fixed viewport; do the mobile-blocker beat at the narrow viewport where the defect lives.
- [ ] Two takes: the 15s hook and the 45s loop, from the same account, same fixture.
- [ ] Confirm the free pass is consumed correctly on the first real launch (entitlement moves to used); no charge on the free pass.
- [ ] Keep the founder account out of it — use the demo account.

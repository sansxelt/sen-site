# Current product gaps

Written 2026-07-27. Scope: the ACTIVE product only. No git history, no retired directories, no old
directions.

**How to read this.** Two sweeps ran (19 agents over 30 areas, 16 agents over surface parity), plus my own
live testing against production. Findings are split by whether **I personally verified them**. That
distinction matters more than the severity label: an unverified claim can be wrong, and acting on a wrong
one can break working code.

---

## A. Verified by me, and fixed today

Each of these I reproduced myself before changing anything, and each has a regression guard that a mutation
proves can fail.

| # | Defect | Where |
|---|---|---|
| A1 | **A raw NUL byte made every human approval unwritable.** The separator in `requirementReviewIdentity` was the byte itself. Postgres text cannot store NUL, so every insert carrying a `review_identity` failed. Production: 153 requirement rows, **0** with an identity. The reviewed-approval write path had never once succeeded. | `lib/preflight/contract-merge.ts` |
| A2 | **The error was discarded.** `insertRequirement` read only `data`, so A1 surfaced as `claim_not_testable` — blaming the customer's wording for a control character of ours. | `lib/v-applications.ts` |
| A3 | **Approval was unreachable.** `findLivePendingPlanForClaim` filtered `.eq("guarantee_id", null)`, which PostgREST renders as `eq.null` and matches nothing; two callers also omitted the id. No guarantee could ever be approved. | `lib/preflight/reviewed-plan-db.ts` + 2 callers |
| A4 | **Nothing could launch a guarantee-bound run.** Every `createRun` caller passed `guarantee: null`. `guaranteeRunHistory` filtered on a column no caller wrote, so every guarantee read "Never verified" forever. | new verify route |
| A5 | **The click resolver only ever built `getByRole("button")`** while reporting three candidates it never tried. Anchors styled as buttons were unreachable; three "critical failures" in the demo account were ours. | `worker/preflight/providers/browserbase.ts` |
| A6 | **Filling shared the click resolver**, so a missed label called `.fill()` on a button and waited 30s for a button named "email". | same |
| A7 | **A guard that could never fail**: `!/\bupdate\s+v_/` had literal backspaces instead of word boundaries. Plus 23 order assertions of the form `indexOf(a) < indexOf(b)`, which pass precisely when `a` is deleted. | `scripts/` |
| A8 | **`hold()` reported success on a failed debit**, and `refund()` would then mint credits from rows that never existed. | `lib/v-credits.ts` |
| A9 | **A false failure counted as customer health.** Now invalidatable without rewriting the verdict (migration 24). | `lib/preflight/target-url.ts` |

---

## B. Verified by me, still open

| # | Gap | Impact |
|---|---|---|
| B1 | **First "Derive proof plan" click returns 500** (`INTERNAL_FUNCTION_INVOCATION_FAILED`) *after* successfully minting the plan. A second click succeeds via reuse. The user sees an error on a step that worked. | Demo blocker |
| B2 | **The coverage gate runs on two paths only** (public API, guarantee prepare). Console launch and rerun skip it entirely. The boundary ratchet records this as a known defect. | Core |
| B3 | **PAYG cent balance has no minting path.** Pass pricing prices launches in cents; I hit `insufficient_balance` at $15.00 with a 640-cent balance and no way to top up in cents. Resolved for the demo by comping a plan, not by fixing the path. | Core |
| B4 | **The comped plan has no Stripe subscription.** I wrote `plan_v1 = scale_v1` directly. Billing surfaces may disagree with reality. | Info |
| B5 | **Two cancelled runs render as "Blocked"** on the system row rather than as cancelled. Honest per the mapper, misleading to a reader. | Later |
| B6 | **`/v1` imports the dashboard route's POST handler.** One route handler is another's backend. | Core |
| B7 | **Escrow stranded by a killed inline API run** has no sweeper. | Core |
| B8 | **Per-journey overcharge**: the hold prices *requested* journeys, `createRun` may shrink the set, the worker keeps the full hold. Needs your decision: charge for what ran, or refuse the launch. | Founder decision |

---

## C. Reported by the sweeps, NOT yet verified by me

**Treat every line here as a lead, not a fact.** Three of the sweep's claims I checked personally turned out
to be wrong (the decision mapper being "inverted", two cancelled runs being verifier defects, a duplicate
read I had written myself). Verify before acting.

### C1. False Verified — the highest-risk cluster
Four surfaces are reported to map `repair_verified` to a green **Verified**, contradicting
`toPublicDecision`, which maps it to Blocked: `runPill`, `verdictPill` (drives 5 render sites), the
account-wide Deployments page, and the API-runtime verdict map. Also claimed: both API-run read routes
compute the verdict from `decision` alone and ignore `state`, so a non-completed run can read as decided.

*If any of this is true it is the most damaging thing on the list — it is the product saying Verified when it
should not.* Check this first.

### C2. Human review that no human gave
- An API key can approve the plan it caused to be minted, and the run then reports `human_reviewed: true`.
- Reviewed-plan approval is scoped to the caller's own email rather than the application's team.

### C3. Worker resilience
- A run that reaches `analyzing` and loses its worker is never reaped: escrow never released, counts against the owner's cap forever.
- Browserbase session auto-ends at 600s while the run budget is 900s.
- SIGTERM grace is 30s against a 900s budget, so a routine redeploy hard-kills in-flight runs.
- `finalizeRun`/`failRun`/`setState` carry no lease-ownership filter, so a reaped worker can still overwrite.
- A requeued run appends a second set of flow rows; the decision comes from the last attempt only.
- Provider/infra failure mid-flow is published as a customer application defect.

### C4. Coverage gate quality
- `checkClaimCoverage` matches the claim's named value by raw substring.
- It returns ok for an **empty** requirement list.
- The value the execution gate demands is chosen by lexicon order, not by the claim.
- `prepareVerification` refuses only if *every* requirement or *every* flow failed, so a partial write can stand.

### C5. Tenancy
- The per-application Team tab invites people into the owner's personal workspace.
- `client_viewer` is refused by every API route but rendered on every internal page.
- Verifications, Records, Issues, Repairs, Deployments are scoped to the caller's email rather than the team.

### C6. Surfaces that do not complete
- `v_repairs` has **no writer** anywhere active, so the Repairs page and tab are permanently empty.
- The CLI cannot obtain a verification id against the shipped API; every invocation is claimed to fail.
- `POST /v1/verifications` returns `review_required` and no longer starts a verification, though /developers documents it as doing so.
- The Composer's "Open the record" goes to the list, not the record.
- "+ New verification" is a plain link to `/app`.
- A rerun that still fails renders an empty record.

### C7. Commercial copy contradictions
- `/credits` says **$10 per verification**; `/plans`, `/pricing` and the actual charge say **$15.00**.
- The Account page says "Monthly plans are coming" while the Plans page sells three.
- "Cancel subscription" looks the subscription up in `v_subscriptions`, which the `_v1` path never writes.
- A paying `_v1` subscriber reads as "Free plan" wherever `getPlan` is used.
- `POST /api/v/subscribe` neither checks a legacy subscription nor `isBillingFrozen`.

### C8. Visibility flags
- `STEALTH_MODE=1` curtains every marketing and product page including sign-in.
- The v6 public site is gated behind `NEXT_PUBLIC_VRAELIS_V6_PUBLIC`, reported absent in production.

---

## Ranked: what to do next

**Updated 2026-07-27, after the demo push.** What changed is recorded in section D below rather than by
editing the sections above, so the original assessment stays readable next to what it turned out to be.

**Before external users**
1. B2 — coverage gate on every launch path (console launch and rerun still skip it).
2. C2 — `human_reviewed` without a human.
3. C3 — worker resilience. No longer theoretical: run d6be46e0 was claimed by two workers during a
   redeploy, executed its flows twice, and lost its lease. Both halves of the C3 claim were observed.
4. C6 — the CLI and `/v1` create.
5. B1 — the 500 on first derive.

**Can wait**
6. C5 tenancy polish, B5, B4.

---

## D. What today changed, and what it cost to find out

**The Verified baseline exists.** Run `5dc7f28e`, decision `ready`, guarantee `grt_c8110fd1`, plan version 5,
hash `741ff923…`, reviewed plan `rvp_bdd07789`, contract `baef7f93`, no parent. The run's plan hash equals the
guarantee's approved hash, so the evidence speaks to the live definition.

### D1. C1 was half true, and the true half is fixed

`passes/page.tsx` runPill and `deployments/page.tsx` verdictPill both mapped `repair_verified` to a green
**Verified** while `toPublicDecision`, and therefore the API, the webhooks and the CI gate, called the same
run blocked. Both also ignored `state`. Both now defer to the shared mapper, with 12 assertions holding it.

The rest of the C1 claim was wrong: the third runPill already delegated correctly, and the API-runtime maps
use a distinct `REPAIR VERIFIED` label rather than claiming Verified. Checking each is the only reason the
third one still works.

### D2. Seven defects, one shape

Every one made Vraelis report working software as broken. None was visible in code review; each was decided
in under a second by a browser.

| what we got wrong | commit |
|---|---|
| looked for the session in cookies only, ignoring web storage | `415e3b69` |
| asked whether the app was signed in 53ms after clicking submit | `d69558b7` |
| looked for a control before the page had painted | `8a0b3579` |
| treated an accessible name as text nodes only, so a placeholder-named field was "missing" | `8a0b3579` |
| read the URL before the navigation happened | `b2ab1d70` |
| read text before it was rendered | `b2ab1d70` |
| planned from an empty product context, so signed-in claims were planned off the marketing page | `473dd287` |

`assert_url` is the clearest proof of the class: the same step passed in 0ms on one run and failed as
`url_mismatch` on the next, same plan, same application.

### D3. The generator writes plans that cannot pass

Six generated plans in a row were unrunnable: clicking an `<h2>` as a button, asserting text no element has,
opening a gated page before signing in, asserting a note is still present after deleting it, starting a flow
with `sign_in_as` on a blank page. Field contracts, the runner's actual behaviour and the absence of any
"assert absent" action are now stated in the synthesis prompt.

**`ops/plan-rehearse.ts` is the durable answer**: it executes every step of every flow against the live
deployment and refuses to mint a plan that cannot pass. It belongs in the product, as a dry-run stage between
prepare and approve.

**Still open, and it is a false-Verified risk**: a plan asserts a FIXED value it wrote, so a record left by an
earlier run satisfies the assertion on its own. A run against an application that had stopped saving would
come back Verified. `ops/demo-reset-notes.ts` is a workaround. The fix is a per-run unique value, or plans
that clean up after themselves.

### D4. Billing, verified live rather than read

All three plans mint a real Stripe session (`cs_live_`, HTTP 200). The credits top-up renders a live Payment
Element for an arbitrary amount. A second plan is correctly refused.

Two things were wrong and are fixed: `/credits` advertised **$10 per verification** while every charging path
takes **$15** (the figure is computed from the catalog now), and the public pricing page listed three plans
with **no way to buy any of them**. C7's "$10 vs $15" was real.

Plan naming disagreed four ways for one account (`Scale_v1` / `Scale` / `Free plan` / `Free`). One function
now, 27 behavioural assertions.

### D5. Mobile

The console drawer was **63px tall** on a phone, clipping 852px of content, so "Sign out" and "Back to site"
could not be tapped: a `backdrop-filter` on the top bar made it the containing block for the drawer's
`position: fixed`. All seven `/docs/*` pages had the same class of bug from `animation: … both`, whose filled
transform keyframe computes to `matrix(1,0,0,1,0,0)` rather than `none`. Both verified fixed on production.

`/developers` reports 73 elements wider than the viewport and is **correct** — they sit inside a `<pre>` with
`overflow-x: auto`. Nearly "fixed" it.

---

## Is this exhaustive?

**No.** Sections A to C were the union of two sweeps and a day of live testing. Section D is one more day,
and its main finding is about method rather than any single defect: **everything that mattered was found by
establishing the deployment's real behaviour by hand first, then asking of each step whether it could pass.**
Nothing found these from the inside. The plans validated, the coverage gate passed, and the runs would have
said Failed with a straight face.

**Confidence:** high on A, B and D (each reproduced, each guarded, each guard mutation-tested). C is still
single-agent claims except C1 and C7, which are now checked; C1 was half wrong and C7 was right.

**What is still unverified:** Railway's running commit was never confirmed directly — no CLI, no token, and
`/health` carries no build id, so every statement about the worker is inferred from run behaviour. The
aggregate test runner cannot complete on Windows (a libuv teardown crash at suite 12, pre-existing); the 80
suites are run individually instead. `preflight-coverage-correction-verify.ts` fails 5/35 on a clean tree and
is excluded from the runner as "calls a live model", so nobody sees it.

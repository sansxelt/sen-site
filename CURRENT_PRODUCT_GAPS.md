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

**Before the YC demo**
1. C1 — false Verified. Verify the four `repair_verified` mappings yourself; this is the product's core claim.
2. B1 — the 500 on first derive.
3. Finish the guarantee lifecycle (needs the Railway redeploy).

**Before external users**
4. B2 — coverage gate on every launch path.
5. C2 — `human_reviewed` without a human.
6. C3 — worker resilience, particularly the un-reaped `analyzing` state and stranded escrow.
7. C6 — the CLI and `/v1` create.
8. C7 — the $10 vs $15 contradiction.

**Can wait**
9. C5 tenancy polish, B5, B4.

---

## Is this exhaustive?

**No, and I would not claim it.** It is the union of two broad sweeps and a day of live testing, which is
enough to say the *shape* of the risk is now known: the dangerous concentration is in decision truth
(C1, C2) and worker resilience (C3), not in missing features.

**Confidence:** high on section A (reproduced and guarded), high on B (I hit each one myself), **low to
medium on C** — those are single-agent claims and the refutation stage returned no verdicts, so nothing in C
has been adversarially checked.

**What I could not verify:** anything requiring Railway access, Lovable access, Stripe dashboard state, or a
paid run beyond the one I executed. The claims in C7 about live pricing pages and C8 about production env
vars need a look at the deployed environment, not the source.

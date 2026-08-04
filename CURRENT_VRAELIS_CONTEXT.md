# Vraelis — current source of truth

Written 2026-07-27, refreshed 2026-08-03 against HEAD. Stale docs, retired product generations and old
landing copy are deliberately excluded. Where something does not work, it says so.

**What the refresh changed.** 89 commits landed between the two dates and the document had drifted in the
direction that flatters: the two gaps it ranked first and second are closed, and it still described the
central object as inert. Corrected below. One thing it ranked as fixed is not — the coverage gate still
does not sit under every launch entrance — and that is now stated where it belongs rather than left
implied by a sentence about the acceptance service.

**What could not be re-measured.** Every production COUNT in this document (systems, runs, guarantees,
payments) was measured on 2026-07-27/28 and is carried forward unchanged, because this pass had no
database access. They are labelled where they appear. Do not quote them as current without re-running
`scripts/preflight-launch-readiness.ts`. Nothing about external customers or revenue changed, and no
count below is revised upward.

---

## 1. What Vraelis is

**The problem.** Software is increasingly written and changed by AI. The agent that writes the code also
reports whether it worked, and it reports success by default. A team ships a change, the agent says it is
done, and nobody finds out that customers lost access to what they paid for until a customer says so.

**The customer.** A company whose product is built or substantially modified by AI coding agents, and which
has at least one outcome it cannot afford to break — a customer keeps the plan they paid for, an invite
grants access, cancellation stops renewal.

**What the customer provides.** A deployed URL, and a sentence describing an outcome that must be true.
Optionally, credentials for a test account so authenticated journeys can run.

**What Vraelis does.** It turns that sentence into concrete requirements and browser journeys, shows them
to a person for approval, then drives a real browser against the real deployment and records what actually
happened.

**What the customer receives.** A decision — Verified, Failed, or Blocked — with the evidence behind it:
per-journey results, the step where it broke, expected versus observed, screenshots, and on failure a repair
prompt written for a coding agent.

**Why independence matters.** The value is entirely in not being the thing that wrote the code. An agent
grading its own work is a self-report. Vraelis has no access to the repository, forms no opinion about the
implementation, and only reports what a browser could observe from outside. That is also why it must never
become an "AI testing agent" — the moment the verifier is another agent trusted on its word, the product is
gone.

---

## 2. What currently works

**Systems — Working.** A customer connects a deployment (`v_applications`). 6 exist in production.
Member-scoped: a teammate sees systems shared with them and nothing else.

**Guarantees — Working, and no longer inert.** The durable object exists end to end in code: create,
derive a plan, human approval, status derivation, a detail page, and a cross-system list at `/guarantees`.
The run-to-guarantee binding is now **compulsory at the type level**: `CreateRunInput.guarantee` is a
required field rather than an optional one, so "this is a plain verification" is a null somebody wrote down
instead of a field four callers forgot. A run pins the triple (id, plan version, plan hash) plus the
reviewed-plan id, copied at insert and never re-resolved.

A Verified baseline exists: run `5dc7f28e`, guarantee `grt_c8110fd1`, plan version 5, hash `741ff923…`,
whose pinned hash equals the guarantee's approved hash, so the evidence speaks to the live definition.
*Recorded 2026-07-28; not re-measured in this pass.*

**Requirements — Working.** Derived from the claim, stored per contract, and carrying provenance for who
authored and who approved them.

**Browser plans — Working.** A claim becomes an immutable reviewed plan (`v_reviewed_plans`): exact
requirements, exact journeys, an immutable `plan_hash`, a coverage verdict, and a 60-minute expiry.

**Human review — Working.** Approval is a distinct, durable, audited event. A paid run refuses a plan that
has not passed through it. There is now a Review queue and a per-plan review page, and a plan that defines a
guarantee can only be approved by a signed-in person — an API key is refused.

**Browser execution — Working.** A worker drives a real browser (Browserbase) against the deployment, with
provider-error classification, cost governance, concurrency and daily caps.

**Evidence and screenshots — Working.** Artifacts land in a private Supabase bucket and are served through
short-lived signed URLs, owner-checked. Per-journey step lists record where a flow broke.

**Expected versus observed — Working.** Issues carry expected, observed, reproduction steps and severity.

**Decisions — Working.** One canonical translator (`toPublicDecision`) maps internal state to Verified /
Failed / Blocked everywhere. A recently-fixed defect had `/verifications` rendering `repair_verified` as a
green "Verified" while the rest of the product called it Blocked — a false Verified in the company's own
console. Every surface now goes through the one function.

**Records — Working with limitations.** `/records` is an append-only audit trail. The verification events
were only just added to its label map; before that it showed workspace and billing governance and nothing
Vraelis had proved.

**Repair instructions — Working. Repair tasks — schema only, and the surface is now hidden.** A failure
produces a repair prompt, written onto the issue (`v_issues.repair_prompt`) and rendered as the repair
handoff on the report. `v_repairs` is a durable record in schema with `fix_prompt`, `suggested_files`,
`patch`, a linked verification run and a status enum, but **nothing in the codebase writes it**: it is read
in three places and inserted by none. Both Repairs surfaces therefore rendered empty on every account that
has ever existed, so as of 2026-08-03 they are gated behind `VRAELIS_REPAIRS_SURFACE` (off) and 404. Nothing
was deleted; the pages, the reads and the tab constant are intact and re-enabling is that one variable.
**The customer applies the repair themselves.** Nothing is sent anywhere.

**Reruns and reverification — Working, manually.** A rerun re-executes the same contract, records
`parent_run_id` lineage, and can target only the failed journeys. It is user-initiated.

**API — Working with limitations.** `POST /v1/verifications` (dry run → mint plan → approve → paid
execution), `GET /v1/verifications/{id}`, and plan read/approve. Results now carry `guarantee_id`,
`reviewed_plan_id`, the reverification link and a console URL. An internal canary has passed; an external
third-party customer path has not been completed.

**CLI — Working, packaged, still unpublished.** `cli/vraelis.mjs`: commands `verify`, `login`, `logout`,
`status`, plus `--wait`, `--json`, `--repair-prompt`, `--idempotency-key`, and exit codes 0/1/2 mapped to
Verified/Failed/Blocked. `private: true` is gone and the package is publish-ready — correct `bin`, shebang,
`files`, `publishConfig.access: public`, and a clean 3-file 13.1 kB tarball. **The name `vraelis` is still
unclaimed on the npm registry** (404 as of 2026-08-03), so it runs from the repo until someone with npm
credentials runs `npm publish`. The console docs deliberately do not yet claim an npm install, and
`scripts/cli-verify-test.mjs` asserts both halves so the claim can only appear once it is true.

**Console — Working.** `app.vraelis.com`. Navigation states the product model: Overview, Systems,
Guarantees, Verifications, Review, Records, then Integrations and Developers, then settings. Command bar,
per-key usage and limits, dense record tables.

**Organizations and teams — Working.** Workspaces, roles (owner/admin/editor/viewer/client_viewer),
domain-verified organizations, SSO, and owner-anchored billing: a teammate's run spends the owner's credits.

**Billing and credits — Working.** Live Stripe. Plans and credit top-ups, both on an in-app checkout
(Payment Element) rather than a redirect. Credits = dollars × 10, so a $15 pass is 150 credits. Escrow
model: credits are held before a run and settled or refunded after.

The ledger is dual-unit and **only the `credit` unit is spendable**. PAYG is priced in cents and escrowed
in credits, converting at `CENTS_PER_CREDIT = 10`; leftover `unit='cent'` rows are legacy and must never be
summed into a balance. Two separate defects came from reading the wrong denomination — the launch-readiness
tool judging affordability in cents, and the lifecycle emails summing both units into one number — so any
new balance read goes through `balance()` or `balances()` in `lib/v-credits.ts` and never reimplements the
rule.

Under pass pricing, signup mints **no** credits: `ensureSignupGrant` returns early and the free tier is
`FREE_TIER.lifetimePasses = 1` (3 flows), enforced by `gatePassLaunch` rather than by a balance. The old
"25 signup credits, 1 credit = 1 check" model is retired everywhere.

**Lifecycle email — Working.** A daily cron (`/api/cron/lifecycle`, 15:00) runs three once-ever nudges:
activation, low balance, win-back. All three read `v_preflight_runs`; they used to read the retired
`v_checks`, which answered empty for everybody and silently disabled two of the three stages.

**Integrations — Working with limitations.** Account-level OAuth for GitHub, Vercel, Sentry, Stripe and
Supabase; per-application Slack, webhooks, custom deploy/auth, OpenAPI and test accounts. Vercel can supply
the current deployment URL at launch. Signed `verification.completed` webhooks fire on completion.

**Public site — Working, behind a curtain.** The design-06 site is live but `STEALTH_MODE` is on, so every
route serves a stealth screen and is `noindex`. A reviewer link (`/yc?k=…`) opens it.

---

## 3. The real current workflow

### What works today, end to end

1. Sign in, connect a system (a deployed URL).
2. On the Overview, name the deployment and the outcome that must be true.
3. Vraelis crawls, derives requirements and browser journeys, and runs a coverage gate that refuses to
   charge for a plan that could not prove the claim.
4. The plan is shown for approval. Reviewing is free. It has a URL and a queue.
5. On approval, credits are held and a real browser runs the journeys against the deployment.
6. A decision comes back — Verified, Failed or Blocked — with per-journey evidence, screenshots, expected
   versus observed, and on failure a repair prompt.
7. The customer copies the repair prompt into their own coding agent and fixes the code.
8. The customer redeploys, then **manually** triggers a rerun, which re-executes the same contract and
   records that it repairs the earlier run.
9. Everything is retained: the failure, the repair record and the reverification.

That loop is real and has been closed end to end against a live application, including payment.

### The loop being built toward

The same, except step 2 creates or selects a **durable guarantee**; the approved plan is frozen onto it;
every run is bound to that guarantee and the exact approved meaning; the repair is dispatched as a scoped
task to a connected coding agent; the repaired deployment is detected; reverification is triggered
automatically against the same guarantee; and the guarantee accumulates a permanent, versioned proof
history.

**The difference is not cosmetic.** Today a verification answers a question once. The guarantee is what
makes it a standing promise that survives deployments.

---

## 4. What is actively being built or fixed

**Binding verifications to guarantees — done.** `createRun()` accepted a `guaranteeId` and **no caller ever
passed it**, so `v_preflight_runs.guarantee_id` was never written: 0 of 29 runs. A guarantee could be
created, planned and human-approved and then never become proven. `CreateRunInput.guarantee` is now a
required field carrying the full binding, the compiler enforces it at every caller, and a Verified baseline
exists against a live application. Migration 23 is applied. An optional field was an invitation to forget;
a required one makes the null a decision.

**Preserving reviewed-plan lineage — done.** A run pins a *triple*: `guarantee_id`, `plan_version` and
`plan_hash`. The id alone is not an identity, because approval overwrites the guarantee's plan in place with
no version history — so one re-approval would silently restate every historical verdict. Comparing the
pinned hash against the live one tells you whether old evidence still speaks to the current definition;
where it does not, the run stays in the history and stops counting toward the live verdict. A reviewed plan
also now records which guarantee it defines, so a guarantee's plan and a plain verification of the same
sentence are no longer the same row.

**Approval producing something runnable — done.** Approval materialises the plan into a frozen contract
marked `kind='guarantee'`, so reverification is execution of a fixed artifact rather than a fresh synthesis.

**The acceptance service — built.** `lib/preflight/acceptance/accept-run.ts` is the one place a run is
admitted, paid for and queued: the same eleven gates in the same order, with HTTP lifted out, taking plain
arguments and returning a discriminated union. Every refusal code and message is the one that shipped, byte
for byte, because a refactor that quietly renames an error breaks somebody's CI. `createRun` now has exactly
two callers repo-wide (this module and the rerun route), and the boundary suite fails the build if a third
appears.

**Verifying an existing guarantee — done.** `POST /api/preflight/apps/[id]/guarantees/[gid]/verify` exists
and goes through the acceptance service. This was the "one missing link" the previous revision described as
deliberately blocked; the ratchet that blocked it was satisfied by building the service rather than by
working around it.

**The coverage gate below every entrance — done.** The acceptance service moved run creation and the money
path and left the gate behind; for one revision the console launch and the rerun evaluated coverage nowhere,
so the product's defining refusal was absent from every path a human takes and present only on the API
surface nobody was using yet. It now runs on all of them.

The move turned on separating two gates that share a name. `resolveCoverage` is the **corrective** resolver:
it needs a fresh synthesis and page snapshots, calls a model up to twice, can trigger a recrawl and can take
300s. It belongs where a plan is *built*, and it stays on the API route and the guarantee-prepare route.
`coverageReport` is the **deterministic** gate: pure, synchronous, no model, no network. That is the one
that moved, into `lib/preflight/acceptance/launch-coverage.ts`, below every launch entrance and above every
credit hold and free-pass claim. `lib/preflight/reviewed-plan.ts` had already made exactly this distinction
for stored plans; this applies it to a stored contract.

It is scored on **the flows the run will execute** — the selected ids intersected with the same
enabled-and-approved predicate `createRun` re-reads with — because a gate that passed on the strength of a
journey nobody selected would be worse than no gate at all.

**The one hole that remains, named rather than hidden.** A contract with no outcome sentence cannot be
gated: there is no proposition to test the plan against. It is not treated as a pass — the gate returns a
third state and the launch is recorded as ungated in the event log, so the size of the hole is measurable
rather than arguable. Feeding a blank claim into the gate instead would NOT have failed open:
`checkExecutionCoverage` applies a fallback contract demanding an assertion after a persistence boundary, so
"" would have refused most legitimate contracts. The fix is upstream, requiring the outcome when a system is
connected, not in the gate.

**Money-path defects found while tracing — two fixed, two open.** Fixed: a credit hold that reported
success when its ledger debit failed (which could both give free runs and *mint* credits on refund), and a
boundary guard that watched one function name and so could not see a fourth entrance taking real holds.
Open, and both needing a decision: holds are priced per requested journey but the run may execute fewer and
is charged the full amount; and the inline API entrance can strand escrow if its function is killed
mid-run.

**Decision consistency — fixed.** Described in section 2.

**Demo readiness — done, and it took a day to find out why.** `demo@vraelis.com` was seeded with a system,
a guarantee, an approved plan and a Verified baseline. The seeded demo then came back BLOCKED: the demo
deployment rate-limits repeated sign-ins, four of five flows sign in, and across six runs the third and
fourth sign-in failed after hanging 22-23s where a pass takes 2-6s. That is the demo app's rate limiter and
not a defect Vraelis found, but the hero said BLOCKED either way. Two flows are disabled (not deleted, so
history and issue links survive), leaving three selectable with both criticals covered.

A related class was worth more than the fix: seven defects, all of which made Vraelis report working
software as broken, none visible in code review, each decided in under a second by a browser. And six
generated plans in a row were unrunnable. `ops/plan-rehearse.ts` executes every step against the live
deployment and refuses to mint a plan that cannot pass; it belongs in the product as a dry-run stage
between prepare and approve, and is not there yet.

**A launch gate on the deployment URL — added.** A run against a mistyped host (`…loveable.app`, one
letter off, DNS answers in 45ms) queued anyway, drove a browser at nothing, returned BLOCKED and kept the
$15. Worse on the free tier, where the same typo spends the one lifetime pass. The gate asks only whether
the hostname resolves and fails **open** on everything ambiguous, because a gate that can refuse a paying
customer over a bad second is worse than the bug it prevents.

**Website accuracy — partially done.** The site is design-06 and coherent, but stealthed.

---

## 5. Current business

**Target customer.** Companies shipping AI-built or AI-modified software with at least one revenue-critical
outcome. Not QA teams.

**Current use case.** Prove a specific business outcome still holds on a specific deployment, and get a
scoped repair when it does not.

**Pricing.** PAYG is $15 per pass covering 5 browser journeys, $3 per additional journey, and a targeted
rerun is $3 per selected failed journey capped at what the comparable full pass would cost. Subscriptions
are Builder $49, Pro $149 and Scale $399 per month (yearly = 10x monthly), metered in flow units rather
than passes so a targeted rerun does not waste a full-pass allowance. Free tier is one lifetime pass of up
to 3 journeys. Credits are escrowed per run and refunded when nothing executed. All live on Stripe.

**Distribution.** Public site (currently curtained), the console, the API and the CLI. A reviewer link
exists for YC.

**Users, customers, revenue.** Production held 6 systems and 29 verification runs at the last measurement
(2026-07-27, not re-measured in this pass), concentrated in the founder's own accounts and a demo account.
The payments that exist are the founder's own test purchases. **There is no evidence in the system of
external paying customers or external revenue, and none should be claimed.** Billing infrastructure being
complete is not traction, and neither is anything in the refresh above: every item closed since 2026-07-27
is engineering, and none of it is a customer.

**Validated commercially:** nothing yet. **Validated technically:** the full Failed → repair →
reverification → Verified loop, against a live application, with real payment.

---

## 6. Current product surfaces

- **Public website** — design-06 marketing site with pricing, method, limitations, research and docs.
  Behind a stealth curtain and `noindex`.
- **Web Console** (`app.vraelis.com`) — the human control plane. Operational state, systems, guarantees,
  verifications, review queue, records, integrations, developers, usage and limits, billing.
- **Public API** (`/v1`) — create a verification (two-step: mint a plan, approve it, then execute), read a
  verification with evidence and repair prompt, read and approve plans. API keys carry scopes and per-key
  daily spend ceilings.
- **CLI** — one `verify` command, JSON output and exit codes for CI. Not published to npm.
- **Browser worker** — claims queued runs, drives Browserbase, writes flows, steps, issues and artifacts,
  and settles the credit hold.
- **Developers area** — key creation with scopes, CI-gate quickstart, CLI documentation, webhooks.
- **GitHub / Vercel / Sentry / Supabase / Stripe** — account-level OAuth connections. Vercel resolves the
  current deployment URL at launch.
- **Slack** — per-application connection, stored and configurable.
- **Coding-agent connections** — **do not exist.** `lib/preflight/agent/` is the *discovery* agent that
  crawls and synthesises plans, not a connection to a customer's coding agent.

---

## 7. Strongest things already built

1. **A real browser verification engine with settlement.** Crawl, synthesis, coverage gate, queued
   execution, evidence capture, decision, credit escrow with refunds, cost governor and caps.
2. **The reviewed-plan contract.** An immutable, hash-bound plan; approval as a separate audited event;
   single-use atomic consumption; execution that runs exactly what was approved.
3. **One canonical decision translator**, now enforced across every surface, plus the discipline that
   found and removed a false Verified in the product's own console.
4. **A coverage gate that refuses to charge** for a plan that could not prove the claim — on the two
   entrances that have it. See the ranked gaps: it is not yet under all four.
5. **Provenance as a first-class concern.** Who authored a requirement versus who approved it, with an
   audited correction of 136 rows that falsely claimed human authorship.
6. **Multi-tenant foundations**: workspaces, roles, org domains, SSO, owner-anchored billing.
7. **A test discipline that catches real defects**, including several in the money path, with mutation
   testing used to prove a guard can actually fail.

---

## 8. Largest remaining gaps, ranked

**Re-ranked 2026-08-03.** The previous first and second entries are closed and are recorded at the bottom
so the change is visible rather than silently absorbed. The new ordering puts commercial validation first,
because the engineering that used to sit above it is done and the thing blocking the company is not.

1. **No external users.** Nothing has been validated with a company that is not us. This was sixth while
   two engineering gaps outranked it; both are closed, and nothing else on this list is a customer. It is
   first now and it will stay first until it is false.
2. **The coverage gate is not under every launch entrance.** The console launch route and the rerun route
   do not evaluate coverage at all, so the product's defining refusal — declining to charge for a claim it
   cannot prove — is absent from the path a console user actually takes. The acceptance service made this
   fixable by giving the gate one place to live; it did not move it.
3. **No coding-agent handoff.** The loop stops at a prompt the customer copies.
4. **No deployment detection and no automatic reverification.** The customer must come back and press a
   button.
5. **The site is curtained**, so nothing is discoverable. `STEALTH_MODE=1`; the homepage is exempt from
   `noindex` so the domain does not leave the index entirely, and `/yc?k=…` is the reviewer entrance.
6. **Two open money defects** (per-journey overcharge, strandable inline escrow). Both need a founder
   decision, not more investigation.
7. **CLI is unpublished**, so "operate it from CI" still requires the repo. The package is ready; only the
   registry publish is missing.
8. **The plan rehearsal is not in the product.** `ops/plan-rehearse.ts` refuses to mint a plan that cannot
   pass, and six consecutive generated plans were unrunnable without it. It belongs between prepare and
   approve.
9. **A plan can assert a value an earlier run left behind**, so an application that had stopped saving
   could still come back Verified. The workaround is a reset script. The fix is a per-run unique value or
   plans that clean up after themselves. This is the last known false-Verified risk.

**Closed since the previous revision:** the run-to-guarantee binding (was #1), the verify-a-guarantee
action (was #2), the demo account having no story (was #5), and the Repairs surface rendering empty.

---

## 9. Safe claims versus future claims

### Safe to say today

- Vraelis derives requirements and browser journeys from a plain-language business outcome, and a person
  approves them before anything runs or is charged.
- It drives a real browser against the deployed application and returns Verified, Failed or Blocked with
  evidence: per-journey results, the failing step, expected versus observed, and screenshots.
- It refuses to charge when it cannot build a test that would prove the claim — **on the public API and
  the guarantee-prepare path.** Say it that way, or say "the API refuses". A console launch does not
  evaluate coverage today, so the unqualified sentence is not currently true of the path most people use.
- On failure it produces a repair prompt written for a coding agent, carried on the issue and rendered as
  the repair handoff on the report.
- A verification can prove a **named, durable guarantee**, pinned to the exact approved meaning (plan
  version and plan hash) it was proven against, and an existing guarantee can be reverified directly.
- It refuses to launch against a hostname that does not resolve, before taking payment or spending a free
  pass.
- A rerun re-executes the same approved contract and is permanently linked to the run it repairs.
- The full Failed → repair → reverification → Verified loop has been closed end to end against a live
  application, including payment.
- Verification can be launched from the console, the public API, or the command line, with CI-usable exit
  codes.
- Approval is a distinct, audited, human-only event; a paid run refuses a plan that has not passed through
  it.

### Direction, but not fully implemented yet

- "Every verification belongs to a durable guarantee." — **Every verification CAN.** The binding is
  compulsory in code and exercised against a live application. It is not true that every historical run
  carries one, and the population has not been re-measured since 2026-07-27.
- "Vraelis refuses to charge for an unprovable claim." — True of the API, **not of a console launch.** See
  gap 2.
- "Vraelis sends a scoped repair task to your coding agent." — **It does not.** It produces a prompt.
- "Vraelis detects the repaired deployment." — **It does not.** It can read the current Vercel URL when a
  run is launched.
- "Vraelis reverifies automatically." — **It does not.** Reruns are manual, though reverifying a named
  guarantee is now a single action rather than a reconstruction.
- "A permanent record of every failure, repair and reverification per guarantee." — Records exist per run
  and runs now carry their guarantee, so the history is *accumulating*; there is no per-guarantee history
  view that presents it.
- "A durable repair task." — **Schema only.** `v_repairs` has no writer and its surfaces are gated off.
  The repair prompt is real and lives on the issue.

**Direct answers to the sharp questions:** generates a repair prompt — **yes**. Creates a durable repair
record — **no; the table exists and nothing writes it**. Sends it automatically — **no**. Connects to a
coding agent — **no**. Detects the repaired deployment — **no**. Automatically reverifies — **no**.
Verifies a named guarantee on demand — **yes**. Preserves exact guarantee and reviewed-plan lineage —
**yes, and exercised**.

---

## 10. Information for the YC application

**Strongest current description.** Vraelis independently verifies that software built by AI actually
delivers the business outcome it claims. You name an outcome; Vraelis writes the requirements and browser
journeys, a person approves them, and it drives a real browser against your deployment and returns Verified,
Failed or Blocked with the evidence — plus a repair prompt when it fails.

**Strongest progress facts.** A working browser verification engine with credit escrow and settlement; an
immutable human-approved plan contract; a coverage gate on the API that refuses to charge for an unprovable
claim; a full Failed → repair → reverification → Verified loop closed against a live app with real payment;
verifications bound to named durable guarantees at the exact approved meaning, with a single acceptance
service under every entrance; console, API and CLI over one engine; multi-tenant workspaces, org SSO and
live Stripe billing.

**Strongest founder-built technical facts.** One canonical decision translator enforced across every
surface, adopted after finding a false Verified in the product's own console. A coverage gate that blocks
spend rather than producing a meaningless verdict. Provenance separating who authored a requirement from who
approved it, including an audited correction of 136 rows that falsely claimed human authorship. Architectural
ratchets that refuse new run entrances until a shared acceptance path exists — a guard that blocked the
founder's own feature, and was satisfied by building the service rather than by working around it.

**Clearest current limitation.** No company that is not us has ever used it. Every gap the previous
revision ranked above that one is now closed, which removes the last engineering answer to the question.

**Second clearest.** The refusal that defines the product is not yet on the path most people take: a
console launch does not evaluate coverage. Do not describe the coverage gate without naming where it runs.

**Most important thing YC should understand.** The hard part is not driving a browser; it is refusing to
produce a false Verified. Most of the engineering is spent on gates that decline to answer.

**Wording that may be ahead of implementation.** Anything implying that Vraelis *sends* repairs to an
agent, *watches* deployments, reverifies *automatically*, or *continuously* monitors. Each is direction,
not behaviour. "Guarantees accumulate proof" is now defensible in the narrow sense that runs carry their
guarantee and lineage is preserved; it is still ahead of the product in the sense that no surface presents
a per-guarantee history.

---

## 11. Information for the website

**The homepage should communicate** that AI writes the code and grades its own work, and that Vraelis is
the independent check: name the outcome, approve the plan, get a decision backed by evidence. The strongest
differentiator is the refusal — Vraelis declines to charge when it cannot prove the claim.

**What the console proves.** That this is a real operational product with durable objects, not a demo:
systems, an approval queue, evidence, records, per-key usage and limits, and a decision vocabulary of
exactly three words.

**Deserves more emphasis.** Human approval before any spend. The coverage gate. Evidence over verdicts. The
API and CLI as first-class ways to operate it.

**Should be qualified.** Anything about guarantees accumulating proof over time; automatic reverification;
"continuous" anything.

**Should be removed.** Old positioning ("Production Pass", "the production layer for AI-built software",
human-evaluation vocabulary), and any suggestion of monitoring or continuous coverage.

**Vraelis is not** generic QA, browser automation, monitoring, compliance software, an AI testing agent, or
a badge service.

---

## 12. Direct answers

1. **Today it** turns a business outcome into a human-approved browser plan, binds it to a named durable
   guarantee, runs it against a real deployment, and returns Verified/Failed/Blocked with evidence and a
   repair prompt.
2. **Next it** gets used by somebody who is not us. The engineering answer to "what is next" ran out.
3. **Does every run belong to a guarantee?** Every run now *records* whether it does, and the field is
   compulsory. Null remains a valid, permanently supported answer for a plain verification.
4. **Can a user verify an existing guarantee directly?** Yes.
5. **Does a rerun preserve the same guarantee and plan?** Yes, and it is reachable now: a run pins the
   triple and a re-approval cannot silently restate historical verdicts.
6. **Only repair instructions?** Yes — a prompt on the issue. The durable repair *record* is schema with
   no writer, and its surfaces are gated off.
7. **Send a scoped task to a connected coding agent?** No. No such connection exists.
8. **Detect the repaired deployment?** No.
9. **Automatically reverify?** No.
10. **Most important missing connection:** a customer. After that, the coverage gate under the console
    launch path, which is the one place the product's defining refusal is still absent.

---

## Quick reference

**10 facts another session must know**

1. No company that is not us has ever used Vraelis. That is the gap; everything below is engineering.
2. The run-to-guarantee binding is compulsory in code (`CreateRunInput.guarantee`, required) and exercised
   against a live application. Migration 23 is applied.
3. The verify-a-guarantee action exists, and `lib/preflight/acceptance/accept-run.ts` is the single
   acceptance service under every entrance. `createRun` has exactly two callers and a suite enforces that.
4. **The coverage gate is NOT under every entrance.** Console launch and rerun do not evaluate coverage.
   It is a recorded defect, not an oversight, and it is asserted as one.
5. There is no coding-agent connection, no deployment detection and no automatic reverification. The loop
   ends at a repair prompt the customer copies.
6. The public site is behind a stealth curtain. The homepage is exempt from `noindex` so the domain does
   not fall out of the index entirely; `/yc?k=…` is the reviewer entrance.
7. Live Stripe. Credits = dollars × 10; a $15 pass is 150 credits. **Only `unit='credit'` rows are
   spendable**; leftover `cent` rows are legacy and must never be summed in. Signup mints no credits; the
   free tier is one lifetime pass of 3 journeys.
8. All decisions must go through `toPublicDecision` — Verified / Failed / Blocked only.
9. `v_repairs` has no writer. Its surfaces are gated off behind `VRAELIS_REPAIRS_SURFACE`.
10. The CLI is publish-ready but the npm name `vraelis` is still unclaimed.

*Production counts (systems, runs, payments) were last measured 2026-07-27 and are not re-measured here.
The only payments are the founder's tests.*

**5 things that work:** human-approved plans with an immutable hash; real-browser execution with evidence
and screenshots; verifications bound to named guarantees at the exact approved meaning; credit escrow with
settlement and refunds; console + API + CLI over one engine.

**5 things being completed:** the coverage gate under every entrance; per-guarantee proof history as a
surface; plan rehearsal moved into the product; per-run unique assertion values; a repair record that
something actually writes.

**5 claims safe for YC:** a person approves the plan before anything runs or is charged; the API refuses to
charge when it cannot prove the claim; decisions come with per-journey evidence and screenshots; the full
Failed → repair → reverification → Verified loop has been closed against a live app with real payment;
verification runs from console, API or CI with meaningful exit codes.

**5 claims that must be framed as future:** repairs are dispatched to your coding agent; repaired
deployments are detected; reverification happens automatically; guarantees present a permanent proof
history; every launch path refuses an unprovable claim.

**Most accurate description, under 500 characters**

> Vraelis independently verifies that software built by AI actually delivers the business outcome it
> claims. Name an outcome; Vraelis derives the requirements and browser journeys, a person approves them,
> and it drives a real browser against your deployment — returning Verified, Failed or Blocked with the
> evidence, and a repair prompt when it fails. It refuses to charge when it cannot prove the claim.

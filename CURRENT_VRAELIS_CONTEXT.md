# Vraelis — current source of truth

Written 2026-07-27 from the active codebase and production data. Stale docs, retired product
generations and old landing copy are deliberately excluded. Where something does not work, it says so.

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

**Guarantees — Being completed, and currently inert.** The durable object exists end to end in code:
create, derive a plan, human approval, status derivation, a detail page, and a cross-system list at
`/guarantees`. **Zero guarantees exist in production, and no verification has ever been bound to one.** See
section 4.

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

**Repair instructions — Working. Repair tasks — Working with limitations.** A failure produces a repair
prompt. `v_repairs` is a durable record with `fix_prompt`, `suggested_files`, `patch`, a linked verification
run, and status `suggested | applied_by_user | verified | failed`. **The customer applies the repair
themselves.** Nothing is sent anywhere.

**Reruns and reverification — Working, manually.** A rerun re-executes the same contract, records
`parent_run_id` lineage, and can target only the failed journeys. It is user-initiated.

**API — Working with limitations.** `POST /v1/verifications` (dry run → mint plan → approve → paid
execution), `GET /v1/verifications/{id}`, and plan read/approve. Results now carry `guarantee_id`,
`reviewed_plan_id`, the reverification link and a console URL. An internal canary has passed; an external
third-party customer path has not been completed.

**CLI — Working, unpublished.** `cli/vraelis.mjs`: one command (`verify`), `--wait`, `--json`,
`--repair-prompt`, `--idempotency-key`, and exit codes 0/1/2 mapped to Verified/Failed/Blocked. **It is not
on npm** (`private: true`), so today it runs from the repo.

**Console — Working.** `app.vraelis.com`. Navigation states the product model: Overview, Systems,
Guarantees, Verifications, Review, Records, then Integrations and Developers, then settings. Command bar,
per-key usage and limits, dense record tables.

**Organizations and teams — Working.** Workspaces, roles (owner/admin/editor/viewer/client_viewer),
domain-verified organizations, SSO, and owner-anchored billing: a teammate's run spends the owner's credits.

**Billing and credits — Working.** Live Stripe. Plans and credit top-ups, both on an in-app checkout
(Payment Element) rather than a redirect. Credits = dollars × 10. Escrow model: credits are held before a
run and settled or refunded after.

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

**Binding verifications to guarantees — in progress, the central work.** `createRun()` accepted a
`guaranteeId` and **no caller ever passed it**, so `v_preflight_runs.guarantee_id` was never written: 0 of
29 runs. A guarantee could be created, planned and human-approved and then never become proven. The
argument is now required at every caller and the compiler enforces it. Migration 23 is applied.

**Preserving reviewed-plan lineage — done.** A run pins a *triple*: `guarantee_id`, `plan_version` and
`plan_hash`. The id alone is not an identity, because approval overwrites the guarantee's plan in place with
no version history — so one re-approval would silently restate every historical verdict. Comparing the
pinned hash against the live one tells you whether old evidence still speaks to the current definition;
where it does not, the run stays in the history and stops counting toward the live verdict. A reviewed plan
also now records which guarantee it defines, so a guarantee's plan and a plain verification of the same
sentence are no longer the same row.

**Approval producing something runnable — done.** Approval materialises the plan into a frozen contract
marked `kind='guarantee'`, so reverification is execution of a fixed artifact rather than a fresh synthesis.

**Verifying an existing guarantee — blocked, deliberately.** The "Verify this guarantee" action is the one
missing link. It was written and then deleted, because an architectural ratchet refuses a new run entrance
until a shared acceptance service exists: the coverage gate currently sits *above* the shared handler, so a
new entrance can start a run the public API would refuse. Working around it would have shipped a verify
button that skips coverage.

**The acceptance service — designed, not yet built.** One domain function below every entrance. A trace
established that the *corrective* resolver cannot move (it needs an in-memory synthesis and crawl and up to
300s); only the pure gate moves.

**Money-path defects found while tracing — two fixed, two open.** Fixed: a credit hold that reported
success when its ledger debit failed (which could both give free runs and *mint* credits on refund), and a
boundary guard that watched one function name and so could not see a fourth entrance taking real holds.
Open, and both needing a decision: holds are priced per requested journey but the run may execute fewer and
is charged the full amount; and the inline API entrance can strand escrow if its function is killed
mid-run.

**Decision consistency — fixed.** Described in section 2.

**Demo readiness — not started.** `demo@vraelis.com` has 1 system, 3 runs, 0 guarantees.

**Website accuracy — partially done.** The site is design-06 and coherent, but stealthed.

---

## 5. Current business

**Target customer.** Companies shipping AI-built or AI-modified software with at least one revenue-critical
outcome. Not QA teams.

**Current use case.** Prove a specific business outcome still holds on a specific deployment, and get a
scoped repair when it does not.

**Pricing.** Credit top-ups ($5 → 50 credits, $9/$39/$99/$299/$999 packs) and subscription plans, live on
Stripe. Free tier. Credits are escrowed per run and refunded when nothing executed.

**Distribution.** Public site (currently curtained), the console, the API and the CLI. A reviewer link
exists for YC.

**Users, customers, revenue.** Production holds 6 systems and 29 verification runs, concentrated in the
founder's own accounts and a demo account. The payments that exist are the founder's own test purchases.
**There is no evidence in the system of external paying customers or external revenue, and none should be
claimed.** Billing infrastructure being complete is not traction.

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
4. **A coverage gate that refuses to charge** for a plan that could not prove the claim.
5. **Provenance as a first-class concern.** Who authored a requirement versus who approved it, with an
   audited correction of 136 rows that falsely claimed human authorship.
6. **Multi-tenant foundations**: workspaces, roles, org domains, SSO, owner-anchored billing.
7. **A test discipline that catches real defects**, including several in the money path, with mutation
   testing used to prove a guard can actually fail.

---

## 8. Largest remaining gaps, ranked

1. **No verification is bound to a guarantee.** The central object cannot accumulate proof. Everything else
   in the pitch depends on this.
2. **No "verify this guarantee" action**, blocked on the acceptance service.
3. **No coding-agent handoff.** The loop stops at a prompt the customer copies.
4. **No deployment detection and no automatic reverification.** The customer must come back and press a
   button.
5. **The demo account has no story.** A reviewer signing in today sees three runs and no guarantee.
6. **No external users.** Nothing has been validated with a company that is not us.
7. **CLI is unpublished**, so "operate it from CI" requires the repo.
8. **Two open money defects** (per-journey overcharge, strandable inline escrow).
9. **The site is curtained**, so nothing is discoverable.

---

## 9. Safe claims versus future claims

### Safe to say today

- Vraelis derives requirements and browser journeys from a plain-language business outcome, and a person
  approves them before anything runs or is charged.
- It drives a real browser against the deployed application and returns Verified, Failed or Blocked with
  evidence: per-journey results, the failing step, expected versus observed, and screenshots.
- It refuses to charge when it cannot build a test that would prove the claim.
- On failure it produces a repair prompt written for a coding agent, and keeps a durable repair record.
- A rerun re-executes the same approved contract and is permanently linked to the run it repairs.
- The full Failed → repair → reverification → Verified loop has been closed end to end against a live
  application, including payment.
- Verification can be launched from the console, the public API, or the command line, with CI-usable exit
  codes.
- Approval is a distinct, audited, human-only event; a paid run refuses a plan that has not passed through
  it.

### Direction, but not fully implemented yet

- "Every verification belongs to a durable guarantee." — The binding exists in schema and code; **no run
  carries one yet.**
- "Verify an existing guarantee." — **No action exists.**
- "A rerun proves the same guarantee at the same approved meaning." — The inheritance and the refusals are
  implemented and correct, but unreachable until runs carry guarantees.
- "Vraelis sends a scoped repair task to your coding agent." — **It does not.** It produces a prompt.
- "Vraelis detects the repaired deployment." — **It does not.** It can read the current Vercel URL when a
  run is launched.
- "Vraelis reverifies automatically." — **It does not.** Reruns are manual.
- "A permanent record of every failure, repair and reverification per guarantee." — Records exist per run;
  per-guarantee history is not populated.

**Direct answers to the sharp questions:** generates a repair prompt — **yes**. Creates a durable repair
task — **yes, as a record**. Sends it automatically — **no**. Connects to a coding agent — **no**. Detects
the repaired deployment — **no**. Automatically reverifies — **no**. Preserves exact guarantee and
reviewed-plan lineage — **implemented, not yet exercised**.

---

## 10. Information for the YC application

**Strongest current description.** Vraelis independently verifies that software built by AI actually
delivers the business outcome it claims. You name an outcome; Vraelis writes the requirements and browser
journeys, a person approves them, and it drives a real browser against your deployment and returns Verified,
Failed or Blocked with the evidence — plus a repair prompt when it fails.

**Strongest progress facts.** A working browser verification engine with credit escrow and settlement; an
immutable human-approved plan contract; a coverage gate that refuses to charge for an unprovable claim; a
full Failed → repair → reverification → Verified loop closed against a live app with real payment; console,
API and CLI over one engine; multi-tenant workspaces, org SSO and live Stripe billing.

**Strongest founder-built technical facts.** One canonical decision translator enforced across every
surface, adopted after finding a false Verified in the product's own console. A coverage gate that blocks
spend rather than producing a meaningless verdict. Provenance separating who authored a requirement from who
approved it, including an audited correction of 136 rows that falsely claimed human authorship. Architectural
ratchets that refuse new run entrances until a shared acceptance path exists — a guard that recently blocked
the founder's own feature.

**Clearest current limitation.** The guarantee — the durable object the whole story rests on — is fully
built and not yet connected to execution. Zero of 29 runs carry one.

**Most important thing YC should understand.** The hard part is not driving a browser; it is refusing to
produce a false Verified. Most of the engineering is spent on gates that decline to answer.

**Wording that may be ahead of implementation.** Anything implying that Vraelis *sends* repairs to an
agent, *watches* deployments, reverifies *automatically*, *continuously* monitors, or that guarantees are
*currently* accumulating proof. Each is direction, not behaviour.

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

1. **Today it** turns a business outcome into a human-approved browser plan, runs it against a real
   deployment, and returns Verified/Failed/Blocked with evidence and a repair prompt.
2. **Next it** binds every verification to a durable guarantee so proof accumulates across deployments.
3. **Does every run belong to a guarantee?** No. Zero do.
4. **Can a user verify an existing guarantee directly?** No.
5. **Does a rerun preserve the same guarantee and plan?** The mechanism exists and is correct; it is
   unreachable until runs carry guarantees.
6. **Only repair instructions?** Yes — a prompt plus a durable repair record the customer acts on.
7. **Send a scoped task to a connected coding agent?** No. No such connection exists.
8. **Detect the repaired deployment?** No.
9. **Automatically reverify?** No.
10. **Most important missing connection:** the run-to-guarantee binding being *written* — the verify action,
    which is blocked on the acceptance service.

---

## Quick reference

**10 facts another session must know**

1. Zero guarantees exist in production; 0 of 29 runs carry a `guarantee_id`.
2. Migration 23 is applied; the binding exists in schema and code but is not yet exercised.
3. The "verify this guarantee" action does not exist and is intentionally blocked on the acceptance service.
4. There is no coding-agent connection. The loop ends at a repair prompt.
5. There is no deployment detection and no automatic reverification.
6. The public site is behind a stealth curtain and `noindex`.
7. `demo@vraelis.com` has 1 system, 3 runs, 0 guarantees.
8. Live Stripe; credits = dollars × 10; the only payments are the founder's tests.
9. All decisions must go through `toPublicDecision` — Verified / Failed / Blocked only.
10. The CLI is real but unpublished (`private: true`).

**5 things that work:** human-approved plans with an immutable hash; real-browser execution with evidence
and screenshots; the coverage gate that refuses to charge; credit escrow with settlement and refunds;
console + API + CLI over one engine.

**5 things being completed:** the run-to-guarantee binding; the verify-a-guarantee action; the acceptance
service; per-guarantee proof history; the demo lifecycle.

**5 claims safe for YC:** a person approves the plan before anything runs or is charged; Vraelis refuses to
charge when it cannot prove the claim; decisions come with per-journey evidence and screenshots; the full
Failed → repair → reverification → Verified loop has been closed against a live app with real payment;
verification runs from console, API or CI with meaningful exit codes.

**5 claims that must be framed as future:** every verification belongs to a durable guarantee; repairs are
dispatched to your coding agent; repaired deployments are detected; reverification happens automatically;
guarantees accumulate a permanent proof history.

**Most accurate description, under 500 characters**

> Vraelis independently verifies that software built by AI actually delivers the business outcome it
> claims. Name an outcome; Vraelis derives the requirements and browser journeys, a person approves them,
> and it drives a real browser against your deployment — returning Verified, Failed or Blocked with the
> evidence, and a repair prompt when it fails. It refuses to charge when it cannot prove the claim.

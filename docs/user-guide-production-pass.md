# User guide: the Production Pass

Vraelis is the production layer for AI-built software. AI built the product; Vraelis finishes the
engineering. A Production Pass opens your deployed app in a real cloud browser, walks the flows you approved,
and tells you whether it is safe to launch, with evidence for every blocker.

This guide follows the product exactly as it exists today. Anything Vraelis does not do yet is in the
Limits section at the end, and nothing in the UI pretends otherwise.

---

## 1. Connect an application

Applications -> Connect an application.

- **Application URL**: the public https URL of your deployed app (a Vercel preview or production URL works).
- **Application name**: a short label so you can tell your apps apart.
- **Original build prompt** (recommended): paste the prompt or spec you used to build the app. Vraelis uses
  it to understand what the app was meant to do. You can add or edit it later.
- **Builder** (optional): what you built the app with.
- **Ownership**: you must check "I own this application or am authorized to test it." Vraelis only tests
  apps you own or are authorized to test; the connection is refused without this confirmation.

Buttons like "Connect GitHub" and "Add test account" are marked coming soon and do nothing yet. They are
future inputs, not current features.

## 2. Review and approve the Production Contract

The Production Contract is the approved definition of what your product promises. Vraelis tests these
promises before you launch.

- While the contract is a **draft**, you can add, edit, enable, disable, and delete requirements.
- **Approve** locks it. An approved contract is immutable: every edit path is refused, and the app shows the
  approved version with its approval time. At least one requirement must be enabled to approve.
- To change an approved contract, use **Create new draft**. This copies the approved version into the next
  draft version (v2, v3, ...). While you edit the draft, runs keep verifying against the latest **approved**
  version, so an in-progress revision never blocks a run. The draft takes over only when you approve it.

## 3. Approve flows

Flows are the concrete browser walkthroughs that cover your requirements (for example: sign up, add an item,
submit the form). A Production Pass executes only flows that are both **enabled** and **approved**. The
contract page shows which requirements are covered by approved flows, including how many critical
requirements are covered, so you can see gaps before running.

## 4. Run a Production Pass

The application overview has a **Run Production Pass** button once the contract is approved and at least one
flow is eligible.

Pricing (early access):

- A Production Pass is priced as a unit: $10 base including up to 5 approved critical flows, then $2 per
  additional flow. During early access your account balance funds passes; the hold is taken when the pass
  is queued.
- A completed pass keeps the hold as the charge, flat for the run, with no surprise extras.
- If the pass ends without a single flow having run (for example the browser provider failed before your app
  was ever opened), the full hold is refunded automatically.

Limits you may hit at launch time, each with a plain message: not enough credits, contract not approved, more
than 2 passes already in flight, or the daily run limit (20 per day by default). None of these charge you.

While the pass runs, the overview shows that it is in progress. A pass is bounded: it cannot run longer than
15 minutes, no flow longer than 3 minutes, and no flow more than 30 steps, so you always get a result.

## 5. Read the report

Every pass produces an immutable report.

- **Verdict** at the top: READY, NEEDS REVIEW, or BLOCKED, with the reason in plain language (see section 8).
- **Blockers**, one story per issue: a plain-English title, which flow Vraelis was running when it hit the
  problem, what was expected versus what was observed, severity and category labels, and the evidence.
- **Screenshots**: taken in the real browser during the run. They are stored privately; only you can open
  them, through short-lived signed links.
- **How to reproduce**: the exact steps, in order, so you (or your AI builder) can see the failure yourself.
- **Technical details**: the raw observed string, console errors, and failed network requests live in a
  collapsed section per blocker, so the story stays readable and the raw data stays available.
- **Repair prompt**: each blocker comes with a prompt written for the tool that built your app, with a copy
  button. Paste it into your builder, apply the fix, and rerun.

## 6. Rerun after a repair

From a finished pass you can rerun its flows: the failed ones, the critical ones, or all of them.

A rerun is a **new** pass linked to the original. The original report is never modified. The rerun uses the
same contract version the original verified against and targets the same deployment, so the comparison is
honest. A targeted rerun charges only for the flows it actually executes, and is refunded in full if nothing ran.

## 7. Issue continuity

Issues carry across linked runs so you can see whether a repair actually worked.

- An issue is **resolved** only when the exact flow that found it **passes in a finalized run**. Nothing else
  resolves it: not editing the contract, not time passing, not a rerun that skipped the flow.
- If the flow runs again and still fails the same way, the existing issue **continues**: same issue, updated
  last-seen run and refreshed evidence, so you see one problem with a history rather than a pile of
  duplicates.
- If a flow that used to pass starts failing, that is a **regression** and opens a new issue.
- If a flow did not run in the rerun, its issues stay open and untouched (unverified).
- Resolution is a status change, never a deletion. The full history stays.

## 8. How the decision is made

The verdict is computed from flow results with a fixed rule, never an aggregate score:

- **BLOCKED**: at least one **critical** flow failed or could not complete. Launching means shipping a broken
  core promise.
- **NEEDS REVIEW**: every critical flow passed, but at least one non-critical flow failed. Read the blockers
  and decide.
- **READY**: every flow that ran passed, including all critical flows.

A flow's criticality comes from the priority you set on it in the contract, so the decision reflects what you
said matters.

## 9. Limits (honest edition)

What a Production Pass is:

- A **test** of your deployed app in a real, isolated cloud browser, against the flows you approved. It
  navigates, clicks, types, and asserts what you told it to expect, and records what actually happened.

What it is not, and does not pretend to be:

- **No real charges.** Vraelis does not complete real payments and does not audit your Stripe account. Point
  passes at test deployments and test data, not at flows that would spend real money.
- **No repo or database access.** Vraelis sees your app the way a user's browser does. It does not read your
  code, inspect your database, or open PRs. Repair prompts are for you to apply in your own builder.
- **No arbitrary code.** Flows are structured steps (navigate, click, fill, assert). Vraelis does not inject
  arbitrary JavaScript into your app.
- **No destructive actions without approval.** A flow performs potentially destructive actions only when
  that flow is explicitly marked to allow them, and you approve every flow before it can run.
- **Bounded runs.** 15 minutes per pass, 3 minutes and 30 steps per flow, at most 2 passes in flight, and a
  daily pass limit. These are safety rails, not soft targets.

Future modules, listed so you know they are on the map and NOT built today: repo analysis, database
inspection, payment auditing, automatic PRs, deployment control, continuous monitoring. Nothing in the
current UI simulates them.

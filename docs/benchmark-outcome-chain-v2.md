# Benchmark 2: outcome-chain verification

**Status: PRE-REGISTERED. Locked 2026-07-20, before any data was collected.**

Companion to `benchmark-deployment-oracle-v1.md`, which is **not** modified by this document. V1 tests a
narrow claim about failures introduced between working code and the released build. This one tests the
larger thesis. They are separate experiments with separate thresholds, committed separately, so the bigger
idea cannot quietly rewrite the smaller one after the fact.

Same rule as V1: nothing below the frozen line may be edited once the first run happens. Git is the tamper
record.

---

## The hypothesis

> One user action crosses several systems. Every one of them can report success while the user still ends up
> with nothing. Vraelis detects these outcome-chain failures, which tools that check individual components
> structurally cannot.

The failure this is about:

> A checkout page loads. Stripe accepts the payment. The webhook fails. Access is never granted. Every
> component is healthy. The customer paid for nothing.

A synthetic monitor watching the checkout page sees a healthy page. Stripe's dashboard shows a successful
charge. The database is up. Nothing is red anywhere, and the outcome did not happen.

---

## What is honestly being measured, and the split that matters most

Vraelis today runs a browser. It holds tokens for Stripe, Supabase, GitHub, Vercel and Slack, but almost
nothing reads them during a run. So it can only detect a chain failure that becomes **visible to a user**.

That is not a weakness of the experiment, it is the most useful thing the experiment can produce. Every
seeded failure is therefore labelled in advance as one of:

- **BROWSER-VISIBLE** — a user would eventually see it. Payment succeeds but the account still shows the free
  plan. Vraelis should catch these today.
- **BROWSER-INVISIBLE** — nothing in the interface ever reveals it. The CRM record was never created; the
  confirmation email never sent. Vraelis cannot catch these today, by construction.

Scoring keeps them apart and never averages them together. The two numbers answer two different questions:

1. Browser-visible recall: **is the product good right now?**
2. Browser-invisible count: **how much of the chain is invisible from the outside, and therefore how much is
   the connection-reader work actually worth?**

The second number is a build decision, made with data instead of enthusiasm. If most real chain failures turn
out to be browser-visible, the connection readers are a smaller prize than they look and the roadmap changes.

---

## Consent, and what we will never do

Identical to V1 and equally non-negotiable. Nothing runs against an application whose owner has not given
specific written permission, with enumerated allowed and prohibited actions, purpose-made test credentials,
and payment providers confirmed in test mode. **No real charge, ever.** Any seeded failure that would create
one is dropped rather than run.

This benchmark reaches further into a business than V1 does, since a chain failure spans payment, data and
messaging. That makes the permission list longer, not shorter. Get it in writing per system.

---

## Blinding

- The **owner** seeds the failures, from the categories below, and tells nobody until scoring.
- The **owner** adjudicates whether a finding is real. A finding we call a bug and they call intended
  behaviour is a FALSE ALARM, not a disagreement to argue about.
- Whoever operates the tools is not told which applications are clean.
- Each seeded failure's BROWSER-VISIBLE / BROWSER-INVISIBLE label is fixed **before** the run, by the owner,
  not assigned afterwards to flatter the result.

---

## Population

Ten consenting applications with a real multi-system chain: at minimum a payment provider, a database, and
one asynchronous effect (email, webhook, or queued job). Five fresh AI-built deployments, five more
established. Staging or throwaway environments.

The owner records, before anything runs, the three outcomes they most care about, phrased as outcomes rather
than pages: "a paying customer can use the paid feature", not "the checkout page loads".

---

## Seeded failures

Three per application, thirty total. Applied so that **every individual component still reports success**.
A seed where something visibly errors is not testing this hypothesis and must be replaced.

| Category | Example | Typical label |
|---|---|---|
| Payment to entitlement | Charge succeeds, webhook 500s, access never granted | BROWSER-VISIBLE |
| Write to persistence | Form submits and confirms, row never lands | usually BROWSER-VISIBLE on revisit |
| Notification | State changes correctly, confirmation email never sends | BROWSER-INVISIBLE |
| Downstream system | API returns 200, CRM or downstream record never created | BROWSER-INVISIBLE |
| Delayed effect | Queued job never runs, so a later state never appears | mixed |
| Cross-session | Access granted in this session, gone in a new one | BROWSER-VISIBLE |

At least three applications are left completely clean, and the operator is not told which.

---

## Comparators

The point of this benchmark is the comparison, because the claim is specifically that component checkers
cannot reach these:

- Vraelis, URL and a one-sentence description
- Checkly, or an equivalent synthetic monitor on the same flow
- TestSprite, with the repository access it normally wants
- The originating platform's own checker where one exists
- The provider dashboards alone (Stripe, the database, the email provider), as a human would read them

That last one is the honest control. If a person glancing at three dashboards catches everything Vraelis
catches, there is no product here, and it is better to learn that from ten apps than from a year of building.

Comparators we cannot run are reported as "not run", never as a zero.

---

## Scoring

| Metric | Definition |
|---|---|
| Chain recall (browser-visible) | Seeded visible failures found, out of the visible total |
| Chain recall (browser-invisible) | Seeded invisible failures found. Expected near zero today; measured anyway |
| Component-checker recall | The same seeds, found by the best comparator |
| Recall gap | Vraelis minus best comparator, on browser-visible seeds. **The headline number** |
| False-critical rate | Critical findings on clean applications or clean flows |
| False-pass rate | Seeded failures reported as passing |
| Outcome naming | Does the report describe the broken OUTCOME, or only the step that failed |
| Setup time | Human minutes from URL to first valid run |
| Repeat intent | Owner asks for it again, unprompted |

A find only counts if the report is specific enough to act on. "Checkout flow failed" against a seeded
webhook break does not count; "payment completed but the account did not gain access" does.

---

## Pre-registered success bar

The hypothesis survives only if ALL of:

- [ ] At least **70%** recall on browser-visible chain failures
- [ ] A recall gap of at least **+5 seeds** over the best component-checker comparator
- [ ] No more than **3** false criticals across the whole benchmark
- [ ] At least **6 of 10** owners say the finding mattered to their business, not just that it was correct
- [ ] At least **3** unseeded, owner-confirmed real chain failures

### Kill criteria

The thesis is DEAD if any of:

- Browser-visible recall below 40%
- The best component checker matches or beats Vraelis on the same seeds
- Reading the provider dashboards by hand finds everything Vraelis finds, faster
- Fewer than 3 owners want a second run

If it dies, that gets said publicly and in the YC application. A thesis killed in a week is cheaper than one
defended for six months.

---

## What this benchmark does NOT authorise

Passing does not authorise building connected-service verification for every provider. It authorises
building the readers for the **specific** systems where browser-invisible failures actually clustered, which
is a number this experiment produces and nobody currently has.

---

*Frozen below this line. Edits after the first run void the result.*

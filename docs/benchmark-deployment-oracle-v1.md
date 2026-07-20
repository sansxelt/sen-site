# Benchmark 1: deployment-grounded verification

**Status: PRE-REGISTERED. Locked 2026-07-20, before any data was collected.**

This document defines what success means BEFORE we know the answer. That is the entire point of it.
Once the first run happens, nothing below the "frozen" line may be edited. Git is the tamper record: if a
threshold changes after data collection starts, the diff will show it, and the result is void.

---

## The hypothesis

> Deployment-grounded verification can catch failures introduced between working code and the release users
> actually receive, on a fresh deployment, without an existing test suite, production traffic, or lengthy
> configuration.

**What this is not.** The deployment is not an oracle. It tells us what happened, never what should have
happened. A checkout that succeeds in test mode looks identical to one that succeeded correctly; an app with
a missing environment variable silently drops the feature rather than announcing it was meant to exist. The
oracle problem is NARROWED here, not solved: we are betting only that the gap between "the code is right"
and "the release is wrong" is a real, findable, valuable class of failure.

**What would make this not a company, even if the hypothesis holds.** Testing production is an existing
category. Checkly runs Playwright against production and markets catching production-only failures. Datadog
runs browser tests across staging and production. TestSprite deploys its generated tests against production
URLs as scheduled monitoring. So "we test the real deployment" is table stakes, and the only defensible
combination is all four of: fresh-release timing (before traffic or telemetry exist), deployment grounding,
near-zero setup, and low-noise inference. The fourth is the hard one and this benchmark exists to measure it.

---

## Consent, and what we will never do

Non-negotiable, and the reason this section is above the methodology: **nothing runs against an application
whose owner has not given specific written permission.** No exceptions, no "it's only a signup form".

Before any run, the owner supplies in writing:

- The exact URL to test (staging or a throwaway deployment strongly preferred over production)
- Test credentials created for this purpose, never their real account
- An enumerated list of actions we are permitted to take
- An enumerated list of actions that are prohibited
- Confirmation that no real payment instrument is reachable from the environment

If payments are in scope, the environment must be in test mode and confirmed by the owner. **We do not create
a real charge, ever.** If the seeded-failure list would produce a real charge, that seed is dropped rather
than run.

Automated flows create real rows, real emails and real load in someone else's system. An owner who consented
to "sign up and check persistence" did not consent to two hundred accounts.

---

## Blinding

The benchmark is worthless if the person running Vraelis knows where the bugs are.

1. **The owner seeds the failures, not us.** We give them the category list below. They choose which three,
   apply them, and tell nobody until scoring.
2. If an owner cannot seed them, a second person does it and the operator running the tools is not told.
3. **The owner adjudicates whether a finding is real.** Not us. A finding we think is a bug and the owner
   says is intended behaviour counts as a FALSE ALARM, not a disagreement to argue about.
4. Control applications with zero seeded failures are included and the operator is not told which they are.

---

## Population

Ten consenting applications:

- Five fresh AI-built deployments (Lovable, v0, Replit, Claude Code, Bolt or similar)
- Five more established applications
- A mix covering authentication, persistence, payments and third-party integrations

Per application, the owner provides: the URL, a one-sentence description of what the app is for, three
critical user outcomes in their own words, test credentials, and the permission lists above.

The three critical outcomes are recorded BEFORE any tool runs. They are the closest thing to ground truth we
have about intent, and they are how "did it identify the right flows" gets scored.

---

## Seeded failures

Three per app, thirty total. Applied to the DEPLOYMENT wherever possible, not the repository, since the
hypothesis is specifically about failures that source code inspection cannot see.

| Category | Examples |
|---|---|
| Configuration | Missing environment variable, wrong OAuth callback URL |
| Provider | Payment key left in test mode, invalid email-provider credential |
| Data | Migration not run, pointing at the wrong database |
| Network | CORS restriction, webhook endpoint unreachable |
| Domain | Cookie scope, redirect origin, DNS or geographic issue |

Plus at least three applications left completely clean. Without these, a system that reports failures
constantly scores as brilliant.

---

## Comparators

Run each system the way its own workflow expects, and record the setup burden rather than forcing identical
inputs (setup burden is itself a scored metric):

- Vraelis, URL and one-sentence description only
- TestSprite, with whatever repository or PRD access it normally wants
- Checkly, with an LLM-generated Playwright suite
- The originating platform's own checker, where the app was built somewhere that has one
- A human five-minute release smoke test

**Missing comparators.** Some will be unavailable: paid tiers, or checkers that only run inside their own
platform. Record which were unavailable and why. A comparator we could not run is reported as "not run",
never as a zero, and never quietly dropped from the writeup.

---

## Scoring

| Metric | Definition |
|---|---|
| Deployment-bug recall | Seeded failures correctly found, out of 30 |
| False-critical rate | Critical failures reported where the owner confirms nothing was wrong |
| False-pass rate | Seeded critical failures reported as passing |
| Unique useful finds | Owner-confirmed real failures that ONLY Vraelis found |
| Setup time | Human minutes from having the URL to the first valid run |
| Repeatability | Identical verdict across three consecutive unchanged runs |
| Diagnosis accuracy | Correctly attributes the cause to deployment or configuration |
| Repeat intent | Owner says, unprompted, that they want it on their next release |

A "find" only counts if the report names the failure specifically enough that the owner can act on it.
"Something is wrong with checkout" against a seeded test-mode key is NOT a find.

---

## Pre-registered success bar

The hypothesis survives the first benchmark only if ALL of:

- [ ] At least **21 of 30** seeded failures detected
- [ ] At least **6 more** failures detected than the best comparator
- [ ] No more than **3** false critical findings across the entire benchmark
- [ ] Median setup under **10 minutes**
- [ ] At least **3** unseeded, owner-confirmed real bugs
- [ ] At least **8 of 10** owners say they would run it after their next deployment

**Repeat intent is the metric that matters most.** Not payment, not recall. Do they ask for it again when
nobody is standing over them?

### Kill criteria

Failing one threshold narrowly is information, not a verdict. The thesis is DEAD if any of:

- Recall below 15 of 30
- More than 8 false criticals
- Comparators match or beat Vraelis on deployment-bug recall
- Fewer than 3 owners want a second run

If it dies, we say so publicly and in the YC application, and we stop. Killing a thesis in a week is a
better outcome than defending one for six months.

---

## What we are NOT allowed to do after data collection starts

- Change any threshold above
- Re-categorise a false alarm as "technically correct"
- Drop an application because it scored badly
- Add a comparator after seeing that we beat it
- Report recall without reporting false alarms in the same sentence

---

## Order of work

1. Lock this document (done, on commit)
2. Write the non-leading interview script
3. Draft outreach
4. Interview BEFORE describing Vraelis to anyone
5. Ask interested owners for explicit benchmark participation
6. Run, without touching the scoring
7. Publish the result either way

**The product is frozen during this.** No new connections, no new surfaces, no redesigns. The YC application
gets submitted based on what exists today, and whatever this produces replaces speculation in it.

---

*Frozen below this line. Edits after the first run void the result.*

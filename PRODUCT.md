# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical founders and engineering teams who ship software built with or by AI coding agents
(Cursor, Claude Code, Replit, Lovable, and similar). The situation: an agent reports that a change
is done, and the team needs independent proof that the deployed software actually does what the
business requires before it ships. Secondary users are automated: CI pipelines and the coding agents
themselves, which consume the same verification over an API, CLI, and webhooks.

## Product Purpose

Vraelis independently verifies that AI built software still does what the business requires. A user
states an outcome that must be true on a deployed application; Vraelis derives the requirements,
validates a proof plan that can prove the claim, executes the approved plan against the pinned
deployment through a real browser, and returns an evidence backed decision. Success is a trustworthy
Verified: when Vraelis says Verified, people can rely on it. The most important internal metric is a
rare, measured false Verified rate. A trust product survives being cautious; it cannot survive
confidently approving broken software.

## Positioning

The mechanism a neighboring product cannot truthfully copy: Vraelis checks from outside the
application, with no SDK, no test files, and no source access, so it does not inherit the assumptions
the mistake came from. Its input is a business outcome stated in one sentence, not an authored test
suite. It returns one explainable decision bound to the exact build, with deterministic evidence, and
it preserves every verification as a separate historical record that a later pass never overwrites. A
coding agent cannot mark its own work complete, and it cannot game a verification it does not control.

## Operating Context

The loop: connect a deployed web application and state the outcome that must be true; Vraelis derives
the requirements the claim implies and shows them; it validates a reviewed proof plan and the user
approves the exact plan; it executes against the pinned deployment through a real isolated browser; it
returns a decision with evidence (step trace, screenshots, console output, failed network requests);
on failure it packages what should have happened, what happened instead, reproduction, and evidence
as a repair prompt for the coding agent; it independently reverifies the repaired deployment; each run
is preserved as a separate immutable record. The same verification is reachable by people in the app
and by software over the API, CLI, CI gate, and outbound webhooks.

## Capabilities and Constraints

Today, live: specific business critical workflows in deployed web applications, driven through a real
browser from outside, with a Postgres backed run queue, an isolated browser worker, and private,
owner scoped evidence reached only by short lived signed URLs.

Canonical public decision vocabulary, identical across the app, API, CI gate, and webhooks:
**Verified, Failed, Blocked.** A targeted repair check renders publicly as Blocked until a full
critical verification returns Verified. The mapping lives in `lib/preflight/public-decision.ts`
(ready to verified, blocked to failed, needs_review and repair_verified to blocked).

Explicit boundaries the product does not cross today: it does not edit code; it does not diagnose the
source level cause (the coding agent does that, Vraelis independently checks the repair); it does not
introspect payment processors, databases, or email directly, only browser observed outcomes. API key
triggers and CI gating are in early access, built and typechecked but not fully proven end to end in
production, and the site must say so.

Direction, not today's coverage. Next: durable Guarantees, additional evidence sources, and
deployment triggered reverification. Horizon: independent proof infrastructure for AI built systems
and the companies they run.

Legacy terminology to retire from every public surface: "Production Pass" (old product name); the old
decision labels READY, NEEDS REVIEW, REPAIR VERIFIED; and the retired human evaluation product
(candidate evaluation, audience fit, Decision Package, qualified human judgment). Audit note: the
current homepage and developers page already use the canonical vocabulary; the residual legacy
language survives on the /demo and /free-report pages, in the orphaned pass-demo component, and in the
flag gated legacy pricing branch.

## Brand Commitments

Name: Vraelis. Mark: the gapped ring (center is the requirement, the ring is independent
verification). Identity: light first, warm paper and emerald, shared with the authenticated
application so the public site and the product feel like one company. Type: Geist as the display and
body face, with a technical monospace for data and labels. Voice: serious, operational, and honest,
under one rule enforced across the site: every sentence describes something that works today or is
explicitly marked as direction. Taglines in use: "AI builds. Vraelis proves." and "AI says it's done.
Vraelis proves it." Copy avoids em dashes, en dashes, middots, and dash separators (a standing user
rule): use plain punctuation, slashes, or rewording.

## Evidence on Hand

Real production verification sequences exist and may be shown as deterministic anonymized fixtures,
notably the customer upgrade case: payment succeeded but access did not, an incomplete repair was
rejected, and a full repair verified, preserved as a lineage. The authenticated product surfaces are
real and shippable: the Design 01 application shell and the Design 02 read only verification result
page. Do not fabricate customers, logos, revenue, user counts, accuracy figures, benchmark numbers, or
catch rate statistics; none are approved for public claims. The public site currently runs behind a
stealth curtain.

## Product Principles

1. The most trustworthy Verified in software. Measure and minimize false Verified above all else.
2. Independence is structural. Vraelis checks from outside the system, never from inside it.
3. Describe only what works today; mark direction clearly as direction, never as shipping.
4. One explainable decision bound to the exact build, always with the evidence behind it.
5. Nothing is overwritten. Every verification is preserved as a separate historical record.

## Accessibility & Inclusion

Carry the authenticated product's standard onto the public site: one h1 per page, semantic section
headings, keyboard operability for every control and disclosure, visible focus, reduced motion
respected, and a decision conveyed by label and shape rather than color alone.

# Product

## Current direction, October 4, 2026

Vraelis focuses on software behind physical systems in Defense, Infrastructure
and Robotics. SDKs, APIs and developer operations support these areas; ordinary
digital workflows remain available without being the main marketing position.
The older browser-product descriptions below document that workflow and do not
define the full current product.

Two separate workflows are available: local evaluation of supported recorded
task reports, and human-approved browser execution on reachable test panels.
The recording beta accepts normalized JSON and a limited uncompressed MCAP JSON
subset. It evaluates supplied task/asset identity, deadlines, reported states,
declared capture coverage and changes to another asset. Missing evidence is
inconclusive. Files stay in the browser; there are no live device connections or
cloud recording history. Neither workflow establishes physical ground truth or
certifies safety.

Current visual direction: black and white, Manrope, cinematic real footage,
centered “Know your systems work.” and a native-scroll opening. The product
explanation is concrete: find where control software and device reports
disagree. Mark examples as simulated; preserve original dated run evidence.
Do not restore the retired emerald palette, Geist typography or web-app-only
social description from older sections below.

The competitive gap remains a hypothesis, not proof of an empty market. See
[the market thesis](docs/strategy/market-and-company-thesis-2026-10-04.md) and
[the website/workflow review](docs/strategy/website-and-workflow-review-2026-10-04.md).

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who ships a web app, or answers for one, and can say in one sentence what it should do:
developers, product teams, agencies checking client sites, founders and no-code builders, and QA. The
situation is the same for all of them: someone says a change works (a teammate, a client, a contractor,
an AI coding agent, or the reader themselves), and they want the live app to answer before they rely on
it. Teams that run connected devices (drones, robots, fleets) from a web control panel are a named
area. Automated callers use the same check: CI pipelines through the API and CLI, and AI coding
assistants over MCP. Those are ways in, not the definition of the user.

## Product Purpose

Vraelis checks whether a deployed web app does what someone says it does. A person, a pipeline or an
AI assistant hands it one sentence about what should work on a public https deployment; Vraelis turns
the sentence into requirements and the browser steps that would prove them; a person approves that
plan once; a real browser runs it on the live app; and the answer is Verified, Failed or Blocked, with
the evidence (steps, screenshots, console errors, failed requests) and, on Failed, a repair prompt.
After a fix, the same approved plan can be re-checked without a new approval, within limits. A
connected device is checked the same way, through the web control panel that runs it. Success is a
trustworthy Verified: when Vraelis says Verified, people can rely on it. The most important internal
metric is a rare, measured false Verified rate. A trust product survives being cautious; it cannot
survive confidently approving broken software.

## Positioning

Narrow about the function, wide about the audience. The category line is "Verification on the live
app", and the headline is "Say what should work. Vraelis checks it on the live app." No public line
names a specific assistant or makes the product about one kind of builder; AI assistants over MCP are
one of four channels beside the console, the CLI and CI.

The mechanism a neighboring product cannot truthfully copy: Vraelis checks from outside the
application, with no SDK in the app, no test files, and no source access, so it does not inherit the
assumptions the mistake came from. Its input is one sentence about what should work, not an authored
test suite. A person approves the plan and an API key cannot, so the tool that asked for a check never
signs off on it. It returns one explainable decision with deterministic evidence, and it preserves
every verification as a separate historical record that a later run never overwrites.

## Operating Context

The loop: verify, approve, run, re-check. A claim arrives with a public https deployment URL, from the
console, the CLI (`vraelis verify --url URL --claim "..." --wait`), the API (`POST /v1/verifications`),
or an AI assistant over MCP (`vraelis_verify`). Vraelis derives the requirements and a browser plan and
returns an approval link (`app.vraelis.com/review/...`, `approve_url` in the API). A person approves the
exact plan; `POST /v1/verifications/plans/{id}/approve` refuses every API key with 403
`plan_requires_human`. The approved plan runs against the live app through a real isolated browser and
returns a decision with evidence; on failure it packages expected against observed, reproduction and
evidence as a repair prompt that goes back to whoever asked. After the fix is deployed,
`POST /v1/verifications/{id}/recheck` (`vraelis recheck`, `vraelis_recheck`) runs the same approved plan
again without a new approval, within 24 hours of the approval, at most 10 times, on the same scheme and
host. Every run, a re-check included, is billed as one verification, and each run is preserved as a
separate immutable record (`recheck_of` links a re-check to the run it repeats).

## Capabilities and Constraints

Today, live: deployed web applications, and connected devices checked through their web control
panels, driven through a real browser from outside, with a Postgres backed run queue, an isolated
browser worker, and private, owner scoped evidence reached only by short lived signed URLs. Ways in:
the console; the CLI, installed by script (`curl -fsS https://vraelis.com/install | sh`, or
`irm https://vraelis.com/install.ps1 | iex` on Windows) with `verify`, `recheck`, `result`, `init`,
`mcp`, `login`, `logout` and `status`; the v1 API for CI; and the MCP server, local (`vraelis mcp`, set
up by `vraelis init`) and hosted (`https://vraelis.com/mcp`, OAuth for ChatGPT and Claude, or an
`x-api-key` header). Signed `verification.completed` webhooks and Slack delivery carry the result.

Canonical public decision vocabulary, identical across the app, CLI, API, MCP tools, CI gate and
webhooks: **Verified, Failed, Blocked.** A targeted repair check renders publicly as Blocked until a
full verification returns Verified. The mapping lives in `lib/preflight/public-decision.ts` (ready to
verified, blocked to failed, needs_review and repair_verified to blocked).

Explicit boundaries the product does not cross today: it does not edit code; it does not diagnose the
source level cause (whoever fixes it does that, Vraelis independently re-checks the fix); it does not
read code, diffs or tool calls, or watch anyone while they work; it does not introspect payment
processors, databases, or email directly, only browser observed outcomes; for a connected device it
sees only what the control panel shows. HTTP API checks are a beta in the signed-in console only. The
CLI and the TypeScript SDK (`@vraelis/sdk` 0.3.0) are not published to npm.

Direction, not today's coverage, and labelled as such wherever it appears. Next: device level checks
that read a drone, robot or fleet directly (firmware, sensors, telemetry), and native mobile and desktop
apps; plus the gaps in the check itself listed on /platform#current. Vraelis verifies defined behaviour
against stated requirements; it does not certify that any system is safe.

Legacy terminology to retire from every public surface: "Production Pass" (old product name); the old
decision labels READY, NEEDS REVIEW, REPAIR VERIFIED; the retired human evaluation product (candidate
evaluation, audience fit, Decision Package, qualified human judgment); and, since 2026-09-28, the
category "independent verification for AI-built systems", "state what must keep working", business
guarantees as the pitch, and the Compile, Challenge and Accumulate roadmap. A guarantee remains a
console concept: a claim saved so it can be checked again.

## Brand Commitments

Name: Vraelis. Mark: the gapped ring (center is the requirement, the ring is independent
verification). Identity: light first, warm paper and emerald, shared with the authenticated
application so the public site and the product feel like one company. Type: Geist as the display and
body face, with a technical monospace for data and labels. Voice: serious, operational, and honest,
under one rule enforced across the site: every sentence describes something that works today or is
explicitly marked as direction. Taglines in use: "Say what should work. Vraelis checks it on the live
app." and, for link previews, "Checks your live app does what you say it does." Copy avoids em dashes, en dashes, middots, and dash separators (a standing user
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

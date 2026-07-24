# Design 06 — app.vraelis.com information architecture

Branch `feature/design-06-public-rebuild`. The public site now presents a truthful vision of the authenticated
app. This document maps the current product surfaces to the proposed new ones so the next implementation has a
plan. **No production app behavior is changed in this pass**, and no fake app functionality was built for
screenshots — the public product visuals are authored components that can later become real app UI.

## Current surfaces (in the repo today)

The signed-in app is organized around a single verb, "verify this outcome," with lifecycle stages inside it:

- **Systems / Applications** (`/applications`, `/systems`) — the connected apps.
- **Verifications / Passes** (`/verifications`, `/passes`) — runs and their canonical results.
- **Issues / Findings** (`/issues`) — what a run surfaced.
- **Repairs** (`/repairs`) — repair handoff and reverification.
- **Deployments** (`/deployments`) — deployment identity a run was checked against.
- **Credits / Plans / Billing** — usage and billing.
- **Developers** (`/developers`) — API keys and the verification API.
- **Account / Team / Organization** — identity and workspace.

The engine deliberately produces **run-level** decisions (Verified / Failed / Blocked) with preserved history,
reviewed plans approved once, and evidence held in a private bucket behind short-lived signed URLs.

## Proposed new surfaces (the oversight model)

The public site frames the app around **responsibility → trusted completion**. The proposed control-center
surfaces, and how each maps onto real infrastructure:

| New surface | What it shows | Built on today |
|---|---|---|
| **Work** | Every responsibility and its oversight state | Systems + verifications lists |
| **Live** | Plan, changes, tools, assumptions, evidence as they happen | Run detail + evidence (activity ingestion is direction) |
| **Review** | Human decisions and sensitive approvals | Reviewed-plan approval + separation of duties |
| **Findings** | Contradictions, missing evidence, unsafe assumptions | Issues / failures from a run |
| **Repair** | Structured handoff + independent recheck | Repairs + reverification |
| **Memory** | Requirements, failures, repairs, trusted decisions over time | New; aggregates existing records |
| **Knowledge** | Docs, method, guidance connected to active work | New; links the public knowledge system in-app |

## Reusable current infrastructure

- Reviewed-plan machinery (mint immutable plan, approve once, execute exactly what was reviewed).
- The verification launch path and run-level decision translator (`toPublicDecision`).
- Evidence storage: private bucket, owner-checked, short-lived signed URLs.
- Deployment identity (`sameDeploymentIdentity`) for "checked on this deployment."
- Webhooks (`verification.completed`) and the `/v1/verifications` API.
- Owner-scoped access and separation of duties (billing admin ≠ data owner; the building agent cannot approve
  its own proof).

## Deprecated / demoted concepts

The public **framing** no longer leads with these, though they remain real supporting mechanics:

- "Deployment verification" and "browser testing" as the whole product → one capability inside oversight.
- "Production Pass" naming, checkout-as-the-category, pricing-per-run as a headline.
- Guarantees as the entire company → responsibility/oversight is the frame; the durable requirement object
  remains a mechanic.

## Migration order (proposed, not executed here)

1. Rename the top-level nav around **Work / Live / Review / Findings / Repair / Memory / Knowledge** while
   keeping every existing route resolvable (alias, do not delete), exactly as the current shell already does.
2. Introduce **Responsibility** as the first-class object that a verification run attaches to (soft link,
   additive), reusing the reviewed-plan approval as its "approved standard."
3. Build **Memory** as a read model over existing preserved records before adding new capture.
4. Only then add **Live activity ingestion** (the direction item), which requires new agent integration.

## Truthful current / direction boundary

- **Live today:** responsibility records and reviewed standards, live execution and evidence in a real
  browser, human review, findings, repair handoff, Verified/Failed/Blocked with preserved history, and the
  API / CLI / webhooks / current integrations.
- **Direction (not shipped):** continuous agent oversight, live activity ingestion, IDE and desktop surfaces,
  agent-reliability memory, autonomy decisions, and automatic responsibility coverage.

The website build remains the primary task; this document is a plan for the next implementation, not a change
to the running app.

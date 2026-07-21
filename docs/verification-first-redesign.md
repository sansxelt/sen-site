# Verification-first redesign — deferred, not forgotten

**Status: postponed deliberately.** The homepage and the application get rebuilt around the verification
primitive immediately after `/v1/verifications` completes one real end-to-end run. Not before.

The reason is narrow and worth keeping: the endpoint exists structurally but has never taken a real sentence
through synthesis, execution and decision. Designing an interface around a flow that has not run once means
building the UI on top of unvalidated behavior, and the first real call is likely to change something about
the shape of what comes back.

## Gate

Redesign starts when all of these are true:

1. Migration 16 applied.
2. Production API-key lifecycle proof passes.
3. One real `/v1/verifications` claim executes end to end.
4. Whatever that first call exposes is fixed.
5. The broken → repair → redeploy → reverify loop completes against `demo/broken-checkout`.

Then: homepage and app. Then `/developers` made public and truthful. Then MCP.

## Homepage

Leads with the primitive, not with browser testing.

> **AI says the work is done. Vraelis proves it.**
>
> Give Vraelis a deployed system and the outcome that should be true. It independently verifies the result,
> returns evidence, and sends failures back for repair.

Primary CTA: **Verify an outcome**.

The live demo shows the loop, not a dashboard tour:

```
Claim submitted → Requirements derived → Verification running
→ Failure found → Repair completed → Reverified
```

**Support truth still binds.** The wedge is AI-built **web applications**. The page must not imply mobile,
agents, or physical systems work today. This is the standing rule from the company doctrine: no public claim
without a real failing canary behind it. A verification-first homepage makes it *easier* to overclaim,
because "any outcome, any system" is a natural thing to write and is not true yet.

## Application

Today the app is organized around internal machinery: Applications, Contracts, Passes, Runs, Issues,
Integrations. That is the vocabulary of how it is built, not of what someone came to do.

New default screen is the intent:

> **What should be true?**
>
> Deployment URL · Claim · **Verify**

Then one verification timeline:

```
Claim received → Requirements derived → Browser running
→ Failure found → Repair available → New deployment detected → Verified
```

Applications, contracts, flows, passes and connections stay, moving underneath as advanced configuration and
infrastructure.

## Two things to resolve when the work starts

**The lane application will be visible and confusing.** `verification-lane.ts` creates one hidden application
per owner, marked `builder = "vraelis_api"` and named "API verifications", to hang verification contracts
off. In a verification-first app that row appears in the applications list looking like something the user
made. It needs to be either filtered out of the list or surfaced deliberately as "verifications created by
API", and the choice should be made rather than inherited.

**"New deployment detected" implies work that does not exist.** Nothing today watches for a redeploy and
re-verifies. That is deployment hooks, which the build order puts *after* MCP. Either the timeline step is
built then, or it is drawn as a manual "verify again" until it is. It must not appear in a demo as though it
happens automatically.

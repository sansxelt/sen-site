# `POST /v1/verifications` — design notes before building

The external promise is one sentence: **give Vraelis a claimed outcome, get an evidence-backed decision.**
The caller never learns what an application, a contract, a flow, or a pass is.

Internally every one of those still exists. This note records what the mapping costs, because the pipeline
was built around a human approving each step and a claim-driven API has no human in it.

## What the dashboard does that an API caller cannot

Verified against the code, not assumed:

| Step | Today | Programmatic equivalent |
|---|---|---|
| Create app + draft contract v1 | dashboard form | `createApplication(owner, { ownershipConfirmed: true, sourcePrompt: claim })` seeds the draft contract inline |
| Discovery | fires in `after()`, response returns before it finishes | `createDiscovery` then **awaited** `runDiscovery` |
| Requirement approval | user accepts each row | `updateRequirement(owner, id, { reviewState: "approved" })` |
| Flow approval | user accepts each flow | `updateFlow(owner, flowId, { reviewState: "approved" })` |
| Contract approval | "Approve contract" button | `approveContract(owner, contractId)`, needs >= 1 enabled requirement |
| Launch | launch button | the runs route's gates |

**Discovery never produces a runnable flow.** `insertFlowSuggestions` writes `enabled: false,
review_state: "suggested"` unconditionally. `flowApprovedEnabled` requires `enabled && review_state ===
"approved"`. So an unattended verification must explicitly approve what synthesis proposed. That is the
auto-approve decision, and it is why the response has to echo the derived requirements: the caller cannot
otherwise tell whether Vraelis understood the claim before trusting the verdict.

**Ordering is not negotiable.** Approving a contract FREEZES it: `addFlow`, `updateFlow`, `deleteFlow` all
return `contract_approved` afterwards, and `updateFlow` checks `contractStatusForFlow` first. So the only
valid order is: create app -> discovery -> approve requirements -> approve flows -> approve contract ->
launch. Getting this backwards produces an app that can never run and cannot be repaired in place.

## The unresolved question: what does a verification map ONTO

This is the decision that determines everything downstream, and it exists because of a constraint that has
nothing to do with claims: **the free tier allows one application** (`FREE_TIER.maxApplications = 1`,
Builder 2, Pro 10, Scale unlimited).

- **A. One application per deployment origin, reused. Each new claim cuts a new contract revision.**
  Matches the existing model and respects app caps. Cost: every claim after the first needs the draft
  revision path (a full copy of requirements and flows at `version + 1`), and concurrent verifications
  against one origin race on that revision. Two agents verifying two claims at once is a normal case, not
  an exotic one.

- **B. One application per verification.** Simplest mapping, and each verification is cleanly isolated.
  Breaks immediately on the free tier and would need an app-cap exemption for API-created apps, which is a
  real entitlement change and a real abuse surface.

- **C. A dedicated verification lane.** Write requirements and flows directly as approved+enabled, skip the
  suggestion/merge machinery, keep applications out of it entirely. Cleanest external product and no cap
  problem. Cost: a second way to create runnable flows, which is exactly the "second authorization path"
  mistake the API-key work was careful to avoid, unless it reuses the same eligibility predicate and the
  same launch gates.

## Non-negotiable regardless of which is chosen

**One launch path.** The runs route holds every spend and safety gate inline and there is no shared launch
function. `/v1/verifications` must not reimplement them. Either the launch is extracted into a service both
routes call, or `/v1` delegates to the existing handler directly. Duplicating the gate list is how a key
ends up able to do something the browser cannot, which is the invariant the whole API-key foundation was
built to protect.

**Auto-approval must be visible.** The run and report record that no human approved the contract, and the
response always echoes the derived requirements. A confidently wrong verdict from a misread claim is the
main failure mode of this endpoint, and echoing requirements is what makes it recoverable.

**`verification_id` needs no new table.** A verification is a run. `vrf_<runId>` maps 1:1, so there is no
`v_verifications` to keep in sync with run state.

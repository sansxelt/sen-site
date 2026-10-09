# Vraelis AI security market and product direction

## Current first product research

The [October 8 market assessment](contour-market-need-and-focus-2026-10-08.md) and [neutral discovery plan](contour-customer-discovery-2026-10-08.md) update the first-product priorities below. Vraelis Contour release acceptance remains a leading hypothesis; current code fit does not establish the best purchasing opportunity. Research actual owner workflows and compare existing controls before adding runtime adapters. The broader Vraelis company scope remains unchanged.

## Accepted direction after the broader scope review

Vraelis is an independent AI cybersecurity software company in private development, covering model integrity, adversarial threats, machine trust and security evidence for defense, critical infrastructure and robotics. The company and display name is Vraelis. The existing policy core and recording evaluator are foundations, not the complete company scope. The narrow initial workflow discussed below remains an implementation hypothesis. Vraelis Contour is the working first product direction for release/platform and security engineers at robotics suppliers and integrators, not an announced deployment. See the [company and product naming decision](company-and-product-naming.md). `data.vraelis.com` is reserved for the private workspace and sign-in; public access remains closed. The public call to action is **Talk AI security**, leading to the role-specific engineering inquiry.


Vraelis should pursue a focused product hypothesis: controlling AI access and proposed changes at an operational-system boundary, with evidence an engineering reviewer can inspect. Start with one controlled engineering workflow for a robotics manufacturer or system integrator. Defense and critical infrastructure remain intended application areas, with their own qualification requirements.

The category is viable enough to investigate. Vraelis product demand, willingness to pay and differentiation are not validated. The next investment should produce an enforceable private integration and buyer evidence, rather than a broader public platform claim.

Research date: October 7, 2026. This direction supersedes the earlier browser-verification positioning and the recorded-review-only commercial hypothesis. Recorded review remains a useful component.

## Market evidence and alternatives

Joint CISA and international guidance published December 4, 2025 addresses secure AI integration in operational technology. It calls for assessing whether AI is appropriate, assigning responsibilities, protecting operational data, maintaining oversight and testing integration against existing operating constraints. This establishes a recognized problem; it does not establish demand for Vraelis. [Secure integration of AI in OT](https://www.cyber.gov.au/publication/principles-for-the-secure-integration-of-artificial-intelligence-in-operational-technology).

The competitive field already covers much of the broad idea:

| Alternative | Publicly described scope | Implication for Vraelis |
| --- | --- | --- |
| [Cisco AI Defense](https://www.cisco.com/c/en/us/products/collateral/security/ai-defense/ai-defense-ds.html) | AI discovery, supply-chain checks, validation and runtime protection, including agent and MCP interactions | Tool-call security and runtime policy are existing categories. |
| [HiddenLayer Runtime Security](https://www.hiddenlayer.com/platform/ai-runtime-security) | Agent visibility, threat detection, inline policy protection and investigation integrations | Monitoring, blocking and reconstructing agent behavior are not sufficient differentiation. |
| [Palantir AIP and Ontology](https://www.palantir.com/docs/foundry/platform-overview/overview) | Governed actions, conditional user and agent permissions, proposals and captured outcomes | The proposed control-and-evidence workflow has substantial overlap with established operational platforms. |
| [Nozomi Networks](https://www.nozominetworks.com/platform) and [Claroty](https://www.claroty.com/claire) | Industrial visibility, access, detection, response and AI-assisted security operations | OT buyers already have vendors, integrations and budgets. Vraelis must fit an identified gap in that environment. |
| [Cedar](https://docs.cedarpolicy.com/auth/authorization.html), existing IAM and custom engineering controls | Principal, action, resource and context authorization plus existing change procedures | The strongest competitor may be the buyer's existing stack. A new product must improve the complete workflow. |

These are documented vendor capabilities, not independent performance comparisons. AI used to help a security team is also distinct from security controls governing an AI workload. Neither should be assumed absent from a competitor without technical evaluation.

### First buyer hypothesis

Start with an engineering or security lead at an industrial robotics manufacturer or system integrator introducing an AI assistant into an engineering workflow. The candidate trigger is access to operational telemetry or proposed configuration/model changes crossing an approval boundary. The owner needs to explain who authorized a specific action and reconcile its reported result.

This buyer is a hypothesis. Validate access to a test environment, an accountable integration owner, a consequential authorization gap and a budget owner before broadening into utilities or government programs. Qualification for a government deployment is program-specific; a website checkbox is not an acquisition or legal eligibility decision.

### Commercial decision gates

Conduct an initial, proposed discovery round with eight engineering/security owners across manufacturers and integrators. Ask about the most recent real approval or investigation problem, the present control, time spent, who can sponsor integration and what they would replace. Request sanitized workflow descriptions, not sensitive operational data.

Continue only if at least three independent organizations describe a substantially similar unresolved workflow and at least two can identify a test owner and the conditions for evaluating a future implementation. These are decision thresholds chosen for this discovery round, not market statistics. Commercial validation requires a budget owner and a concrete willingness-to-pay discussion after a working private integration exists.

Stop or narrow the idea if existing IAM/change procedures solve the issue cheaply, owners cannot expose a meaningful enforcement boundary, or each integration requires a different product. A review-only opportunity should be evaluated separately rather than presented as preventive security.

Build revenue estimates from reachable qualified organizations, buying probability and a validated annual contract value. Include integration, support, protocol maintenance and evaluation costs in gross margin. Broad AI-security market estimates cannot establish this product's serviceable market or price. Do not publish subscription tiers before the scope and ongoing cost are understood.

## Product hypothesis and first workflow

The first private integration should support scoped telemetry reading and an independently approved change to a non-actuating test resource. Keep the underlying equipment control and safety mechanisms outside this initial scope.

The owner defines an allowed workload, environment, resource, action and reviewed model artifact. The AI workload proposes an action. A trusted boundary authenticates the request and evaluates current policy. A separately authorized person approves the exact consequential proposal. Dispatch rechecks authority and consumes approval once. Review connects the decision to the available observations and their gaps.

A model deployment or configuration update is a candidate test change; select one after confirming the actual interface. Do not begin by attempting universal device commands, autonomous safety decisions or arbitrary industrial protocol support.

### Existing foundation

The repository currently contains a deterministic private policy evaluator and supported-recording review. On October 7, 2026, verification passed 48 policy checks, 28 recorded-review checks and 18 native MCAP checks.

Policy checks use synthetic trusted contexts. The core does not authenticate identities, verify artifact signatures, atomically consume approvals or dispatch actions. The recording evaluator qualifies supported reported-state criteria from supplied evidence; it does not independently establish physical truth. Native MCAP support is limited to the reviewed uncompressed JSON mapping, not arbitrary ROS/CDR or compressed formats.

Relevant implementation: `lib/ai-security/policy.ts`, `lib/recorded-verification/evaluate.ts` and `lib/recorded-verification/mcap.ts`. Existing boundary descriptions remain in `docs/ai-security-foundation.md` and `docs/recorded-verification-v1.md`.

After the independent review, the private model-release experiment implements a narrower local control with authenticated signing identities, signed model/configuration manifests, separate approvals and transactional activation of a numeric reference model. This is additional engineering evidence, not a production identity/attestation adapter, protection against adversarial sensor input or commercial validation.

## Build the first integration well

Prefer established security primitives. [NIST SP 800-207](https://www.nist.gov/publications/zero-trust-architecture) distinguishes policy decisions from enforcement. [SPIFFE](https://spiffe.io/docs/latest/spiffe-about/overview/) provides workload-identity standards; [Cedar](https://docs.cedarpolicy.com/auth/authorization.html) provides authorization semantics; [Sigstore](https://docs.sigstore.dev/cosign/verifying/verify/) documents artifact signature verification. These are candidates to evaluate against the owner's environment, not integrations Vraelis already supports.

1. **Establish trusted context.** Verify the issuer, workload/session binding, expiry and revocation through the chosen identity source. Verify the actual artifact and expected signer. The request must not supply its own trusted identity, verification flag or approval privileges.
2. **Bind the full operation.** Compute a canonical action digest inside the trusted boundary. Bind target, operation, payload, environment, model digest, policy content/version and expiry. Keep untrusted text outside authorization fields.
3. **Separate approval.** Authenticate an authorized human approver. Prevent self-approval. Recheck policy and revocation immediately before dispatch. Persist and atomically consume approvals so parallel requests cannot dispatch twice.
4. **Control execution.** Put resource credentials behind a non-bypassable adapter. A returned permit is not an execution token. Use an idempotent target interface or reconciliation where possible. Do not claim exactly-once physical effects across crashes or uncertain network outcomes.
5. **Retain useful evidence.** Record the proposal, authenticated bindings, policy basis, approval, dispatch status and qualified observations. Separate accepted, dispatched, reported-complete and independently observed states. Define access, retention and deletion with the owner.
6. **Qualify operating behavior.** Test latency, outages, restart/recovery and revoked authority. Deny new unauthorized proposals while preserving the owner's established automation and safety mechanisms. Determine safe behavior per system.

Authorization cannot replace model-accuracy testing, adversarial-perception evaluation or functional-safety controls. NIST's [adversarial ML taxonomy](https://www.nist.gov/publications/adversarial-machine-learning-taxonomy-and-terminology-attacks-and-mitigations-0) distinguishes attacks by lifecycle, model type and attacker objective; test cases should follow the actual threat path.

### Acceptance gates for the private integration

| Gate | Required evidence |
| --- | --- |
| Allowed work | The exact authorized test action succeeds, with its decision and target response retained. |
| Unauthorized work | No dispatch in the defined wrong-workload, wrong-resource, wrong-action, expired, revoked or changed-proposal cases. |
| Approval reuse | Concurrent submissions cannot produce a second dispatch from the same approval. |
| Bypass | Direct access with workload credentials cannot evade the adapter. |
| Recovery | Crash/retry and ambiguous target outcomes remain explicit; reconciliation prevents blind redispatch. |
| Review | Another engineer can trace the decision to policy, approval, source events and declared capture gaps. |
| Practical fit | Measure authorized-task success, incorrect denials, p95 authorization latency, integration hours and reviewer time against the current workflow. Set operating thresholds with the owner before evaluation. |

These gates need an implemented boundary and reproducible integration tests. Passing the current pure-function tests does not satisfy them.

## Public website and imagery

[Scale](https://scale.com/) connects its copy to identifiable application areas, customer work and product destinations. [Anduril](https://www.anduril.com/lattice/command-and-control) describes specific operational capabilities. Their company-specific product images and evidence cannot be replaced with invented Vraelis screens or borrowed customer claims.

Use bright, licensed editorial photography to establish the physical setting. Pair it with concrete security boundaries and audience-specific constraints. Preserve the photographic homepage sequence and mobile image readiness. Remove synthetic models and app demonstrations rather than removing useful page imagery.

The main action is **Talk AI security**. It opens the role-specific engineering inquiry, with prompts suited to the selected audience. It communicates a next step available today and does not offer product access, a demonstration or a deployment program. General and privacy inquiries remain available through normal contact navigation.

Public copy should distinguish the private components, next integration and wider research. The uploaded architecture's modularity and observability are useful starting principles, but autonomous changes to security policy or model authority should not be treated as approved design. The uploaded market percentages remain research leads; they are not used as verified market evidence.

## Next decisions

The [independent product review](vraelis-independent-product-review-2026-10-07.md) sharpens the first investment into a bounded model-release enforcement experiment, with artifact integrity as an input, comparison against existing controls and buyer evidence before expansion. It preserves dissent on discovery-first timing and bounded adversarial evaluation rather than treating AI agreement as market validation.

Choose the test resource and identity environment. Obtain buyer evidence before committing to broader integrations. Complete the boundary and acceptance gates before opening the console. Then decide whether action enforcement, evidence review or a smaller integration product creates enough repeatable value to support a business.

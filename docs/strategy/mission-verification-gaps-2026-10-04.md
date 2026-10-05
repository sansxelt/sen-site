# Mission software verification: gaps to validate

Research date: October 4, 2026. Internal product assessment, not a claim of certification or market exclusivity. Read with [the defense product direction](defense-product-direction-2026-10-04.md) and [the Palantir assessment](palantir-ontology-and-market-focus-2026-10-04.md).

## What already exists

Independent verification is an established discipline. Defense positioning does not make browser automation a new category.

| Primary source reviewed | Existing capability | Implication for Vraelis |
| --- | --- | --- |
| [VectorCAST](https://www.vector.com/en/product/vectorcast/) | Automated unit and integration testing for C, C++ and Ada; coverage, requirements traceability, regression testing and qualification packages for safety standards | Do not compete by claiming incumbents lack rigorous verification or traceability. Vraelis currently exercises browser workflows, a different and narrower surface. |
| [Ansys SCADE Suite](https://ansys.synopsys.com/products/embedded-software/ansys-scade-suite) | Model-based development of critical embedded software, simulation, verification and qualified code generation | Vraelis is not an embedded verification or certification replacement. The difference between browser-reported state and physical behavior must remain explicit. |
| [Playwright assertions](https://playwright.dev/docs/test-assertions) | Positive and negative assertions, retried assertions and arbitrary test procedures | Checking that unrelated state remains unchanged is already expressible in existing tools. The opportunity must be demonstrated in setup effort, reliable execution and useful evidence. |
| [Checkly Playwright support](https://www.checklyhq.com/docs/detect/synthetic-monitoring/browser-checks/playwright-support/) | Running Playwright tests as browser checks | Real-browser execution on its own is not differentiated. |
| [Palantir Ontology](https://www.palantir.com/docs/foundry/ontology/overview/) and [Action test runs](https://www.palantir.com/docs/foundry/action-types/test-run/) | Operational object models, actions and action previews, alongside SDKs, tests and evaluation tools | Treat Palantir as a capable platform, not a missing-verification strawman. A potential integration must prove value beyond its existing tools. |

These sources establish overlap, not the full limits of each vendor. LDRA returned HTTP 403, the attempted Jama page returned 404, and the retrieved dSPACE page had insufficient substantive content. No absence claim is based on those failed or incomplete reads. The attempted Parasoft defense URL redirected to a general industries page and was not treated as a defense product comparison.

## A concrete problem worth testing

**An approved action changes the intended state, but also changes something that should have stayed untouched.**

The existing Larkspur record gives a small, browser-only example: confirming one simulated contact also changed the reported status of another. It supports one demonstration of an unintended UI state change. It does not establish demand, general reliability, access to real defense systems or detection of physical behavior.

The product hypothesis is that a reviewer can supply the expected change and the states that must remain unchanged, approve an explicit plan, and receive evidence connecting the requirement to before-and-after observations. This is useful only if it catches failures that the buyer's current workflow misses or makes that workflow materially cheaper to operate.

## Built, partial and proposed

| Capability | Current status | Next evidence needed |
| --- | --- | --- |
| Approved requirement and browser plan, recorded steps, finding and re-check | Existing workflow; Larkspur supplies a recorded simulated example | Repeat on a buyer-controlled unclassified staging app, with reproducible failures and repairs |
| Assertions about other visible entities after an action | Demonstrated in the existing simulation; not an exhaustive automatic discovery system | Compare explicit positive and negative requirements against a hand-written test suite |
| Values unique to each run | Worker substitution exists; fixed-value guards are limited to some launch paths | Enforce and verify across every supported launch path before claiming universal protection |
| Correlating UI results with API responses and device telemetry | Proposed; connected-source metadata does not imply a working data reader | A bounded, read-only integration with independently captured timestamps and source identity |
| Evidence tied to a precise build, environment, role and observation period | Incomplete; do not imply universal binding | Verify immutable identities, changed-build rejection and clearly stated unexercised conditions |
| Native hardware, private networks, classified operation or certification | Not established by the current browser product | Separate engineering, deployment and procurement validation; not a website promise |

## Smallest useful experiment

Use one unclassified mission-app simulation or staging workflow. Define the intended change and a short list of states that must not change. Compare Vraelis against the team's existing test procedure on known faulty and corrected builds.

Measure:

- Time to write, approve and maintain the verification.
- Detection and false-pass rates for unintended changes, stale state and an exercised permission boundary.
- Whether a reviewer can reproduce the finding from the record without asking its author for an explanation.
- Cost and latency per useful result, including failed attempts and human review.
- Whether the team requests repeat runs and will pay for the workflow.

Use independently prepared faults and blind evaluation; the builder must not decide which examples count as success. A small pilot cannot establish safety certification or universal end-to-end correctness.

## Decision

Keep the site's promise narrow: external verification of mission apps and web control panels, with approved requirements and recorded evidence. Research the ease and reliability of proving what must stay unchanged. Do not call that feature unique until a broader competitive assessment and buyer comparisons support it.

A large business would require recurring, valuable verification across many releases and systems. A dramatic defense homepage can explain the stakes, but repeat use, credible evidence, integration depth and a feasible buying process have to establish the business.

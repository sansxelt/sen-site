# Defense product direction

Decision date: October 4, 2026. Founder-selected direction; supersedes the broad-market-first recommendation in the two preceding strategy assessments. Competitive findings and capability limitations from those assessments remain valid.

**October 5 update:** the founder broadened the focus to software for physical systems, including robotics, fleets and industrial equipment alongside defense. The current recommendation and implementation boundaries are in [Physical systems product research](physical-systems-product-research-2026-10-05.md).

## The decision

Defense is Vraelis's primary market and public homepage positioning. Focus product development on verification for mission applications and operator web control panels. The browser engine is reusable across other software, but its breadth is not the leading sales story.

This is a deliberate specialization decision, not evidence that defense demand, procurement readiness or a competitive moat have been proven. It does not impose a new account-eligibility rule or retire working APIs. Existing general-purpose routes and documentation remain accessible while the core proposition is validated.

## The product idea

**A mission requirement becomes an approved check, an observed result and a reviewable evidence record.**

Vraelis independently exercises the workflow and checks the reported state against the approved requirement. A successful run establishes that the checked conditions held in that environment. It cannot establish that an entire mission system is safe or that hardware obeyed a command it never observed.

The immediate product should answer four questions clearly:

1. What behavior was required and who approved that interpretation?
2. Which deployed app, role and environment were exercised?
3. What actually happened at each step, including failures and anything not observed?
4. After a fix, did the same approved requirement hold without weakening the check?

That is the core idea to validate. 3D views, configurable panels and integrations are useful only when they improve these answers.

## Current boundary and next work

| Area | Position |
| --- | --- |
| Mission apps and web control panels | Current browser engine; start with authorized, unclassified staging and simulated-console workflows. |
| HTTP APIs | Existing signed-in beta; mature through consenting customer pilots before presenting it as a release gate. |
| Command receipt, device telemetry and firmware | Direct verification is not built. A displayed state is not independent evidence of a physical result. |
| Customer SDKs/libraries and native applications | Direct execution is not built. A web app using an SDK can be exercised. |
| Private networks and on-premises deployments | Not supported by the current public-HTTPS execution path. Validate a specific buyer requirement before designing an isolated runner. |

Prioritize trustworthy scope, deployment identity, role coverage, fresh state and clear failure evidence before another visualization layer. Next, validate which downstream evidence is missing on actual console workflows. Build one scoped evidence reader only when it materially improves the answer; a stored credential or an asset graph alone adds no verification capability.

An initial practical demonstration is a browser workflow with an independently seeded defect: a permission boundary violated, a setting that does not persist, or a reported state that contradicts the stated requirement. Use the current Larkspur example as a demonstration, not as proof of customer demand or operational deployment.

## Relationship to Palantir Ontology

The Ontology assessment remains relevant. Palantir models operational entities and actions and has action-testing, function-testing and AI-evaluation capabilities. A generic connected-system graph is therefore not a workaround or differentiator.

The hypothesis to test is a narrower verification workflow that works on the customer's deployed mission app, records the approved expected behavior and observed result, and produces useful independent evidence without requiring the customer to replace its operational data platform.

A future authorized Foundry integration could make Vraelis complementary to an Ontology-backed application. That does not establish that Palantir lacks the same capability, and there is no built Palantir connector to advertise. Any comparative advantage must be measured against the buyer's actual alternatives.

## Market and validation

Defense customers can include private contractors, defense-software and robotics companies, research/test institutions, and government teams. “Defense” is a specialization, not a synonym for “private institutions.” Individual developers working on eligible defense software can still be users.

Start with a narrowly repeatable console-verification problem and consenting teams that already experience it. Proposed learning gates: three independent eligible teams reporting the same recurring problem, at least two paid repeat pilots, and a credible deployment/procurement path. These are targets, not achieved results, and do not alter the earlier frozen benchmark protocols.

Track owner setup time, finding reproducibility, false passes, false alarms, coverage, provider cost and whether the evidence changes a release decision. A trusted record matters more than a theatrical military theme.

Government-facing adoption requires verification of applicable data-handling, model-provider and procurement requirements. This decision grants no clearance, certification or authority to accept restricted data, and changes no execution boundary.

## Immediate implementation

The homepage statement now leads with external software verification for defense teams. The homepage subject orbit emphasizes mission consoles, aviation, robotics, logistics and government instead of banking, ordinary SaaS and AI-built-app tiles. The existing tagline and recorded demonstration remain in place. Search description/category copy reflects the same focus.

No execution capability, pricing, approval policy, user eligibility or claimed operational deployment changes with this positioning update. General-purpose solution pages remain available; further navigation consolidation should follow the validated defense product story rather than deleting capabilities to signal a pivot.

References: [earlier product assessment](product-opportunity-2026-10-04.md), [Palantir Ontology assessment](palantir-ontology-and-market-focus-2026-10-04.md), shared public coverage and scope under `app/dev-preview/v6/_content/`, and `lib/preflight/api-beta-gate.ts`.

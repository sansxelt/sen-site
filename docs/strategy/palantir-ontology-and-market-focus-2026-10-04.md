# Palantir Ontology and Vraelis's market focus

Assessment date: October 4, 2026. Recommendation based on retrieved Palantir documentation and the current Vraelis repository, not a hands-on Palantir benchmark or customer interviews.

## Decision

**Keep access broad. Focus the first paid growth experiment on release verification for SaaS, web applications and browser-visible business workflows. Pursue defense and robotics as narrow, unclassified software-console pilots, not as the exclusive company identity.**

Individual developers, freelancers and small businesses remain eligible customers. The initial paying customer should have a consequence attached to a failed release: lost access, lost work, broken payment entitlement, or a client delivery that cannot be accepted. A military theme does not establish military demand.

This recommendation updates the earlier assessment with usable Palantir documentation. The first review reached only a client-rendered marketing shell; that was a research limitation, not evidence of missing Palantir capabilities. The documentation now reviewed shows substantial overlap with the larger operational-platform ambition.

## What Ontology does, and why the concern is legitimate

Palantir's [Ontology overview](https://www.palantir.com/docs/foundry/ontology/overview/) describes an operational layer connecting integrated datasets, virtual tables and models to real-world entities. It includes semantic elements—objects, properties and links—and kinetic elements—actions, functions and dynamic security. It is used for organizational decision-making, including physical assets, customer orders and financial transactions.

The [Actions documentation](https://www.palantir.com/docs/foundry/action-types/overview/) describes governed edits, business logic, validation and side effects. The [Ontology SDK](https://www.palantir.com/docs/foundry/ontology-sdk/overview/) exposes Ontology access to external applications through TypeScript, Python, Java and an OpenAPI specification. It is not limited to military maps or to an interface inside Palantir.

Palantir also has real verification and evaluation capabilities:

| Source | Documented capability | Competitive implication |
| --- | --- | --- |
| [Action test runs](https://www.palantir.com/docs/foundry/action-types/test-run/) | Simulates saved action configuration, checks permissions/submission criteria, shows proposed object edits and execution details | “We show what an action would change” is not a new category. |
| [Function unit testing](https://www.palantir.com/docs/foundry/functions/unit-test-getting-started/) | Jest-based TypeScript v1 function tests, including tests run on commit; related guides cover Ontology edits and searches | Palantir already has an internal testing story. |
| [AIP Evals](https://www.palantir.com/docs/foundry/aip-evals/overview/) | Expected-output cases, evaluation functions, model/version comparisons and variance analysis for LLM-backed and code-authored functions | AI evaluation is an incumbent capability, not a missing layer we can simply claim. |
| [Ontology branching](https://www.palantir.com/docs/foundry/ontologies/branching-ontology/) | Branching, review/proposals and merge checks for Ontology changes | Reviewed changes and governance are not unique to Vraelis. |
| [Ontology design validation](https://www.palantir.com/docs/foundry/ontology/ontology-design-validation/) | Consequential business-question drills, participant testing and repeated evaluation of whether the model supports actual decisions | Even fresh perspectives and outcome-oriented validation appear in Palantir's own guidance. |

**The largest collision is with a Vraelis strategy of building a general graph of assets, data, commands, permissions and operational decisions.** That would compete with Palantir's central platform investment, as well as specialized robotics platforms. A connected graph, 3D map, SDK or configurable console is not a moat by itself.

It does not follow that Ontology replaces every use case of a lightweight verifier for an independently deployed website. The documented scope is primarily Foundry/Ontology-backed workflows. However, this research does not establish that Palantir lacks broader external end-to-end testing, nor that it could not add or bundle it. Do not position Vraelis using an unverified claim that Palantir “cannot verify.”

## A concrete distinction worth testing

Palantir's action test-run documentation says Ontology edits are not committed in a test run. Post-application side effects such as side-effect webhooks, notifications and scheduled builds are skipped. It also explicitly says some external calls required to calculate the action result do execute and can affect external systems after acknowledgment.

That creates a precise question, not a blanket competitive dismissal:

> After a real authorized action on a staging system, did the required customer or operator outcome actually occur across the relevant systems?

For example, did a test purchase grant usable access that survives a new session? Or did a staging-console change produce the expected reported state and retain it after refresh? The second example still concerns the screen, not physical execution by a device.

A dry-run preview alone cannot prove side effects it deliberately skips. But Vraelis's browser-only evidence cannot prove invisible downstream outcomes either. The stronger cross-system product would need scoped readers, correlation identities, time bounds and expected-state assertions; those are not currently established across arbitrary systems. Other competitors can also test multi-system outcomes, so the question remains whether Vraelis is faster, more reliable or more useful for a specific buyer.

## Separate the audience, the thing verified, and the entry point

These are three different product dimensions. Someone having an SDK does not mean Vraelis can directly test that SDK; someone calling our API does not mean their application is itself an HTTP API.

| Customer wants checked | Current Vraelis position | Keep in the market? |
| --- | --- | --- |
| SaaS or a web application | Browser execution of approved flows, with recorded evidence | Yes; primary initial paid-use experiment. |
| A website | Browser-visible behavior on public HTTPS; a static page still needs a meaningful expected outcome | Yes; no separate military eligibility requirement. |
| An HTTP API | Signed-in beta runtime; not established as a mature external-customer release gate by the audited source | Yes, explicitly beta; validate with real API pilots. |
| A customer's SDK/library | Direct sandbox execution of library examples is not built; a web app using the SDK can be exercised | Future capability, not a live claim. |
| A native app | Native binary execution is not built; a web version is within browser scope | Future capability. |
| A defense/robotics web console | Browser-visible behavior, on eligible public staging/simulation endpoints | Yes, specialist pilot; does not prove firmware, command receipt or physical safety. |
| A robot, drone or connected device itself | Direct telemetry/firmware/device verification is not built | Future capability, not current coverage. |

Customers can access today's verifier through the console, CLI, public verification API and MCP. Vraelis's own TypeScript SDK exists in source but is not published to npm. That distribution gap is separate from the missing ability to execute a customer's SDK test examples.

## Why not go defense-only now?

1. The working browser engine applies to SaaS and ordinary web workflows today; defense exclusivity would discard those users without evidence of better demand.
2. A defense-only promise increases the importance of private networks, procurement, data handling, exact deployment identity and device/simulator evidence. Several of those capabilities are missing or not established.
3. Palantir, Applied Intuition and Foxglove make defense/physical-system differentiation harder, not automatically easier. Avoiding mabl and TestSprite does not avoid competition.
4. No paid defense pilot, retention evidence or privileged channel was established in this assessment. Without one, choosing a market because the imagery looks stronger is a weak decision rule.
5. A small team needs a repeatable workflow before multiple execution runtimes. Keep the initial implementation and acquisition experiment narrow even while allowing broad self-service access.

Defense can become the focus if evidence changes. A useful proposed gate is three independent eligible console teams with the same recurring requirement, at least two paid repeat pilots, and a feasible technical/procurement path. These numbers are new learning gates, not evidence collected and not replacements for the existing preregistered benchmarks.

## What to build and measure next

Maintain the existing approved-plan/evidence loop and test it against real applications. Run the existing market-validation protocol with developers, agencies and small SaaS teams. Use a small defense-console discovery track only when qualified prospects are available; do not launch another runtime to create the appearance of demand.

Measure: first valid decision time, owner setup effort, false verified outcomes, false alarms, repeated release usage and delivery cost. Compare against existing testing tools and a human smoke test. Add a Foundry-backed staging comparator only if a consenting organization supplies access and the relevant workflow; documentation review is not a benchmark result.

If buyers want release acceptance evidence, prioritize trustworthy scope/build binding, freshness enforcement across launch paths, and a usable recipient report. If they repeatedly need invisible downstream evidence, build one reader for the system that causes that specific failure. Do not start with an Ontology replacement, a general live battlefield map or dozens of disconnected credentials.

The possible long-term product is a portable verification record spanning the systems a customer already uses. Whether that becomes a valuable company depends on repeat demand, verified reliability, unit economics and distribution. This review establishes neither an uncontested category nor a billion-dollar valuation.

## Website consequence

Keep the current inclusive homepage statement. Do not pivot to defense-only copy or claim mature API, SDK, native or direct-device support. On product coverage surfaces, retain the live/beta/not-built distinction. If customer evidence earns a specialist defense focus, then revise the homepage, sales motion and product investment together.

## Research limitations

This review retrieved documentation, not private product access. Vendor documentation establishes documented capabilities, not comparative quality or customer willingness to pay. Three initially guessed documentation paths returned a 404; their correct linked replacements were retrieved and cited above. Palantir's marketing Ontology page still returned a client-rendered shell, so the comparison relies on its substantive official docs.

Internal sources: `docs/strategy/product-opportunity-2026-10-04.md`, `app/dev-preview/v6/_content/coverage.ts`, `app/dev-preview/v6/_content/scope.ts`, `lib/preflight/api-beta-gate.ts`, `lib/preflight/connection-display.ts` and `sdk/typescript/README.md`.

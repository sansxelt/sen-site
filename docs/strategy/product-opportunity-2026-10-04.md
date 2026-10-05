# Vraelis: product opportunity and validation plan

Assessment date: October 4, 2026. This is a strategy assessment, not a promise of features, revenue or valuation.

## Decision

Keep Vraelis accessible to individual builders, freelancers and small businesses. Start the paid growth experiment with people responsible for a working release: independent developers with paying users, agencies delivering to clients, and small product teams. Keep defense, robotics, finance and public-sector workflows as expansion opportunities. A person's company size is less useful than whether a failure costs them something.

The opportunity is **a trusted release decision backed by an approved requirement and observed evidence**. This is a hypothesis to prove against competing products, not an unoccupied category. Do not build a general military operating platform, another mapping engine, or an integration directory to avoid testing the core proposition.

The most useful next work is a comparative benchmark and paying repeat usage. More cinematic imagery cannot establish either.

## Research method and limits

Reviewed live vendor product pages and selected pricing/docs pages, alongside current repository execution code, public scope, integration-consumer descriptions and earlier experiment plans. Sources below are primary vendor sources. Vendor capabilities and performance numbers are their claims; no competitor product was executed, purchased or benchmarked for this assessment. Extracted page text was stored locally under `/tmp/vraelis-market` during the review.

This audit does not establish current production migration state, a working fresh-account checkout-to-verification journey, customer revenue, retention, or product-market fit. Older repository documents disagree with newer code in places. Where they disagree, this assessment names the discrepancy rather than treating either as proof of live readiness. No production data, billing, credentials or customer systems were changed for the research.

## What the market already offers

| Product | What its source currently advertises | Implication for Vraelis |
| --- | --- | --- |
| [mabl](https://www.mabl.com/) | An “independent verification layer between build and release,” web/mobile/API workflows, and requirements-to-results evidence | Independence, critical workflows and evidence are already direct competitor positioning. |
| [TestSprite](https://www.testsprite.com/) | Real-browser and live-API execution; code/PRD context; failure evidence and suggested fixes; CLI/MCP; scheduled and PR-triggered runs | The agent-to-verifier-to-repair loop and testing the running app are already crowded. |
| [Momentic](https://momentic.ai/) | Plain-English tests, recordings, repair and maintenance agents, application context, and a separate reviewer for AI action outcomes | Natural language, fresh review and screenshots are not defensible alone. |
| [QA Wolf](https://www.qawolf.com/) | Deterministic Playwright/Appium generation, web/mobile execution, email/SMS workflows, deploy-triggered parallel runs and a service offering | Teams can buy outcomes rather than configure tooling; multi-system testing is not new. |
| [Checkly](https://www.checklyhq.com/) | Playwright browser and API synthetic monitoring, developer/agent workflows, alerts and private locations on applicable plans | Deployment-grounded checks and continuous operation are established capabilities. |
| [Datadog Synthetics](https://www.datadoghq.com/product/synthetic-monitoring/) | Browser/API synthetic tests and monitoring integrated with observability | Large teams have an incumbent route for testing plus diagnosis. |
| [Applitools](https://applitools.com/) / [Testim](https://www.testim.io/) | Visual AI, natural-language or codeless authoring, resilient UI automation and integrations | Visual checking, authoring convenience and selector resilience are mature areas. |
| [Browserbase](https://www.browserbase.com/) / [Stagehand](https://docs.stagehand.dev/) / [Playwright](https://playwright.dev/docs/intro) | Browser infrastructure and automation primitives | Execution infrastructure is buyable. Vraelis must create value above its browser provider. |
| [Foxglove](https://foxglove.dev/) | Live/recorded robotics data, MCAP/ROS tooling, custom panels, SDK/API/webhooks and deployment flexibility | Robotics visualization and telemetry already have specialized suppliers. Integrating evidence is a more plausible first move than replacing them. |
| [Applied Intuition](https://www.appliedintuition.com/) | Vehicle intelligence, autonomy and physical-AI tooling across automotive and defense | A full simulator/physical-system verification strategy means entering a different, technically demanding market. |

Palantir's AIP page returned essentially a client-rendered shell, and the requested Anduril Lattice URL redirected to a shell. They were not usable feature evidence in this review and are not scored as absent competitors.

### Price pressure

Retrieved pages show substantial entry-level competition: [Checkly](https://www.checklyhq.com/pricing/) displays a free plan with 1,000 browser checks and 10,000 API checks, [Momentic](https://momentic.ai/pricing) displays 2,000 free monthly credits with an approximate 200-run illustration, and [TestSprite](https://www.testsprite.com/pricing) displays a free monthly-credit plan and paid entry tiers. Billing toggles, discounts, credits, checks and runs are different units. These figures are not an equivalent-cost comparison.

Vraelis's one lifetime free verification and $15 pay-as-you-go run need a demonstrable value advantage or a lower-friction first experience. Keep current prices during the pilot; measure value and real cost before changing them. A generous competing free tier is a reason to test the funnel, not a reason to give away unbounded browser/model spend.

## What Vraelis actually has

“Implemented” below means found in repository code or supported by an existing recorded demonstration. It does not mean independently retested against a new customer's live system during this audit.

| Capability | Evidence and actual boundary |
| --- | --- |
| Requirement-to-browser execution | `lib/preflight/reviewed-plan.ts`, `worker/preflight/execute-run.ts`, and `worker/preflight/providers/browserbase.ts`: approved plans, bounded execution and observations. A successful run proves the checked conditions, not every property of the application. |
| Evidence and repair loop | Recorded before/after Lumen Notes runs referenced by `app/dev-preview/v6/_content/research-figures.ts`; reports and rechecks exist. These are demonstrations, not a broad customer benchmark. |
| Console, CLI, public API, MCP and signed notifications | Listed in shared `app/dev-preview/v6/_content/scope.ts`; integration uses described in `lib/preflight/connection-display.ts`. Signed webhook delivery is a capability; a notification integration is not evidence of downstream business state. |
| Device control panels | Browser-visible dashboard behavior is in scope. Nothing directly reads firmware, sensors, telemetry or actual command receipt. A simulation does not validate an aircraft or robot. |
| HTTP API runtime | Execution code exists under `lib/preflight/runtime/api-*`; `lib/preflight/api-beta-gate.ts` explicitly labels it a signed-in beta without an external customer end-to-end run established there. Keep it beta until real pilot evidence supports promotion. |
| TypeScript SDK | Source exists; `sdk/typescript/package.json` is private and README says it is not published to npm. Source code is not a public installable distribution. |
| Integration consumers | Some connections supply deployment identity or requirement hints. `custom_auth` and `openapi` are explicitly stored context, not active verification readers. Supabase metadata/OAuth project discovery is not database-row verification; a Stripe label is not payment-ledger reconciliation. |
| Fresh state within a run | `{{unique}}` is generated by synthesis and substituted by the worker; the guarantee verification route rejects certain risky fixed-value assertions. Public scope still describes this as wholly missing, which understates the implementation. However, that refusal is explicitly limited to the guarantee lane, and a universal freshness guarantee across launch paths is not established. |

### Missing or not yet established

- A secure, revocable client report link suitable for a recipient without an account. Existing team/report-viewer roles are not the same as a tokenized external report. No public sharing route was located in the audited API paths.
- Automatic deployment-event verification. CI can ask for a run; that is different from Vraelis watching new deployments itself. Shared scope explicitly says no watcher exists.
- A product-integrated rehearsal that catches non-runnable plans before approval. The rehearsal is currently described as an operator script.
- Strong, consistent binding between a decision and exact deployed bytes. A mutable URL plus manually supplied commit metadata is not proof of which artifact served the request.
- Universal fresh-state checks, explicit skipped/unobserved requirements, and comparable reliability metrics across customer applications. Some foundations exist; the end-to-end assurance claim still needs proof.
- Direct downstream evidence readers for payment entitlement, email delivery, queues or device telemetry. A connected credential is not a reader and a reader is not an outcome assertion.
- Native mobile/desktop execution, on-premises/private-network execution and direct device verification.
- A large, consented and adjudicated failure dataset, externally reproduced benchmark results, paid retention or procurement readiness. None was established in this audit.

Do not announce these as shipped. Do not publish a completion date before validating their cost and demand.

## What is viable, and what needs proof

| Direction | Assessment | First test |
| --- | --- | --- |
| Individual builders and small businesses | Viable access audience; payment is more plausible when the app has users, revenue or a client | Observe setup and repeat usage from developers with consequential releases. Do not assume all hobbyists need a paid plan. |
| Agency/client acceptance evidence | Plausible initial paid workflow | Ask whether the record changes a handoff or payment decision; pilot existing reports before building an external-sharing feature. |
| Release verification for small teams | Plausible, highly competitive | Compare first valid verdict, noise and repeat setup against TestSprite, Checkly/Playwright and a human smoke test. |
| Finance/commerce outcome checks | Plausible now for browser-visible test-mode flows | Measure paid-access persistence and other approved outcomes on consenting staging apps. No compliance-certification claim. |
| Robotics/defense web consoles | Plausible narrower pilot, not established demand | Find unclassified simulator or staging-console teams and test panel-state failures. Do not connect operational weapons or infer physical safety from the UI. |
| Browser plus downstream evidence | Promising hypothesis, not empty market | Count failures invisible to the browser. Build one read-only evidence adapter only if pilots show it materially changes verdicts. |
| Embedded verification for AI builders | Potential distribution expansion | Prove repeat paid usage and reliability first, then test an actual integration/partner commitment. MCP support alone is not distribution. |
| Universal military/robotics platform | Poor immediate scope for this team | Defer; requires device adapters, simulation fidelity, assurance and procurement capability the current product does not establish. |

## What would actually distinguish it

A builder's internal tests can repeat its assumptions. A separate verifier can repeat those assumptions too. Using another provider, another prompt or another model does not automatically create an unbiased judge or give it better data.

Define independence operationally:

1. A customer supplies the expected outcome and approves the interpretation. The builder is not the sole author of the acceptance criteria.
2. Each verdict names the approved plan, observed evidence, scope and exact deployment identity to the extent it can be established.
3. Fresh test data distinguishes a new successful write from a leftover success.
4. Skipped steps, inaccessible systems and infrastructure failures stay visible; none may become a pass.
5. Repair verification retains the failed run and repeats the approved meaning without silently weakening assertions.
6. Measured false passes and false alarms are published together on blinded, owner-adjudicated cases.

This is a quality bar and possible advantage, not a feature nobody else has. An integration graph becomes useful when it answers a customer's question, such as “Did the test purchase create entitlement, survive a new session and produce the expected downstream record?” It is not useful simply because its nodes look advanced.

A possible long-term asset is a permissioned library of requirement/failure pairs, adjudicated outcomes and reproducible checks. No proprietary-data advantage exists merely because model providers trained on broad data. Tenant secrets and customer data must not become a cross-customer training corpus by default.

## Prioritized execution plan

These are proposed decision gates, not results or delivery promises. Do not revise the earlier preregistered benchmark thresholds after collection starts; the tests below supplement those protocols.

### First: establish trust and demand

- Recruit 10 consenting prospects with real users or client obligations; include individual developers, agencies and small teams. No outreach was sent as part of this task.
- Run the existing deployment and outcome-chain protocols with clean controls and owner-seeded failures. Keep browser-visible and browser-invisible results separate.
- Add mabl/Momentic as documented comparators where accessible. Record unavailable paid products as “not run,” never as zero detection.
- Track false verified outcomes, true findings, false alarms, blocked runs, owner setup minutes, reproducibility, provider cost and whether a decision changed.
- Keep the existing demand gate: at least 5 completed customer runs, 3 requests to use it on another release, and 1 payment for another release. This is an early learning gate, not product-market fit.
- Audit all launch paths for stale-state acceptance, coverage mapping and infrastructure classification before claiming a reliable release gate. Review discovered scope/code inconsistencies explicitly.

### Next: make repeat usage valuable

If the demand gate passes, choose the smallest improvement pilots repeatedly need: product rehearsal and freshness enforcement, or a shareable report with narrowly scoped access, expiry and revocation. Validate the recipient workflow before implementing external links; never expose credentials or private artifacts to a bearer link accidentally.

Then establish build identity and trigger authorized reruns on new deployments. Existing per-plan approval/window restrictions remain part of the design: automation must not bypass them. A deployment event outside the approved target or period creates a review request rather than silently reusing approval.

Publish installable SDK/CLI packages after versioning, release verification and external adoption warrant them. Do not advertise npm installation before packages are published. Distribution convenience is useful; it does not create differentiation by itself.

### Then: expand evidence, with a buyer

Build one read-only downstream adapter selected from pilot failures. Require a test account, scoped permission, correlation identity, redaction and an explicit assertion. Measure incremental findings and cost against browser-only execution before adding a second adapter.

For robotics, first evaluate recorded simulator/MCAP/ROS evidence integration alongside established tools such as Foxglove. Recorded-log evaluation and live-device execution are separate capabilities. Pursue private-network execution, native runtimes or government procurement only with a committed buyer and a specific deployment requirement. Independently verify applicable model-provider, data-handling and procurement restrictions before accepting government work; existing website statements are not legal evidence.

## Billion-dollar ambition: a scenario, not a forecast

A $1 billion valuation is not implied by a product category, footage, partnerships or a revenue target. It depends on growth, retention, margins, market conditions and defensibility. Using a hypothetical 10× recurring-revenue multiple solely as arithmetic, a $1 billion value would correspond to $100 million ARR. The actual multiple could be much lower or higher.

One illustrative $100 million ARR mix, all unvalidated:

| Customer group | Count | Hypothetical annual revenue per customer | ARR |
| --- | ---: | ---: | ---: |
| Individual builders and small businesses | 20,000 | $1,800 | $36 million |
| Product teams and agencies | 2,000 | $24,000 | $48 million |
| Enterprise/institutional contracts | 80 | $200,000 | $16 million |
| Total | 22,080 | — | $100 million |

This illustrates the scale and expansion needed. The current $399/month plan alone would require roughly 20,886 paying subscriptions to reach $100 million ARR, before churn, discounts and refunds. Larger contract values must come from demonstrable recurring value and procurement capability, not renaming a plan Enterprise.

### The cost constraint deserves attention now

At full included usage, current monthly plans yield approximately $4.90 per verification on Builder, $3.73 on Pro and $2.66 on Scale. These are allocations of subscription revenue, not marginal prices. At an illustrative 80% gross-margin target, a fully used Scale plan leaves about $0.53 variable delivery cost per included verification before allocating support and other costs. A long run with up to 20 flows may exceed that. Measure actual cost by run duration, flow count, model calls, retries, artifacts and support rather than assuming more runs mean healthy growth.

Targets to validate before broad expansion: repeat paid releases, cohort retention, low false-pass rate with stated sample size, useful decisions per customer, contribution margin and a distribution channel that acquires customers at a sustainable cost. Enterprise demand does not rescue weak retention or unreliable decisions.

## Immediate website change

Broaden the homepage statement without pretending to serve only institutions:

> External software verification for individuals and teams in defense, robotics, finance and beyond. Catch failures in apps and control panels that internal systems can miss.

Maintain live/beta/not-built distinctions elsewhere. No pricing changes, new capability claims, procurement claims or product availability changes follow from this research alone.

## Primary sources reviewed

Product pages linked in the competitor table, plus:

- [Momentic pricing](https://momentic.ai/pricing) and [documentation](https://momentic.ai/docs).
- [TestSprite pricing](https://www.testsprite.com/pricing).
- [Checkly pricing](https://www.checklyhq.com/pricing/).
- [mabl pricing](https://www.mabl.com/pricing).
- [Foxglove documentation](https://docs.foxglove.dev/docs).

Internal references: `docs/positioning-release-acceptance.md`, `docs/benchmark-deployment-oracle-v1.md`, `docs/benchmark-outcome-chain-v2.md`, `docs/connections-queue.md`, `app/dev-preview/v6/_content/scope.ts`, `app/dev-preview/v6/_content/coverage.ts`, `app/dev-preview/v6/limitations/page.tsx`, `lib/preflight/connection-display.ts`, `lib/preflight/api-beta-gate.ts`, `lib/preflight/run-unique.ts`, `worker/preflight/execute-run.ts`, `app/api/preflight/apps/[id]/guarantees/[gid]/verify/route.ts`, and `sdk/typescript/README.md`.

# Vraelis: product research for physical systems

Research date: October 5, 2026 (UTC). Scope: robotics, drones, fleets, industrial control software and defense applications. This reflects the founder's latest clarification: defense is a major application, not the entire market.

## Recommendation

**Build verification of the handoff between control software and reported device behavior.** Start with a single repeatable workflow in recorded runs or staging: a robot task is requested, accepted and reported complete. Verify that the interface, service responses and available device/simulator records agree about the same task, asset and period.

The product should return a reproducible, scoped answer: which requirement held, which contradicted the observations, and which could not be evaluated. It must distinguish reported device behavior from independently observed physical behavior.

Start with robotics teams that already have recordings and a web/API control surface. Use their existing simulator, data platform and tests. The initial buyer hypothesis is the engineering or validation lead responsible for releases; the user is the engineer investigating inconsistent task outcomes. Both require interviews and paid pilots.

This is a recommended product experiment, not a proven empty category. Most technical ingredients already exist. The opportunity is a useful, inexpensive-to-adopt workflow around a costly handoff problem, demonstrated against the customer's existing tools.

## Research method and limits

Reviewed primary product pages, official documentation, standards/project repositories and a published PX4 community survey. Audited selected current Vraelis source and ran three existing offline checks. No competitor product was executed or purchased, no customer interview was conducted, and no production/customer device was accessed. Vendor claims are not independent benchmarks.

Raw source snapshots and extraction metadata were collected in `/tmp/vraelis-physical-research/`; a persistent [source manifest](physical-systems-sources-2026-10-05.json) records URLs, titles, retrieval outcomes and snapshot hashes. Some pages are mutable; ROS rolling and standard main branches must be pinned to a supported version in an implementation.

This assessment can establish existing advertised capabilities and implementation boundaries. It cannot establish that no company has built a similar workflow, willingness to pay, retention, physical safety, simulator fidelity or procurement readiness.

## What exists already

| Area | Evidence reviewed | Consequence |
| --- | --- | --- |
| Operational objects, actions and governed workflows | Palantir Ontology and Action test runs [S1] | A connected asset graph is not a workaround. Palantir already previews edits, checks permissions and exposes execution logs. |
| Robot data, AI investigation and comparison | Foxglove platform, agents and current release description [S2–S4] | Natural-language log analysis, cited evidence, MCP, configurable layouts and comparing recordings already exist. This is substantial competitive overlap, not just a visualization tool. |
| Fleet operations and orchestration | Formant and InOrbit [S5–S6] | A general robot operating dashboard or orchestration layer is already served. Formant also sells deployment services; the services alternative matters. |
| Simulation and physical-AI validation | Applied Intuition and NVIDIA Isaac Lab [S7–S8] | Simulation, scenario variation, data workflows and agent interfaces are established. Replacing a physics simulator would multiply the engineering problem. |
| Requirements, temporal assessments and hardware tests | MathWorks Simulink Test, dSPACE AutomationDesk and Siemens SIMIT [S9–S11] | Natural-language temporal assessments, requirements links, automated reports, SIL/HIL and virtual commissioning are not new. |
| Test-bench interoperability | ASAM XIL [S12] | A standard already decouples tests from vendor benches and supports synchronized capture, units, stimulation and error simulation. Universal bench integration is not unclaimed space. |
| Integration testing and explicit action states | ROS 2 launch_testing and Action design [S13–S14] | Engineers can already test nodes, assert results and distinguish acceptance, execution, cancellation and completion. |
| Time-dependent assertions | RTAMT [S15] | Offline and online Signal Temporal Logic monitoring already exists. A rule such as “the result arrives within a stated time” is not an invention. |
| Fleet communication and shared infrastructure | VDA 5050 and Open-RMF [S16–S17] | Task/order identifiers, state reporting, multi-vendor integration and coordination already have standards and open-source systems. |
| General software verification agents | mabl [S18] | “Independent verification between build and release,” complex web/API workflows and requirements-to-evidence positioning are already advertised directly. |

### Palantir specifically

Its documented action test runs compute proposed changes without committing Ontology edits. Post-action side-effect webhooks, notifications and scheduled builds are skipped, but certain function-backed external calls do execute after confirmation. Calling all its results mock data would be wrong. It also has function tests, SDKs and AIP evaluations, as documented in the earlier assessment.

A possible Vraelis contribution is a separately approved verification that checks downstream observations after an authorized staging workflow, including surfaces outside that action preview. This is a potential integration/use case, not evidence that Palantir cannot do it. No Vraelis Foundry connector exists today.

### Foxglove is a closer immediate concern

The retrieved agent page says its built-in agent can inspect recordings, write scripts, tag events and make approved changes. Its release description says answers cite topics, timestamps or schemas, and describes comparison of multiple recordings on one timeline, data search, semantic search and remote access.

Therefore “AI explains robot logs with evidence” and “compare a failed run with a fixed run” are already occupied propositions. Vraelis must earn a separate purchase through a specific release/acceptance workflow, lower effort, explicit evaluation semantics or meaningful findings the existing setup misses. A custom Foxglove script is an essential comparator, not just another vendor logo.

The retrieved Foxglove pricing page starts at free and advertises a $20/month Pro base plus usage/seats/devices. That is not the price of an equivalent verification service, but it makes another generic data viewer a poor initial product. The release post and pricing table disagree about Pro eligibility for bring-your-own-storage; confirm with the vendor rather than treating either as a settled contract term.

## What might be underserved

The following are hypotheses. Each can be implemented with existing technology and may already be available from a vendor or internal team.

| Candidate problem | Why it might support a product | How to disprove the opportunity |
| --- | --- | --- |
| Control UI reports success while device/task records disagree | One accepted request may cross UI, service, queue and robot layers; assembling the correct evidence can require bespoke work | Existing scripts find the same faults with similar setup and review time; buyers do not experience recurring disagreement |
| A release changes unrelated assets or settings | Teams need expected changes and explicit invariants tied to named assets, rather than checking only the intended result | Existing integration tests already cover it cheaply; there is no maintenance burden |
| A patch fixes the incident but the reviewer cannot establish which build/data/config was tested | A versioned record can connect incident, approved requirement, corrected build and repeated evaluation | Existing test management and data lineage already answer this sufficiently |
| A vendor or integrator delivers a system but the customer cannot reproduce acceptance evidence | Agreed requirements and portable evidence could improve handoff | Customers accept current reports and cannot justify another tool; every contract needs bespoke engineering |
| Required evidence is missing, yet dashboards imply completion | Explicit missing/contradictory evidence can prevent a misleading release result | The issue is uncommon or the operator already notices it reliably |

**Most promising combination:** verify the same task across reported layers, with explicit timing, identities and limits, then reproduce the evaluation after a software change. The combination is a product hypothesis, not a novelty claim.

A separate verifier does not automatically have more or better data. It needs customer-authorized observations and independently reviewed criteria. Two fields derived from the same controller are not independent proof. Broad model pretraining is not a substitute for device-specific ground truth.

## Concrete first workflow

Example, entirely in staging or a recorded simulation:

> A task submitted for Robot A may be marked complete only when the configured completion evidence for that same task and robot is present. Robot B's task state must remain unchanged.

The owner defines what completion means. It may be a reported final result, a simulator's ground-truth event or an independent sensor observation. Those are different scopes and must be labeled separately. No universal arrival tolerance or timing threshold is invented by an LLM.

A review record should answer:

1. Which approved requirement, task ID, asset ID and software/configuration versions were evaluated?
2. What did the UI, API and available device/simulator source report, and when?
3. Were the observations fresh and attributable to this task rather than an earlier run?
4. Did the configured final condition occur within its specified period?
5. Did the explicitly named unrelated state remain unchanged?
6. What is contradictory, missing or outside the evaluated scope?

### Minimum data model

Use a small typed record before any ontology or graph: run ID, source, asset ID, task ID, event type, reported value, source time, receive time, sequence/version, clock domain and raw evidence reference. Preserve source meaning; normalize units and map identifiers through a reviewed configuration. Duplicate IDs, unsupported mappings or unexplained time skew must not quietly become a pass.

Start with one robotics adapter. ROS 2 action semantics are a plausible first choice: goal UUID, acceptance, progress and final result are explicitly distinguished [S14]. A fleet buyer using VDA 5050 may instead justify an adapter keyed to manufacturer/serial identity, order ID, update ID and action ID [S16]. Pick based on accessible pilot data; implementing both before a buyer proves need is premature.

MCAP is a practical recording container: timestamped channels, embedded schemas and common language libraries [S19]. MCAP does not establish schema semantics, trustworthy clocks, independent sensors or truthful payloads. Not every ROS bag is MCAP; support one documented encoding initially.

### Evaluation behavior

- A language model helps draft the requirement and candidate field mapping. A human approves the exact interpretation.
- Deterministic evaluators calculate IDs, values, time windows and invariants. Model prose cannot override a failed or incomplete calculation.
- A contradiction to the approved requirement produces a failure with the relevant evidence.
- Missing evidence or insufficient observation duration produces an inconclusive/unobserved result, not a successful one. Evaluation may stop early only where the declared predicate permits it.
- A predicate must define how it treats gaps, uncertainty, tolerances and time boundaries. Do not interpolate missing measurements or assume clocks share an epoch.
- Retain the failed evaluation when checking a repair. Changing the requirement or tolerance creates a new version, not a retroactive repair success.
- For noisy or stochastic behavior, use repeated trials and state the conditions and uncertainty. One successful replay does not establish general reliability.

This first workflow is evidence evaluation, not autonomous fleet control. It does not need a photorealistic rendering engine. A timeline, source records and optional existing 2D/3D viewer can serve the investigation.

## Vraelis capability audit

“Present” here means code or an existing recorded demonstration was located. It does not mean this audit completed a fresh customer production run.

| Capability | Status and evidence |
| --- | --- |
| Approved requirement/plan and real-browser workflow execution | Present in `lib/preflight/reviewed-plan.ts` and `worker/preflight/execute-run.ts`; browser provider and recorded demonstrations exist |
| Step evidence, findings and re-check | Existing foundations and demonstrations; not proof of general reliability or external demand |
| Standalone HTTP API execution | Implemented signed-in beta: `api-adapter.ts`, `api-executor.ts`, `api-steps.ts`, and `api-beta-gate.ts`; supports responses, field assertions, extraction and persistence re-reads |
| Browser plus API plus telemetry in one correlated evaluation | Not established by the separate runtimes. This would be new work |
| Recorded task-state evaluation | Built during this research: local JSON import, reviewed task/asset/timing criteria, deterministic verdicts, source citations, comparison and hashed export. These are author-supplied reports, not independent physical observations |
| Native ROS/MCAP/VDA 5050 readers | Not built. The new tool accepts a documented normalized JSON schema, not protocol-native logs |
| Local/private-network device execution | Current safe fetch allows public HTTPS/443 and refuses private addresses. A new local collector/runner is needed; weakening the existing guard is not a solution |
| Exact physical-system identity and time alignment | No end-to-end device/firmware/configuration/clock binding established; generic decision-binding types are a useful foundation, not proof of live enforcement |
| Source integrations | Some are metadata or requirement hints. OpenAPI/custom auth are explicitly stored but not verification readers; a credentials screen is not a telemetry integration |
| Unique values per browser run | Worker substitution exists; fixed-value rejection is limited to some paths. Universal freshness protection is not established |
| Installable public TypeScript SDK | Source exists but package is private and not published; this audit did not establish a working external distribution |
| Native SDK/library execution and native control apps | Not built by the browser engine. QGroundControl is not automatically covered just because a simulation communicates with it |
| Certification, physical safety or government deployment readiness | Not established by the implementation or these simulations |

Offline checks run during this audit:

- `runtime:model:test`: 19/19 passed.
- `run:unique:test`: 46 checks passed.
- `api:beta:test`: 109/110 passed. The failed check looks for literal verdict strings in the API read route; that route now imports the centralized `PAYLOAD_VERDICT` map. This appears to be a stale structural assertion, not observed API malfunction. Fix the check and exercise the real route before using an all-green readiness claim. No source fix was made during this research.

The SDK and API can expose Vraelis itself; that does not mean Vraelis can inspect an arbitrary customer's SDK or robot firmware. Keep those directions separate.

## First implementation

`/verifications/recorded` provides a working local evaluation workspace inside the app shell. It starts empty, accepts a bounded JSON file, requires review before evaluation, and exposes source records. Three explicitly simulated examples demonstrate a missing device completion with full capture, an unintended change to a second asset, a corrected run, and absent device capture. Results can be retained as a tab-local comparison baseline and exported with the exact source JSON and its SHA-256. Full screen and mobile layouts are supported.

The evaluator checks one identifiable request, matching asset/task IDs, completion timing, service/device/control ordering, adverse terminal states, and named unchanged assets with a baseline and continuous declared capture. Missing capture and conflicting baselines remain inconclusive. This is a feasibility prototype of explicit assertions, not an established differentiation or production robot integration. No live connectors, native log readers, physical ground truth, cloud persistence or device control were added. See [format and evaluation semantics](../recorded-verification-v1.md).

Validation for the first implementation: 28 deterministic fault/parser checks pass. Browser verification covers local file import, rejected malformed input, review gating, broken/corrected/incomplete recordings, exact-criteria comparison, baseline restoration, SHA-256 export, source-event selection, full screen and layouts at 390/320 px. The production build passes. New feature files pass lint; the shared app shell retains the same 11 pre-existing lint errors (five effect-state, four inline-component and two immutability errors). None is in the new evaluator or workspace. These checks validate implementation behavior, not customer demand or detection performance on real robot data.

## Viability of the alternatives

Ratings are engineering/business judgment, not measured market demand.

| Direction | Fit with current code | Competitive pressure | Delivery burden | Decision |
| --- | --- | --- | --- | --- |
| General web-app AI verifier | High | Very high | Lower | Keep the reusable engine; weak lead proposition |
| Verification of a robotics web panel alone | High | High | Lower | Useful pilot entry, limited differentiation |
| Recorded task evaluation across service and robot/simulator evidence | Medium | Significant | Medium | Best first product experiment; one adapter and one workflow |
| Live verification through a customer-controlled runner | Medium-low | Significant | Higher | Next only when recorded pilots demonstrate recurring value |
| Supplier/customer acceptance evidence | Medium | Established test-management alternatives | Medium plus services | Possible paid use case; prove repeatability before a platform |
| General robot logs chat or new 3D operations map | Low-medium | Very high | Medium-high | Do not lead with this |
| Own simulator, universal digital twin or full hardware certification stack | Low | Strong specialist incumbents | Very high | Defer |
| Automatic safety guarantee or complete end-to-end correctness | Unsupported | Not a well-defined bounded product | Unbounded | Do not promise |

### Who to approach first

Prioritize small and mid-sized robotics/fleet software teams with a web/API control service, repeat software releases, access to simulator/recorded evidence and a recent task-state defect. Defense robotics fits when the data and deployment are eligible. Inspection, logistics and industrial mobile robots can expose the same problem without making Vraelis defense-only.

Do not require customers to replace Foxglove, their simulator or their fleet manager. Treat those as integration surfaces, subject to supported APIs, licensing and buyer permission. Integrators may buy acceptance records, but extensive per-site customization is a warning that the business is becoming services-heavy.

Individual robotics developers and researchers can use a local recording evaluator as an adoption path. Whether that leads to paid institutional expansion must be measured. A generic SaaS app remains technically compatible with the browser engine; its marketing does not need to compete with the physical-system thesis.

## Proposed build sequence

These are gated stages, not calendar promises. One engineer should not attempt all of them at once.

**Stage 0: find and reproduce the problem.** Review recent incidents with engineering leads. Request a consented, bounded recording plus a written expected outcome. Manually compare the layers before implementing an adapter. Establish the strongest customer baseline, including internal scripts and existing platform extensions.

**Stage 1: recorded evaluation MVP.** Support one file encoding and a small event schema; reviewed mapping; a deterministic assertion set; incomplete-data handling; hashed source manifest; a reproducible report and rerun. Reuse existing requirement/version/evidence concepts where appropriate. Hashing establishes integrity relative to the recorded bytes, not truth of the source or proof of physical behavior.

**Stage 2: integrate the control surface.** Bring existing browser/API observations into that same evaluation. Add run/task correlation, fresh observations, clock handling and explicit identity/version checks. A combined verdict must require evidence from each required source; separate passing runs are not automatically a combined pass.

**Stage 3: repeated staging verification.** Trigger the approved evaluation on changed builds within its authorized scope. Add a customer-controlled local collector only when required. Bound its access, version its capabilities and preserve the current public-fetch security boundary. Start read-only observation; do not add a generic remote robot command mechanism.

**Stage 4: expand after reuse.** A second adapter, test-bench export or contract acceptance workflow is justified by demand and measured integration reuse. ASAM XIL may be appropriate for an industrial buyer with an existing bench; ROS/MCAP should not be stretched to represent every industrial protocol.

A broad connector catalog, native runtimes, full 3D product rebuild and private deployment simultaneously would leave the core experiment unresolved.

## Validation plan and decision gates

This is a new proposed physical-system experiment. It does not edit the existing frozen web/deployment or commerce benchmark protocols.

### Discovery

Interview 8–12 relevant engineering/validation leads. Ask for the last actual incident, its evidence, investigation time, current detection method and release consequence. Ask who owns the budget and data permission. Avoid “would you use an AI robot verifier?” enthusiasm questions.

Advance only if at least three independent teams describe the same recurring handoff failure and two can supply usable recorded/staging evidence. This small sample guides a pilot; it does not estimate the market.

### Comparative evaluation

Pre-register the requirement interpretation, scoring and dataset before running the verifier. Use held-out faulty and corrected traces, plus clean controls. Compare against the team's current scripts, a standard ROS/pytest or applicable protocol test, and its existing data-platform workflow. Paid/incumbent products that cannot be accessed are “not tested,” never zero detection.

Exercise at least: wrong asset/task identity, stale prior result, acknowledgement without final completion, UI/result disagreement, an unintended change to the named second asset, delayed completion, incomplete recording and clock ambiguity. These are simulated/staging data faults, not instructions for perturbing deployed hardware.

Proposed pilot acceptance thresholds, to lock before collecting results:

- Zero observed false successful verdicts on seeded failing or incomplete cases; state the sample size. Even zero failures in 100 independent representative cases leaves an approximate 3% one-sided 95% upper bound, not a proof of zero risk; correlated cases weaken that interpretation.
- At least 90% detection of the predeclared observable defect cases, with incomplete-data cases scored separately.
- No more than 5% false alarms on clean cases; use enough cases to state meaningful uncertainty.
- At least 50% lower median engineer time to an accepted evidence record than the buyer's strongest existing method, measured including setup and corrections.
- A second build evaluated without rebuilding the adapter or weakening criteria.
- At least two paid repeat pilots, rather than payment only for custom integration services.

These thresholds are proposed experiment criteria, not product performance claims. A true finding is valuable only if it changes a buyer's release, investigation or acceptance decision.

### Stop or change direction

Pause if the same faults are already caught cheaply, criteria cannot be made reproducible, every customer needs a different bespoke adapter, required evidence is unavailable, setup costs dominate, or nobody pays for repeat evaluation. In that case choose a narrower protocol workflow or treat the outcome as a services engagement; do not declare a platform from one demo.

## Economics and the path to a large company

Price by recurring evaluation value and bounded resource usage, not by dramatic mission imagery. A pilot can test a fixed scope/price with integration work identified separately. No price recommendation is supported by customer willingness-to-pay evidence yet.

Cost accounting must include browser/model calls, log parsing, storage/egress, retries, specialist setup, human review and support. Reuse recordings and deterministic evaluations rather than asking a model to reread gigabytes each run. Keep customer storage where feasible and extract the bounded evidence needed for the approved evaluation.

At the current $399/month, reaching $100 million ARR would require about 20,886 accounts before discounts and churn. A hypothetical $100 million ARR could instead mean 5,000 organizations averaging $20,000/year, or 1,000 averaging $100,000/year. Neither customer count nor price has been validated. A billion-dollar valuation is not guaranteed by $100 million ARR or any fixed multiple.

A simple value test: if a team spends 20 hours/month on this problem and values engineering time at $100/hour, annual labor is $24,000. Saving half is $12,000, so that alone cannot justify a $20,000/year contract. Higher pricing needs larger measured savings or separately established operational/acceptance value. Do not invent incident costs to make the arithmetic work.

What could compound into an advantage: reusable domain adapters, reviewed requirement templates, permissioned/adjudicated failure cases, reproducible evaluations and deep repeat use in release/acceptance workflows. Model choice, a graph UI, generic browser automation and merely calling the checker “external” are weak barriers. Customer telemetry is not a cross-customer training asset without permission; consented derived cases still need provenance and useful labels.

## Evidence about demand, versus speculation

The Dronecode-sponsored PX4 simulation survey ran in October–November 2025 and reports 120 responses [S20]. It reports 74 respondents using simulation for mission planning/validation and 48 for quality assurance in continuous integration. It identifies documentation and integration difficulties. This supports investigating developer workflow friction. It does not establish willingness to pay for Vraelis or a representative market-size estimate; participants were a community sample, not prospective customers selected randomly.

The survey also distinguishes the importance of physics realism from photorealistic rendering. Better homepage imagery or a smooth viewer is not evidence of better simulation or verification. Rendering frame rate, telemetry sampling frequency and evaluation correctness are separate measurements.

## Decision to carry forward

Use **software verification for physical systems** as the broad category. Build the first proof around a robot task handoff with existing recordings and control software. Earn the right to add live connectors, other device families and industrial test benches through repeat paid use.

The next concrete deliverable should be a blinded, reproducible evaluation using one consenting team's real workflow. It will answer whether the gap is valuable more reliably than another homepage pivot or a claim that nothing similar exists.

## Primary sources

All reviewed during this assessment; links describe vendor/project capabilities, not independent performance proof.

- **S1:** [Palantir Action test runs](https://www.palantir.com/docs/foundry/action-types/test-run/); see the earlier [Ontology assessment](palantir-ontology-and-market-focus-2026-10-04.md) for additional official documentation.
- **S2:** [Foxglove platform](https://foxglove.dev/) and [documentation](https://docs.foxglove.dev/docs).
- **S3:** [Foxglove agents](https://foxglove.dev/product/agents).
- **S4:** [Foxglove agentic data platform release](https://foxglove.dev/blog/introducing-the-agentic-data-platform-for-physical-ai) and [pricing](https://foxglove.dev/pricing).
- **S5:** [Formant](https://www.formant.ai/). Numerical counters on the rendered page were inconsistent/animated and were not used to estimate market size.
- **S6:** [InOrbit](https://www.inorbit.ai/) and [RobOps](https://www.inorbit.ai/robops).
- **S7:** [Applied Intuition physical AI](https://www.appliedintuition.com/physical-ai); the former Simian URL redirected here.
- **S8:** [NVIDIA Isaac Lab](https://isaac-sim.github.io/IsaacLab/main/index.html).
- **S9:** [MathWorks Simulink Test](https://www.mathworks.com/products/simulink-test.html).
- **S10:** [dSPACE AutomationDesk](https://www.dspace.com/en/pub/home/products/sw/test_automation_software/automationdesk.cfm).
- **S11:** [Siemens SIMIT](https://www.siemens.com/en-us/products/simit/); retrieved through its former global product URL.
- **S12:** [ASAM XIL](https://www.asam.net/standards/detail/xil/).
- **S13:** [ROS 2 launch_testing source documentation](https://github.com/ros2/launch/blob/rolling/launch_testing/README.md); docs.ros.org returned a bot challenge, so the official project source was read instead.
- **S14:** [ROS 2 Action design](https://github.com/ros2/design/blob/gh-pages/articles/actions.md).
- **S15:** [RTAMT](https://github.com/nickovic/rtamt).
- **S16:** [VDA 5050 repository](https://github.com/VDA5050/VDA5050) and [specification](https://github.com/VDA5050/VDA5050/blob/main/VDA5050_EN.md). The repository states the published VDA PDF prevails in a discrepancy. VDA 5050 is not a safety or cybersecurity standard.
- **S17:** [Open-RMF](https://www.open-rmf.org/).
- **S18:** [mabl](https://www.mabl.com/).
- **S19:** [MCAP](https://mcap.dev/).
- **S20:** [PX4 simulation documentation](https://docs.px4.io/main/en/simulation/) and [PX4 simulation integration survey](https://www.mcguirerobotics.com/px4_sim_research_report/).

Retrieval limitations: the Gazebo index and ASAM OpenSCENARIO landing page yielded insufficient substantive text for a scored comparison; ROS web docs yielded bot challenges. A guessed Foxglove release URL returned 404, then its actual linked release was retrieved successfully. No competitive absence follows from those results.

import type { CaptureName } from "../_kit/blocks";
import { FACTS, type Kind } from "../_kit/site";

// THE FOUR RESEARCH PAGES' COPY (v8, 2026-10-10). Research areas are workstreams, never products: every page says
// so, and every "what exists today" line is tagged with its kind (implemented in the experiment, measured,
// proposed, not claimed). Reconciled from v6 model-integrity, adversarial-security, zero-trust, recorded-evidence
// and research, with the old claims dropped: no "policy core", no AI workload or tool authority product, no
// browser testing, no CLI or API. Machine trust replaces the old zero trust page and describes zero trust only as
// concrete boundaries.

export type ResearchSlug = "model-integrity" | "adversarial-threats" | "machine-trust" | "security-evidence";
export type Point = { title: string; body: string };
export type Exists =
  | { kind: "experiment"; title: string; lead: string; items: { kind: Kind; text: string }[]; capture: CaptureName }
  | { kind: "direction"; title: string; paragraphs: string[] };

export type ResearchPage = {
  slug: ResearchSlug;
  metaTitle: string;
  description: string;
  /** The page's one h1. */
  title: string;
  lead: string;
  studyTitle: string;
  study: Point[];
  /** "flow" draws the questions as a labelled diagram of boundaries (machine trust). */
  studyAs?: "list" | "flow";
  studyCaption?: string;
  studyLead?: string;
  exists: Exists;
  open: Point[];
  related: ResearchSlug[];
  links: { label: string; to: string }[];
};

const TESTS = `${FACTS.tests.value} ${FACTS.tests.label}. That describes the experiment, not production readiness.`;
const SELF_REPORT = "Hardware attestation. Runtime reports in the experiment are worker self-reports.";

export const RESEARCH_PAGES: Record<ResearchSlug, ResearchPage> = {
  "model-integrity": {
    slug: "model-integrity",
    metaTitle: "Model integrity",
    description: "A research area, not a product: whether the model that runs is the model that was approved. What we study, what exists in the Vraelis Contour experiment, and what is still open.",
    title: "Know which model is running.",
    lead: "Model integrity asks whether the model that runs is the model that was approved: the artifact, its preprocessing and its configuration, bound to an approval and compared with what the runtime reports loading. It is a research area, not a product.",
    studyTitle: "Four questions about one release.",
    study: [
      { title: "What exactly is a release?", body: "A model file alone is not the release. Preprocessing and configuration change what the model does, so a release has to name all three, by digest." },
      { title: "What should an approval bind to?", body: "An approval that names a model but not a destination can be carried somewhere it was never meant to run. We study approvals tied to one release and one destination." },
      { title: "What can a runtime report about itself?", body: "A runtime can report which release it loaded. That is a self-report. We study what it can establish without hardware attestation, and what it cannot." },
      { title: "What does a signature prove?", body: "A signature authenticates an endorsement of particular bytes. It does not show that the model does what was intended, or that it has no backdoor." },
    ],
    exists: {
      kind: "experiment",
      title: "Model integrity is where Vraelis Contour starts.",
      lead: "Vraelis Contour, our first product, draws mainly on this area. Inside its controlled synthetic ONNX CPU experiment, in private development:",
      items: [
        { kind: "impl", text: "Each release is named by its model, configuration, release and receipt digests." },
        { kind: "impl", text: "Signed bindings tie an approval to the exact release and its destination, under a runtime policy with a 60 second age limit." },
        { kind: "impl", text: "The runtime checks its policy before it serves: ONNX Runtime 1.23.2, CPUExecutionProvider only." },
        { kind: "impl", text: "The approved identity is compared, field by field, with the identity the runtime reports loading." },
        { kind: "meas", text: TESTS },
        { kind: "prop", text: "Preprocessing identity. The experiment does not record it yet." },
        { kind: "not", text: SELF_REPORT },
      ],
      capture: "crop-release-identity",
    },
    open: [
      { title: "Naming preprocessing", body: "Tokenizers, scaling and feature code change what reaches the model. How to identify them so they can be bound like the model file is open." },
      { title: "More than one runtime", body: "The experiment supports ONNX Runtime 1.23.2 on CPU only. Other runtimes and accelerators report identity differently, and adapters for them are not built." },
      { title: "Fresh reports", body: "A report that was true a minute ago may not be true now. Heartbeat freshness for runtime reports is being built, not done." },
      { title: "A compromised host", body: "A self-report from a compromised host can say anything. That case is outside what the experiment covers." },
    ],
    related: ["security-evidence", "machine-trust", "adversarial-threats"],
    links: [
      { label: "How Vraelis Contour works", to: "/contour#how" },
      { label: "Suppliers and integrators", to: "/applications/integrators" },
    ],
  },

  "adversarial-threats": {
    slug: "adversarial-threats",
    metaTitle: "Adversarial threats",
    description: "A research area, not a product: inputs, training data, updates and supply paths built to change what a model does. Research direction with no product claim.",
    title: "Investigate how AI can be manipulated.",
    lead: "Adversarial threats are inputs, training data, updates and supply paths built to change what a model does. It is a research area, not a product. Nothing Vraelis has built detects or blocks these attacks.",
    studyTitle: "Separate the attack from the conditions.",
    study: [
      { title: "Which path does the attack use?", body: "A manipulated sensor input, a poisoned training set and a swapped model file are different attacks. Each needs its own threat model and its own test." },
      { title: "Where does a release check stop?", body: "Binding approval to exact bytes can show that a release changed. It cannot show that the approved bytes were trustworthy to begin with." },
      { title: "What belongs in the baseline?", body: "Lighting, viewpoint, normal variation and sensor faults change a perception model's output too. They belong in the baseline, so ordinary conditions are not read as an attack." },
      { title: "Is it drift or an attack?", body: "Performance can change for operational reasons. An anomaly is a reason to investigate. On its own it does not establish an attack." },
      { title: "What does a countermeasure cost?", body: "A countermeasure that adds latency, memory or compute on an edge device has an operating cost. Missed attacks and false alarms both need measuring." },
    ],
    exists: {
      kind: "direction",
      title: "Research direction, with no product claim.",
      paragraphs: [
        "Nothing in the Vraelis Contour experiment tests adversarial inputs, poisoned data or perception attacks. There is no detector, no measured result and no claim of protection against them.",
        "The one point of contact is the supply path. In the experiment a release is named by digest and its approval is bound to that release, so a different release shows as differing fields when the approved and reported identities are compared. That covers a changed release. It does not cover a manipulated input or a poisoned training set.",
      ],
    },
    open: [
      { title: "Which threats matter where", body: "A perception model on a vehicle and a forecasting model in a control room face different inputs and different attackers. Which to study first depends on the system." },
      { title: "Adaptive testing", body: "An evaluation built only from fixed examples can overstate a countermeasure. Attacks adapted to the countermeasure are needed before a result means much." },
      { title: "Reproducible results", body: "An attack result needs its conditions: the model version, the attacker's access, the input path and the expected outcome. Without them it cannot be repeated." },
      { title: "One record for both", body: "Whether release evidence and input evidence can share one ordered record, so an investigation sees both, is open." },
    ],
    related: ["model-integrity", "machine-trust", "security-evidence"],
    links: [
      { label: "Defense", to: "/applications/defense" },
      { label: "Autonomous systems", to: "/applications/autonomous-systems" },
    ],
  },

  "machine-trust": {
    slug: "machine-trust",
    metaTitle: "Machine trust",
    description: "A research area, not a product: zero trust described as concrete boundaries. Explicit identity, limited permissions, approval tied to a change and destination, and checks at execution boundaries.",
    title: "Authority must be explicit.",
    lead: "Machine trust is our research on how AI systems are given authority. We describe zero trust only as concrete boundaries: explicit identity, limited permissions, approval tied to a change and its destination, and checks at execution boundaries. It is a research area, not a product.",
    studyTitle: "Four boundaries a request should cross.",
    studyAs: "flow",
    studyLead: "Zero trust, described as the boundaries it is made of. Each one is a question we study, not a control we sell.",
    studyCaption: "Diagram: the four boundaries machine trust studies, in the order a request meets them. A research model, not a product architecture.",
    study: [
      { title: "Explicit identity", body: "Who is asking? A request should come from a named principal, through a trusted identity source. A label a workload gives itself is not identity." },
      { title: "Limited permissions", body: "What may it touch? A permission should name the resource and the action. Authority for one machine, environment or version does not carry over to another." },
      { title: "Approval tied to a change and destination", body: "Who agreed to what, and where? An approval should name the exact change and where it applies, expire, and stay separate from whoever proposed the change." },
      { title: "Checks at execution boundaries", body: "Where is it enforced? The component that holds access should check the exact request at the moment it acts. A decision made earlier is not enough." },
    ],
    exists: {
      kind: "direction",
      title: "Research direction, with no product claim.",
      paragraphs: [
        "Vraelis has no identity, access or authorization product, and makes no zero trust claim about any system.",
        "One narrow boundary of this kind exists inside the Vraelis Contour experiment. Its runtime policy names separate publisher, deployer and approver roles. An approval names one release and one destination and carries a 60 second age limit. The receiving runtime checks the policy before it serves.",
        "That is one check, at one boundary, in a synthetic experiment. It is not a machine trust system.",
      ],
    },
    open: [
      { title: "Disconnected operation", body: "When a machine cannot reach its identity or approval service, what should it do? The answer belongs in the owner's operating design, not in a generic rule." },
      { title: "Single use approval", body: "A permit returned once should not authorize a second execution. How to consume an approval exactly once, at the boundary, is open." },
      { title: "Two approval domains", body: "A supplier approves a model while an operator approves how and where it runs. How both approvals bind to one release is open." },
      { title: "Revocation", body: "How quickly a withdrawn approval has to reach every boundary that relies on it, and what happens in between, is open." },
    ],
    related: ["model-integrity", "security-evidence", "adversarial-threats"],
    links: [
      { label: "Critical infrastructure", to: "/applications/critical-infrastructure" },
      { label: "Suppliers and integrators", to: "/applications/integrators" },
    ],
  },

  "security-evidence": {
    slug: "security-evidence",
    metaTitle: "Security evidence",
    description: "A research area, not a product: records a person can read, kept in order, including what could not be confirmed. What exists in the Vraelis Contour experiment, and what is still open.",
    title: "Keep the record, including what could not be confirmed.",
    lead: "Security evidence is our research on records: kept in order, readable by someone who did not build the system, and plain about what could not be confirmed. It is a research area, not a product.",
    studyTitle: "What a record has to hold.",
    study: [
      { title: "What belongs in one observation?", body: "The approved identity, the identity the runtime reports, whether the runtime satisfied its policy, and when the report arrived." },
      { title: "How is missing evidence recorded?", body: "A runtime that stops reporting has confirmed nothing. The record should say that evidence is unavailable, with a reason, instead of assuming the last state still holds." },
      { title: "Can a reader tell a self-report from proof?", body: "Every record should carry its scope, so a worker's report about itself is never read as independent attestation." },
      { title: "How does a record stay in order?", body: "Discrepancies, gaps and the recovery that followed belong in one ordered record, so a later observation never hides an earlier one." },
    ],
    exists: {
      kind: "experiment",
      title: "Recorded observations, in the experiment.",
      lead: "Vraelis Contour draws mainly on this area and on model integrity. Its controlled synthetic ONNX CPU experiment keeps a recorded trace, read by a read-only evidence app:",
      items: [
        { kind: "impl", text: "Four observations from one captured run: matched, reload pending, matched, evidence unavailable." },
        { kind: "impl", text: "Each observation keeps the approved identity, the reported loaded identity and the runtime policy result." },
        { kind: "impl", text: "When the worker stopped, the observation recorded evidence unavailable, with the reason code RUNTIME_UNAVAILABLE, instead of a match." },
        { kind: "impl", text: "The app refuses to import a pending, missing evidence or wrong runtime observation as matched." },
        { kind: "prop", text: "An investigation workflow over the record." },
        { kind: "not", text: "Independent attestation. The scope of every record is a worker self-report." },
      ],
      capture: "app-observations-unavailable",
    },
    open: [
      { title: "Edited records", body: "A self-consistent edited trace still validates today, so imported traces have to be marked unverified. How a record can show it was not altered is open." },
      { title: "Stale reports", body: "When does a report stop being current? Heartbeat freshness for runtime reports is being built, not done." },
      { title: "Expected silence", body: "A machine that is offline on purpose stops reporting too. How a record tells expected silence from a fault is open." },
      { title: "Reviewer effort", body: "How long it takes someone outside the team to reach a conclusion from the record has not been measured." },
    ],
    related: ["model-integrity", "machine-trust", "adversarial-threats"],
    links: [
      { label: "Recorded observations", to: "/contour#observations" },
      { label: "Government and institutions", to: "/applications/government" },
    ],
  },
};

export function researchPage(slug: string): ResearchPage | undefined {
  return (RESEARCH_PAGES as Record<string, ResearchPage | undefined>)[slug];
}

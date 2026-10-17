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
  | { kind: "experiment"; title: string; lead?: string; items: { kind: Kind; text: string }[]; capture: CaptureName }
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
  exists: Exists;
  open: Point[];
  related: ResearchSlug[];
  links: { label: string; to: string }[];
};

const TESTS = `${FACTS.tests.value} ${FACTS.tests.label}. Not production readiness.`;
const SELF_REPORT = "Hardware attestation. Runtime identity is a worker self-report.";

export const RESEARCH_PAGES: Record<ResearchSlug, ResearchPage> = {
  "model-integrity": {
    slug: "model-integrity",
    metaTitle: "Model integrity",
    description: "Research on model identity, artifact and configuration integrity, and the connection between an approved release and reported runtime state.",
    title: "Know which model is running.",
    lead: "Whether the model that runs is the model that was approved. A research area, not a product.",
    studyTitle: "Four questions about one release.",
    study: [
      { title: "What exactly is a release?", body: "The model, its preprocessing and its configuration, each by digest." },
      { title: "What should an approval bind to?", body: "One release and one destination, so it cannot travel elsewhere." },
      { title: "What can a runtime report about itself?", body: "Which release it loaded. A self-report, without hardware attestation." },
      { title: "What does a signature prove?", body: "An endorsement of bytes. Not intended behaviour, not the absence of a backdoor." },
    ],
    exists: {
      kind: "experiment",
      title: "Where Vraelis Contour starts.",
      items: [
        { kind: "impl", text: "Artifact integrity: model bytes checked against the approved digest before a session loads them." },
        { kind: "impl", text: "Release authorization: signed bindings to the exact release and destination, with a 60 second age limit." },
        { kind: "impl", text: "Runtime policy checked before serving: ONNX Runtime 1.23.2, CPUExecutionProvider only." },
        { kind: "impl", text: "Configuration integrity: the configuration digest is part of the release, compared on every report." },
        { kind: "meas", text: TESTS },
        { kind: "prop", text: "Preprocessing identity. Not recorded yet." },
        { kind: "not", text: SELF_REPORT },
      ],
      capture: "crop-release-identity",
    },
    open: [
      { title: "Naming preprocessing", body: "How to identify tokenizers, scaling and feature code by digest." },
      { title: "More than one runtime", body: "Other runtimes and accelerators. No adapters are built." },
      { title: "Model provenance", body: "Where a model and its training inputs came from, beyond its digest." },
      { title: "A compromised host", body: "Its self-report can say anything. Outside the experiment." },
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
    description: "Research on adversarial inputs, data poisoning, unauthorized updates, and the AI supply-chain paths that can change model behavior.",
    title: "Investigate how AI can be manipulated.",
    lead: "Inputs, training data, updates and supply paths built to change what a model does. A research area, not a product.",
    studyTitle: "Separate the attack from the conditions.",
    study: [
      { title: "Which path does the attack use?", body: "Sensor input, training data and model file each need their own threat model." },
      { title: "Where does a release check stop?", body: "It shows a release changed, not model provenance: where the approved bytes came from." },
      { title: "What belongs in the baseline?", body: "Lighting, viewpoint, normal variation and sensor faults, so ordinary conditions are not read as attacks." },
      { title: "Is it drift or an attack?", body: "An anomaly is a reason to investigate, not proof of an attack." },
      { title: "What does a countermeasure cost?", body: "Latency, memory and compute on the edge, plus misses and false alarms." },
    ],
    exists: {
      kind: "direction",
      title: "Research direction, with no product claim.",
      paragraphs: [
        "Nothing Vraelis has built tests, detects or blocks these attacks. No detector, no measured result.",
        "The one overlap is the supply path: unauthorized changes, a wrong destination or changed components, are specified as scripted fault tests, not run. That does not cover manipulated inputs or poisoned training data.",
      ],
    },
    open: [
      { title: "Which threats matter where", body: "A vehicle and a control room face different attackers." },
      { title: "Adaptive testing", body: "Fixed examples overstate a countermeasure." },
      { title: "Reproducible results", body: "Model version, attacker access, input path and expected outcome." },
      { title: "One record for both", body: "Release and input evidence in one ordered record." },
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
    description: "Research on machine trust through explicit identities, limited permissions, and approval tied to the exact change and destination.",
    title: "Authority must be explicit.",
    lead: "How AI systems are given authority, with zero trust as concrete boundaries. A research area, not a product.",
    studyTitle: "Four boundaries a request should cross.",
    studyAs: "flow",
    studyCaption: "Diagram: the four boundaries, in the order a request meets them.",
    study: [
      { title: "Explicit identity", body: "Who is asking? A named principal from a trusted source, not a self-applied label." },
      { title: "Limited permissions", body: "What may it touch? A named resource and action, not carried to other machines." },
      { title: "Approval tied to a change and destination", body: "Who agreed to what, and where? Exact, expiring, separate from the proposer." },
      { title: "Checks at execution boundaries", body: "Where is it enforced? At the moment of action, by whatever holds access." },
    ],
    exists: {
      kind: "direction",
      title: "Research direction, with no product claim.",
      paragraphs: [
        "Vraelis has no identity, access or authorization product, and makes no zero trust claim.",
        "One narrow boundary exists in the Vraelis Contour experiment: release authorization with separate publisher, deployer and approver roles, and destination-bound approval naming the environment and resource, with a 60 second age limit, checked before serving. One check, not a machine trust system.",
      ],
    },
    open: [
      { title: "Disconnected operation", body: "What a machine does when it cannot reach its approval service." },
      { title: "Single use approval", body: "Consuming an approval exactly once, at the boundary." },
      { title: "Two approval domains", body: "Supplier and operator approvals bound to one release." },
      { title: "Revocation", body: "How fast a withdrawn approval reaches every boundary." },
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
    description: "Research on readable security records: observations kept in order, with discrepancies, recovery, and uncertainty visible.",
    title: "Keep the record, including what could not be confirmed.",
    lead: "Ordered records that someone outside the team can read. A research area, not a product.",
    studyTitle: "What a record has to hold.",
    study: [
      { title: "What belongs in one observation?", body: "Approved identity, reported identity, policy result and arrival time." },
      { title: "How is missing evidence recorded?", body: "As unavailable, with a reason. Never as the last known state." },
      { title: "Can a reader tell a self-report from proof?", body: "Only if every record carries its scope." },
      { title: "How does a record stay in order?", body: "Discrepancies, gaps and recovery in one sequence, nothing hidden." },
    ],
    exists: {
      kind: "experiment",
      title: "Recorded observations, in the experiment.",
      items: [
        { kind: "impl", text: "Deployment evidence: four observations recorded in order, including evidence unavailable." },
        { kind: "impl", text: "Each keeps the approved identity, the worker's reported runtime identity and the policy result." },
        { kind: "impl", text: "Recovery verification: after one recorded explicit reload, the reported identity was compared again." },
        { kind: "impl", text: "The app refuses to import pending, missing evidence or wrong runtime observations as matched." },
        { kind: "prop", text: "Recovery failure tests, specified but not run, and an investigation workflow." },
        { kind: "not", text: "Independent attestation. Every record is a worker self-report." },
      ],
      capture: "app-observations-unavailable",
    },
    open: [
      { title: "Edited records", body: "An edited, self-consistent trace still validates today." },
      { title: "Evidence freshness", body: "Heartbeats that show a report is current, not stale. Not built." },
      { title: "Expected silence", body: "Telling a planned outage from a fault." },
      { title: "Reviewer effort", body: "Time for an outsider to reach a conclusion. Not measured." },
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

import type { CaptureName } from "../_kit/blocks";
import type { Point, ResearchSlug } from "../research/content";

// THE FIVE APPLICATION PAGES' COPY (v8, 2026-10-10). Intended application areas, never deployments: every page
// carries APPLICATIONS_NOTE under its hero. Reconciled from v6 security-direction.ts (sector pages), sector-pages.ts
// (the defense position only) and the solutions, infrastructure, government, integrators and enterprise pages, with
// the old browser testing, mission console, pricing and policy core claims dropped. "Robotics" became autonomous
// systems; robotics is one discovery segment and no company is named. Defense and government name no agency.
//
// Each page's five `steps` follow WORKFLOW in _kit/site.ts in order (identify, bind, integrate, compare,
// preserve): the page supplies the area's sentence, the kit supplies the title and what exists in the experiment.

export type AppSlug = "defense" | "critical-infrastructure" | "autonomous-systems" | "government" | "integrators";

export type AppPage = {
  slug: AppSlug;
  metaTitle: string;
  description: string;
  /** The page's one h1. */
  title: string;
  lead: string;
  whyTitle: string;
  why: [Point, Point, Point];
  /** A hypothesis, said as one, where the page needs it. */
  hypothesis?: string;
  /** The area's own line under each workflow step, or "" for none. */
  steps: [string, string, string, string, string];
  capture: CaptureName;
  /** Sector-specific review questions, grounded in the recorded reference experiment. */
  review?: { title: string; lead: string; steps: Point[] };
  /** A handoff between parties, shown directly under a text-only hero in place of the workflow steps. */
  handoff?: { title: string; lead: string; steps: { title: string; body: string; term: string; text: string; shots: CaptureName[] }[] };
  /** Defense only: Vraelis's position. */
  stance?: { title: string; lead?: string; cards: Point[] };
  notClaimed: string[];
  related: ResearchSlug[];
  /** Where Join us goes. Defaults to the Contour intake. */
  contact?: { to: string; title: string; lead: string };
};

const SELF_REPORTS = "No hardware attestation. Runtime identity is a worker self-report.";

export const APP_PAGES: Record<AppSlug, AppPage> = {
  defense: {
    slug: "defense",
    metaTitle: "Defense",
    description: "AI security for defense systems: model integrity, destination-bound release approval, and reviewable security evidence.",
    title: "AI security for defense systems.",
    lead: "Model integrity and release evidence for teams working across defense systems.",
    whyTitle: "A model update crosses organizations.",
    why: [
      { title: "Updates cross organizations", body: "Trained by one team, integrated by another, operated by a third." },
      { title: "An unexpected change is a security and operational risk", body: "A different release, or the wrong destination, changes what the system does." },
      { title: "Reviewers need to read the evidence", body: "What was approved, for where, and what the system reports running." },
    ],
    steps: ["", "Destination-bound approval: test approval cannot carry into operations.", "", "", ""],
    capture: "crop-release-approval",
    stance: {
      title: "The builder should not be the only judge.",
      cards: [
        { title: "Security software only", body: "Vraelis does not decide how a system is used." },
        { title: "Approval apart from the builder", body: "In the experiment, release authorization separates publisher, deployer and approver roles. The trace keeps a receipt digest, not the approver's identity." },
        { title: "A record kept in order", body: "Every observation is kept, including ones that confirm nothing." },
      ],
    },
    notClaimed: [
      "No deployments in defense systems, and no customers.",
      "No contracts, security clearances or government authorizations.",
      "No access to classified or restricted environments.",
      "No certification, and no claim of fitness for operational use.",
      "No protection against adversarial inputs or perception attacks.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "machine-trust", "adversarial-threats"],
  },

  "critical-infrastructure": {
    slug: "critical-infrastructure",
    metaTitle: "Critical infrastructure",
    description: "Model release integrity for energy, water, and communications systems, connecting approved updates with reported runtime state.",
    title: "AI security for critical infrastructure.",
    lead: "In energy, water and communications, vendors ship models into systems operators own.",
    whyTitle: "The model changes. The operational record must keep up.",
    why: [
      { title: "Releases cross operators", body: "Both sides need to know which release is running." },
      { title: "An unexpected release is a security and operational risk", body: "A change to an operational system, to be reviewed as one." },
      { title: "The change record needs the model", body: "What was approved, for where, and what the runtime reported." },
    ],
    steps: ["", "Destination-bound approval: one site's approval does not cover another.", "", "", "Deployment evidence kept for the operator's change process."],
    capture: "crop-loaded-unavailable",
    review: {
      title: "A site needs its own release record.",
      lead: "A proposed operator workflow, illustrated by the recorded synthetic ONNX experiment. Control-system integration and customer deployments are not implemented.",
      steps: [
        { title: "Start with the site's approval", body: "A supplier's release and the operator's authorization answer different questions. In the experiment, approval binds a release to one destination; another site's approval cannot substitute for it." },
        { title: "Keep missing evidence visible", body: "A rollout record does not establish what is loaded. The reference view separates an available runtime report from unavailable evidence. It does not establish continuous freshness or disconnected operation." },
        { title: "Carry the record into change review", body: "Compare the approved release with the reported loaded release and retain each observation, including uncertainty. Integration into an operator's change-management process remains future work." },
      ],
    },
    notClaimed: [
      "No deployments with utilities or other operators, and no customers.",
      "No integration with control systems or operational technology networks.",
      "No replacement for an operator's change management or protective controls.",
      "No certification or regulatory compliance.",
      SELF_REPORTS,
    ],
    related: ["security-evidence", "machine-trust", "model-integrity"],
  },

  "autonomous-systems": {
    slug: "autonomous-systems",
    metaTitle: "Autonomous systems",
    description: "Model release integrity for robots and autonomous vehicles, from release approval to reported runtime state.",
    title: "AI security for autonomous systems.",
    lead: "Robots and vehicles get model updates in the field, often from a supplier.",
    whyTitle: "A model update changes what a machine can do.",
    why: [
      { title: "Updates land in someone else's fleet", body: "In a facility or fleet the supplier does not operate." },
      { title: "An unexpected release is a security and operational risk", body: "A different release, or the wrong machine, changes what it does." },
      { title: "The first question is which model", body: "When a machine surprises you, the answer should come from a record." },
    ],
    hypothesis: "Robotics is one segment we study. Release and platform engineers at robotics suppliers and integrators meet this problem early.",
    steps: ["", "Destination-bound approval: one machine's approval does not cover another.", "", "A version mismatch shows as reload pending, not assumed.", ""],
    capture: "crop-pair-pending",
    review: {
      title: "The update arrived. Did the runtime load it?",
      lead: "A release-review scenario for machines in the field, illustrated by a synthetic ONNX CPU run. It is not a robot integration or evidence of physical safety.",
      steps: [
        { title: "Identify the approved update", body: "A release label alone can hide a different artifact or configuration. The experiment records model and policy identity with destination-bound approval." },
        { title: "Read what the runtime reports", body: "In the recorded run, cpu-2 is approved while cpu-1 remains loaded. The view shows reload pending. The report comes from the worker; it is not independent hardware attestation." },
        { title: "Check again after an explicit reload", body: "The next observation records cpu-2 loaded after a requested reload. That demonstrates the reference sequence, not automatic recovery across a fleet or proof that a robot behaves safely." },
      ],
    },
    notClaimed: [
      "No deployments on robots or vehicles, and no customers.",
      "No robot or vehicle integration. The experiment is a synthetic ONNX CPU workload.",
      "No protection against adversarial inputs or perception attacks.",
      "No certification, and no evidence freshness for machines in the field: heartbeats are not built.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "adversarial-threats", "security-evidence"],
  },

  government: {
    slug: "government",
    metaTitle: "Government and institutions",
    description: "Model release evidence for public-sector review: what was approved, for which system, and what the runtime reports.",
    title: "Model release evidence a reviewer can read.",
    lead: "Which model was approved, for which system, and what that system reports running.",
    whyTitle: "Oversight runs on records.",
    why: [
      { title: "Systems built by suppliers", body: "Model updates arrive from outside the institution." },
      { title: "An unexpected release is a security and operational risk", body: "For the institution responsible for the system." },
      { title: "Readable by someone outside engineering", body: "Including what could not be confirmed." },
    ],
    steps: ["", "Destination-bound approval covers that system and no more.", "", "Version mismatch shown as reload pending, in a view a reviewer can follow.", ""],
    capture: "crop-pair-pending",
    notClaimed: [
      "No government deployments, contracts or customers.",
      "No procurement status, and no authorization to operate.",
      "No access to classified or restricted environments.",
      "No certification or regulatory compliance.",
      SELF_REPORTS,
    ],
    related: ["security-evidence", "machine-trust", "model-integrity"],
    contact: {
      to: "/contact?topic=government",
      title: "Release evidence a reviewer can read.",
      lead: "Join us in building it for government and institutional review.",
    },
  },

  integrators: {
    slug: "integrators",
    metaTitle: "Suppliers and integrators",
    description: "A shared model release record for suppliers and integrators: approvals, runtime reports, and evidence both sides can review.",
    title: "For teams who ship models into systems they do not own.",
    lead: "Release, platform and security engineers at suppliers and system integrators.",
    whyTitle: "You ship it. Someone else runs it.",
    why: [
      { title: "The release lands in their system", body: "Your signature does not grant permission to change it." },
      { title: "An unexpected release creates risk", body: "For both sides, even when nobody intended harm. A baseline kept on purpose is not an incident." },
      { title: "Both sides need the same record", body: "Not a deployment log only one of you sees." },
    ],
    hypothesis: "These teams meet this problem first. We are testing it.",
    steps: ["", "Release authorization may need two approvals: the supplier's and the operator's.", "", "", "Both sides start from the same deployment evidence."],
    capture: "app-release-cpu2",
    // Founder, 2026-10-17: option A, no workshop photo, and the third step is a review either side can do, not a
    // third party. Every image is an exact crop of one recorded run.
    handoff: {
      title: "Who decides what, and what each side can check.",
      lead: "Illustrated by the recorded experiment, where these roles ran in one controlled setup. Vraelis Contour does not connect two organizations or enforce this handoff today.",
      steps: [
        { title: "Supplier approval", body: "The supplier approves the release it ships, for one intended destination.", term: "Supplier decides", text: "which release, and where it may run.", shots: ["crop-approved-cpu2-head", "crop-approval-destination"] },
        { title: "Operator observation", body: "The operator's worker reports which release it loaded. The report is a worker self-report.", term: "Operator decides", text: "whether and when to reload.", shots: ["crop-loaded-cpu1-head"] },
        { title: "Review", body: "Either side compares the two records. The review changes neither system.", term: "Here", text: "the records differ, so the comparison stays at reload pending.", shots: ["crop-conclusion-pending-head"] },
      ],
    },
    notClaimed: [
      "No customers or deployments, and no partner endorsement of Vraelis Contour.",
      "No pricing or general availability. Not for public use.",
      "No certification.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "security-evidence", "machine-trust"],
  },
};

export function appPage(slug: string): AppPage | undefined {
  return (APP_PAGES as Record<string, AppPage | undefined>)[slug];
}

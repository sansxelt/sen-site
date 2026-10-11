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
  steps: [string, string, string, string, string];
  capture: CaptureName;
  /** Defense only: Vraelis's position. */
  stance?: { title: string; lead: string; cards: Point[] };
  notClaimed: string[];
  related: ResearchSlug[];
  /** Where Join us goes. Defaults to the Contour intake. */
  contact?: { to: string; title: string; lead: string };
};

const SELF_REPORTS = "No hardware attestation. Runtime reports in the experiment are worker self-reports.";

export const APP_PAGES: Record<AppSlug, AppPage> = {
  defense: {
    slug: "defense",
    metaTitle: "Defense",
    description: "An intended application area, not a deployment: model release integrity for AI in defense systems. Vraelis builds security software for AI. It does not build weapons or mission software.",
    title: "AI security for defense systems.",
    lead: "AI in defense systems is updated by suppliers and run by others, so an unapproved model change is a security event. Vraelis builds security software for AI. It does not build weapons or mission software.",
    whyTitle: "A model update crosses organizations.",
    why: [
      { title: "Updates cross organizations", body: "A model in a defense system is often trained by one team, integrated by another and operated by a third. Every update crosses those boundaries." },
      { title: "An unapproved change is a security event", body: "A model that differs from the approved release, or runs somewhere it was not approved for, changes what the system does. Whatever the cause, it is a security event." },
      { title: "Reviewers need to read the evidence", body: "Program and security reviewers need to see what was approved, for which destination, and what the system reports running, without relying on the builder's word." },
    ],
    steps: [
      "Name each model release by its artifact, preprocessing and configuration, so a reviewer can tell one release from the next.",
      "Tie each approval to one release and one destination, so approval for a test environment cannot carry silently into an operational one.",
      "Check the runtime policy where the model is served. The experiment supports ONNX Runtime 1.23.2 on CPU; runtimes in defense systems would need adapters that do not exist.",
      "Put the approved release beside what the runtime reports loading, field by field.",
      "Keep discrepancies, unavailable evidence and recovery in order, so a gap in reporting is recorded as a gap.",
    ],
    capture: "crop-release-approval",
    stance: {
      title: "The builder should not be the only judge.",
      lead: "Where AI is part of a defense system, what was released should be checkable by people other than the team that built it, with evidence they can read.",
      cards: [
        { title: "Security software, not weapons", body: "Vraelis builds security software for AI. It does not build weapons or mission software, and it does not decide how a system is used." },
        { title: "Approval apart from the builder", body: "In the experiment, publishing, deploying and approving are separate roles in the runtime policy. The recorded trace keeps a receipt digest, not the approver's identity." },
        { title: "A record kept in order", body: "Every observation is kept, including the ones that confirm nothing. In the experiment, four observations sit in order, the last recording that evidence was unavailable." },
      ],
    },
    notClaimed: [
      "No deployments in defense systems, and no customers.",
      "No contracts, security clearances or government authorizations.",
      "No access to classified or restricted environments.",
      "No certification, and no statement that any system is fit or authorized for operational use.",
      "No protection against adversarial inputs or perception attacks. Those are research topics.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "machine-trust", "adversarial-threats"],
  },

  "critical-infrastructure": {
    slug: "critical-infrastructure",
    metaTitle: "Critical infrastructure",
    description: "An intended application area, not a deployment: model release integrity where vendors ship AI models into energy, water and communications systems that operators run.",
    title: "AI security for critical infrastructure.",
    lead: "In energy, water and communications, AI models are often supplied by vendors and run inside systems an operator owns. A release crosses from one organization to another every time it ships.",
    whyTitle: "The vendor ships it. The operator runs it.",
    why: [
      { title: "Releases cross operators", body: "A vendor trains and ships a model. The operator runs it beside equipment and change procedures it already has. Both need to know which release is running." },
      { title: "An unapproved release is a security event", body: "A model that changed without approval, or reached a site it was not approved for, is a change to an operational system and should be handled as one." },
      { title: "The change record needs the model", body: "Operators keep change records for good reason. A model update should leave a record a reviewer can read: what was approved, for where, and what the runtime reported." },
    ],
    steps: [
      "Name the release a vendor ships by its model, preprocessing and configuration, so the operator receives one exact thing.",
      "Bind the operator's approval to that release and the site or system it is for, so approval for one site does not cover another.",
      "Check the runtime policy where the model runs. The experiment supports ONNX Runtime 1.23.2 on CPU; adapters for operator runtimes are not built.",
      "Compare the approved release with what the runtime reports loading, so a pending update or a wrong version is visible.",
      "Keep discrepancies, gaps in reporting and recovery in order, so they can be reviewed within the operator's change process.",
    ],
    capture: "crop-loaded-unavailable",
    notClaimed: [
      "No deployments with utilities or other operators, and no customers.",
      "No integration with control systems or operational technology networks.",
      "No claim to replace an operator's change management or protective controls. Any integration would have to sit beside them.",
      "No certification or regulatory compliance.",
      SELF_REPORTS,
    ],
    related: ["security-evidence", "machine-trust", "model-integrity"],
  },

  "autonomous-systems": {
    slug: "autonomous-systems",
    metaTitle: "Autonomous systems",
    description: "An intended application area, not a deployment: model release integrity where AI models ship as updates to robots and vehicles in the field.",
    title: "AI security for autonomous systems.",
    lead: "Robots and vehicles receive model updates in the field, often from a supplier, into machines someone else operates. Which model each machine is running is a security question.",
    whyTitle: "Models ship to machines in the field.",
    why: [
      { title: "Updates land in someone else's fleet", body: "A supplier pushes model updates to robots and vehicles in another organization's facility or fleet. Each update lands in a system the supplier does not operate." },
      { title: "The wrong release is a security event", body: "A machine running a release other than the approved one, or an update that reached the wrong machine, changes what the machine does." },
      { title: "The first question is which model", body: "When a machine does something unexpected, the first question is which model it was running. The answer should come from a record." },
    ],
    hypothesis: "Robotics is one segment we are studying, not the whole of this area. Our hypothesis is that release and platform engineers at robotics suppliers and integrators meet this problem early. It is a hypothesis, not evidence of demand.",
    steps: [
      "Name each model release a fleet receives by its artifact, preprocessing and configuration.",
      "Bind approval to the release and to the machines or cells it is for, so approval for one machine does not cover another.",
      "Check the runtime policy on the machine before the model serves. The experiment supports ONNX Runtime 1.23.2 on CPU; on-robot runtimes and accelerators are not supported.",
      "Compare the approved release with what each machine reports loading, so an update awaiting reload is visible instead of assumed.",
      "Keep discrepancies, missing reports and reloads in order. Telling a machine that is offline by design from one that stopped reporting is still open.",
    ],
    capture: "crop-pair-pending",
    notClaimed: [
      "No deployments on robots or vehicles, and no customers.",
      "No robot or vehicle integration. The experiment is a synthetic ONNX CPU workload.",
      "No protection against adversarial inputs or perception attacks.",
      "No certification.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "adversarial-threats", "security-evidence"],
  },

  government: {
    slug: "government",
    metaTitle: "Government and institutions",
    description: "An intended application area, not a deployment: model release evidence that a reviewer at a public body can read.",
    title: "Model release evidence a reviewer can read.",
    lead: "Public bodies buy, operate and oversee AI systems that suppliers build and update. A reviewer should be able to read which model was approved, for which system, and what that system reports running.",
    whyTitle: "Oversight runs on records.",
    why: [
      { title: "Systems built by suppliers", body: "Public bodies often run or oversee systems whose models are built and updated by suppliers. Updates arrive from outside the institution." },
      { title: "An unapproved release is a security event", body: "A model running without the approval it needs, or in a system it was not approved for, is a security event for the institution responsible." },
      { title: "Readable by someone outside engineering", body: "Oversight depends on records that someone outside the engineering team can read, including what could not be confirmed." },
    ],
    steps: [
      "Name each release a supplier delivers by its model, preprocessing and configuration, so the institution and the supplier refer to the same thing.",
      "Bind approval to that release and the system it is for, so an approval cannot be read as covering more than it does.",
      "Check the runtime policy where the model runs. The experiment supports one runtime today, ONNX Runtime 1.23.2 on CPU.",
      "Compare the approved release with the reported loaded identity, in a view a reviewer can follow.",
      "Keep discrepancies, unavailable evidence and recovery in order, so a review starts from the record.",
    ],
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
      title: "Talk to us about release evidence.",
      lead: "Vraelis Contour is in private development. If your institution reviews AI systems that suppliers update, we would like to hear what a reviewer needs to read.",
    },
  },

  integrators: {
    slug: "integrators",
    metaTitle: "Suppliers and integrators",
    description: "An intended application area, not a deployment: for release, platform and security engineers who ship model updates into systems they do not own.",
    title: "For teams who ship models into systems they do not own.",
    lead: "Release, platform and security engineers at suppliers and system integrators ship model updates into systems their customers operate. Our hypothesis is that they need Vraelis Contour first.",
    whyTitle: "You ship it. Someone else runs it.",
    why: [
      { title: "The release lands in their system", body: "A supplier's release lands in a customer's system, on the customer's hardware, under the customer's change process. A supplier signature does not grant permission to change it." },
      { title: "A wrong release is a security event", body: "Shipping the wrong version, or to the wrong destination, is a security event for both sides, even when nobody intended harm." },
      { title: "Both sides need the same record", body: "When a customer asks which model is running, the answer should be a record both teams can read, not a deployment log only one of them sees." },
    ],
    hypothesis: "Our hypothesis is that release, platform and security engineers at suppliers and system integrators feel this problem first. We are testing it. It is not evidence of demand.",
    steps: [
      "Name the release you ship by its model, preprocessing and configuration, so supplier and customer refer to the same thing.",
      "Bind approval to that release and the customer destination. Some systems may need two approvals: the supplier's for the model and the operator's for where it runs.",
      "Integrate with the receiving runtime. In the experiment that is ONNX Runtime 1.23.2 on CPU only; adapters for customer runtimes are not built yet.",
      "Compare what was approved with what the customer's runtime reports loading.",
      "Keep discrepancies, unavailable evidence and recovery in order, so both sides start from the same record.",
    ],
    capture: "app-release-cpu2",
    notClaimed: [
      "No customers or deployments, and no partner endorsement of Vraelis Contour.",
      "No adapters for customer runtimes yet. The experiment supports one runtime.",
      "No pricing or general availability. Product access is closed.",
      "No certification.",
      SELF_REPORTS,
    ],
    related: ["model-integrity", "security-evidence", "machine-trust"],
  },
};

export function appPage(slug: string): AppPage | undefined {
  return (APP_PAGES as Record<string, AppPage | undefined>)[slug];
}

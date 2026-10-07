import type { DirectionContent } from "../_system/direction-page";

// Public copy describes the development direction. No customer deployments,
// certifications, production gateway or native attack detector are implied.
export const SECURITY_STATUS = [
  { title: "Access and action policies", status: "Private development", body: "A tested policy core checks exact permissions, identity freshness, model bindings and separate human approval. Live enforcement is not connected yet." },
  { title: "Recorded evidence review", status: "Private development", body: "A local evaluator checks supported task reports against reviewed criteria. It identifies conflicting states and missing evidence within the supplied recording." },
  { title: "Trusted system integrations", status: "Integration work", body: "Identity providers, artifact verification, approval services and execution boundaries must be connected to the system being secured." },
  { title: "AI-specific threat testing", status: "Research", body: "Adversarial inputs, sensor attacks, poisoned data and compromised models need their own threat models, test data and controls." },
] as const;

const item = (label: string, title: string, body: string) => ({ label, title, body });
export const SECURITY_PAGES: Record<string, DirectionContent> = {
  platform: {
    eyebrow: "AI security", title: "Security where AI meets the physical world.",
    intro: "We are developing cybersecurity for AI-enabled defense, infrastructure and robotics. Explicit authority, controlled changes and evidence engineers can investigate.",
    photo: "networkEngineer", heading: "Connect the security question to the system.",
    lead: "An AI output becomes consequential when it reaches data, tools, software or equipment. Each boundary needs its own control.",
    items: [
      item("Access", "Define what AI may reach", "Bind permissions to a workload, environment, resource and action. A model's confidence or network location does not grant authority."),
      item("Change", "Control what may be deployed", "Connect proposed actions to the reviewed policy and model version. A changed target, payload or policy needs a new decision."),
      item("Evidence", "Investigate what happened", "Link decisions to their source evidence and observed outcomes. Identify conflicting reports and uncertainty instead of assuming success."),
    ],
    showStatus: true,
    nextTitle: "Build the boundary before broadening the claim.",
    nextLead: "The next integration must prove a complete security workflow in a controlled test environment.",
    next: [
      item("Identity", "Establish the source of authority", "Connect trusted workload identity, revocation and artifact evidence. Request-supplied identity labels cannot establish trust."),
      item("Enforcement", "Check immediately before execution", "Connect policy decisions to a non-bypassable tool boundary, with approval consumption and the exact approved action."),
      item("Review", "Preserve a useful decision record", "Make policy, model and action bindings inspectable alongside the observed outcome. Build retention and access around the owner's environment."),
    ],
  },
  "zero-trust": {
    eyebrow: "Zero trust", title: "Authority must be explicit.",
    intro: "Zero trust informs how we are building AI security: verify identity, limit permissions and reassess authority at the boundary where an action occurs.",
    photo: "serverRack", heading: "Trust is scoped to a specific action.",
    lead: "Treat AI-generated content as input to the security decision. It cannot grant itself permissions or approve its own work.",
    items: [
      item("Identity", "Verify the workload", "Establish the principal and session through a trusted identity source. Reject expired, revoked or mismatched context."),
      item("Least privilege", "Bind the permission", "Use an explicit environment, resource, action and model version. Ambiguous grants and missing evidence must deny a new proposal."),
      item("Human control", "Bind consequential approvals", "Keep approval separate from the proposing workload. Tie it to the exact action and policy, with expiry and revocation."),
    ],
    showStatus: true,
    nextTitle: "A policy decision needs an enforcement boundary.",
    nextLead: "The private core is one component. A live security system also needs trusted context, controlled dispatch and operational testing.",
    next: [
      item("Integration", "Keep trusted context separate", "An identity or attestation adapter supplies verified context. A request body cannot assert that a workload is trustworthy."),
      item("Execution", "Prevent approval reuse", "Recheck the current policy and consume approval atomically before dispatch. A previously returned permit is not a reusable execution token."),
      item("Operations", "Design for the environment", "Define outages, revocation, safe operating boundaries and independent controllers with the system owner."),
    ],
  },
  problems: {
    eyebrow: "Security problems", title: "AI introduces new paths into a system.",
    intro: "Unauthorized actions, untrusted inputs and compromised artifacts can cross from AI software into operational systems. We are building around those boundaries.",
    photo: "hardwareInspection", heading: "Separate the threats. Match the controls.",
    lead: "A single dashboard or model score cannot establish security across every part of an AI-enabled system.",
    items: [
      item("Authority", "An output exceeds its permissions", "A proposed tool call, data export or configuration change reaches beyond the workload's allowed scope. Authority must be checked independently."),
      item("Inputs", "Untrusted content influences an action", "Prompt injection and adversarial sensor inputs affect different model families. Test the input path and constrain the actions it can cause."),
      item("Integrity", "The approved system changes", "Model artifacts, dependencies or data may change without review. Bind provenance and versions to controlled deployment decisions."),
    ],
    nextTitle: "Detection and investigation need evidence.",
    nextLead: "These are development and research areas. The private policy core does not claim universal attack detection.",
    next: [
      item("Monitoring", "Distinguish change from compromise", "Performance drift may have an operational cause. Establish the baseline and available evidence before attributing a change to an attack."),
      item("Investigation", "Expose contradictions and gaps", "Connect a proposed action, security decision and reported outcome. Missing evidence should remain visible to the reviewer."),
      item("Evaluation", "Test against a defined threat", "Use system-specific attack cases and known outcomes. Measure missed attacks, incorrect denials and the cost of investigation."),
    ],
  },
  goals: {
    eyebrow: "Our goals", title: "Build security teams can depend on.",
    intro: "Develop cybersecurity for AI-enabled defense, infrastructure and physical systems. Earn adoption through working controls, evidence and a clear understanding of each environment.",
    photo: "satelliteStation", heading: "Make the product useful before expanding it.",
    lead: "Start with a defined security boundary and a complete workflow that engineers and security reviewers can test.",
    items: [
      item("Product", "Establish explicit authority", "Build from the private policy core toward authenticated identity, controlled execution and inspectable decisions."),
      item("Systems", "Work with real constraints", "Develop integrations around the owner's models, interfaces, data boundaries and operational requirements."),
      item("Company", "Earn government and industry work", "Pursue U.S. government and industry opportunities through demonstrated capability and the applicable acquisition requirements."),
    ],
    nextTitle: "Evidence should govern the next step.", nextLead: "A research direction becomes a capability when its implementation and limits have been tested.",
    next: [
      item("Build", "Complete one test integration", "An allowed action succeeds once. An unauthorized or changed proposal is denied before dispatch."),
      item("Evaluate", "Measure security and usability", "Document attack coverage, incorrect denials, reviewer effort and integration cost against a defined baseline."),
      item("Expand", "Qualify additional environments", "Assess private and disconnected deployments separately, against the security and acquisition requirements of each environment."),
    ],
  },
  beta: {
    eyebrow: "Private development", title: "The product is being built privately.",
    intro: "The app and console are closed. We are developing AI-security controls and evidence review for defense, infrastructure and physical systems.",
    photo: "robotDetail", heading: "A foundation with a specific purpose.",
    lead: "The private work connects what a workload is allowed to do with the evidence needed to inspect its behavior.",
    items: [
      item("Policy", "Check explicit permissions", "Evaluate exact identity, resource, environment and model bindings, with separate approval for consequential actions."),
      item("Evidence", "Review recorded behavior", "Compare supported task reports against reviewed criteria. Trace findings to source events and declared capture coverage."),
      item("Integration", "Connect controls to execution", "Build trusted identity adapters and a controlled action boundary. These are not yet a deployed enforcement service."),
    ],
    showStatus: true, nextTitle: "A complete private workflow is the milestone.",
    nextLead: "Public app access will follow a reviewed product decision, rather than a demo link or existing account session.",
    next: [
      item("Context", "Authenticate the system", "Establish the source of identity and model evidence instead of trusting supplied labels."),
      item("Control", "Enforce the approved scope", "Recheck authority before dispatch and prevent the same approval from authorizing multiple executions."),
      item("Record", "Make the result reviewable", "Retain the policy decision and observed outcome with appropriate access and retention."),
    ],
  },
};

function sector(title: string, photo: DirectionContent["photo"], intro: string, items: DirectionContent["items"]): DirectionContent {
  return {
    eyebrow: "AI security / Application area", title, photo, intro,
    heading: "Start with the system's security boundary.",
    lead: "These are intended application areas. Scope depends on the models, interfaces, evidence and operational environment.", items,
    nextTitle: "Define the environment before the integration.",
    nextLead: "The integration has to fit the system owner's identity, data boundaries and operating requirements.",
    next: [
      item("System", "Identify the AI-enabled workflow", "Name the model, workload, tools and data it can reach, and where a proposal becomes an action."),
      item("Threat", "Define the security problem", "Identify unauthorized access, unreviewed changes or untrusted input paths. Specify what evidence could establish the outcome."),
      item("Environment", "Agree the integration boundaries", "Document identity, hosting, connectivity, data restrictions and independent operating controls before access is considered."),
    ],
  };
}
SECURITY_PAGES.defense = sector("AI security for defense systems.", "helicopter",
  "For engineering and security teams developing AI-enabled mission systems. Explicit authority, controlled model changes and traceable security decisions.", [
    item("Workloads", "Scope access to the mission environment", "Bind authority to the workload and resource. Test-environment access must not silently carry into operational systems."),
    item("Changes", "Review model and software changes", "Connect model versions and proposed actions to the approved policy. Preserve the distinction between a proposal and authorized execution."),
    item("Review", "Make security decisions inspectable", "Give engineering and program reviewers the policy basis, action scope and available evidence for each decision."),
  ]);
SECURITY_PAGES.infrastructure = sector("AI security for critical infrastructure.", "powerGrid",
  "For utilities, transport and industrial operations introducing AI into their systems. Define access, protect configuration boundaries and investigate reported behavior.", [
    item("Access", "Keep authority specific", "Separate telemetry access from configuration changes, model deployment and equipment commands."),
    item("Operations", "Protect the change boundary", "Require review of consequential actions and version changes. Design outage behavior alongside the owner's operating controls."),
    item("Evidence", "Investigate the handoff", "Connect service and equipment reports to the relevant task. Contradictory or absent reports require investigation."),
  ]);
SECURITY_PAGES.robotics = sector("AI security for robotics.", "robotArm",
  "For teams building AI-enabled robots and autonomous equipment. Constrain model access and proposed actions while keeping the available device evidence inspectable.", [
    item("Authority", "Bind actions to the intended asset", "A workload's permissions must identify the resource and operation. Authority for one robot does not imply authority for another."),
    item("Integrity", "Track the approved model version", "Connect verified artifact evidence to deployment decisions. A supplied version string alone does not establish provenance."),
    item("Research", "Evaluate perception-specific threats", "Adversarial sensor inputs need model-specific testing and trustworthy observations. Native sensor attack detection is not built yet."),
  ]);
SECURITY_PAGES.government = sector("Government and institutions.", "satelliteStation",
  "Developing AI security for institutional mission systems and public infrastructure. Discuss the security problem, system boundaries and required environment.", [
    item("Security", "Define the authority boundary", "Identify the AI workload, what it can access and which actions require independent authorization."),
    item("Engineering", "Connect evidence to review", "Establish policy, model and configuration bindings that engineers and program reviewers can inspect."),
    item("Acquisition", "Assess fit and requirements", "Establish the intended use, data restrictions and deployment requirements early in the engineering process."),
  ]);
SECURITY_PAGES.integrators = sector("System integrators.", "networkEngineer",
  "Developing AI security across software, models and equipment from multiple suppliers. Establish the trust boundary between components before connecting authority.", [
    item("Identity", "Map the principals", "Document which supplier workload requests access, which service verifies identity and which component executes the action."),
    item("Policy", "Make scope portable and explicit", "Define the allowed resource and action without assuming that neighboring components share the same authority."),
    item("Evidence", "Preserve source relationships", "Identify where observations originate. Two reports copied from one controller are not independent evidence."),
  ]);
SECURITY_PAGES.enterprise = sector("Security for AI-enabled operations.", "serverRack",
  "For engineering and security teams responsible for AI-enabled operational systems. Define access, model-change controls and investigation requirements.", [
    item("Ownership", "Define who grants authority", "Keep administrator policy and human review separate from the workload proposing an action."),
    item("Data", "Map the data boundaries", "Identify what the workload may read or export, where records may be retained and which identities may inspect them."),
    item("Integration", "Work with the existing environment", "Qualify identity, hosting and interface requirements before claiming deployment support."),
  ]);

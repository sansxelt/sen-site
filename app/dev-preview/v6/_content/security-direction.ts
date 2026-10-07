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
    eyebrow: "The product direction", title: "Control AI access. Review what follows.",
    intro: "For engineering and security teams connecting AI to operational systems. We are developing scoped action controls and evidence review, starting with a controlled test integration.",
    photo: "networkEngineer", heading: "The permission belongs to the system owner.",
    lead: "Reading telemetry, deploying a model and changing equipment are separate operations. A convincing AI output cannot authorize any of them.",
    items: [
      item("Access", "Separate observation from control", "Allow a specific workload to read the data it needs without inheriting permission to export it, deploy a model or command a device."),
      item("Change", "Approve the exact proposed action", "Keep consequential approval independent of the AI workload. Bind it to the target, payload, model and policy; a changed proposal needs a new decision."),
      item("Evidence", "Keep the decision and result connected", "Preserve why an action was permitted or denied, then connect it to the observations available. A service response alone does not establish a physical outcome."),
    ],
    story: {
      photo:"robotCell", eyebrow:"The first workflow", title:"One boundary, from request to review.",
      paragraphs:[
        "Our first integration target is an AI-assisted engineering workflow in a controlled test environment: scoped telemetry access, a proposed change and a separate approval before dispatch.",
        "The engineering goal is to prove that a permitted action can execute once, changed or unauthorized proposals cannot dispatch, and a reviewer can inspect the decision and available outcome evidence.",
      ],
    },
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
    story: {
      photo:"firmware", eyebrow:"The execution boundary", title:"A permit is only part of the control.",
      paragraphs:[
        "A policy engine can return a decision. The component holding access to the resource must enforce it against the exact request, current authority and any required approval.",
        "We are building toward that connection. Trusted identity, artifact verification, revocation and one-time approval handling remain integration work; the private decision core alone does not secure equipment.",
      ],
    },
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
    story: {
      photo:"mission", eyebrow:"Threat boundaries", title:"Security depends on the path to the system.",
      paragraphs:[
        "Untrusted text can influence a tool-using assistant. A manipulated sensor can affect a perception model. A compromised model artifact can introduce a different failure path.",
        "Each needs its own threat model and testing. Independent authorization limits what a workload may do; it does not establish that the model is accurate or that every attack has been detected.",
      ],
    },
    nextTitle: "Detection and investigation need evidence.",
    nextLead: "These are development and research areas. The private policy core does not claim universal attack detection.",
    next: [
      item("Monitoring", "Distinguish change from compromise", "Performance drift may have an operational cause. Establish the baseline and available evidence before attributing a change to an attack."),
      item("Investigation", "Expose contradictions and gaps", "Connect a proposed action, security decision and reported outcome. Missing evidence should remain visible to the reviewer."),
      item("Evaluation", "Test against a defined threat", "Use system-specific attack cases and known outcomes. Measure missed attacks, incorrect denials and the cost of investigation."),
    ],
  },
  goals: {
    eyebrow: "Our goals", title: "Build security that teams can depend on.",
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
    story: {
      photo:"electronicsBench", eyebrow:"Engineering milestone", title:"Connect the components. Test the whole path.",
      paragraphs:[
        "The current private components evaluate policy decisions and supported recordings. The next milestone connects trusted identity, separate approval, controlled dispatch and retained evidence in one test workflow.",
        "Evaluation must cover denial, approval replay, revocation, outages and successful authorized work. Product access remains closed while this integration is developed.",
      ],
    },
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

// Each application area explains a distinct operating constraint with licensed photography.
SECURITY_PAGES.defense.story = {
  photo:"mission", eyebrow:"Mission authority", title:"Keep authority tied to the mission.",
  paragraphs:[
    "An AI-enabled mission workflow may span operators, models and equipment from several suppliers. Authority must remain tied to the identity, environment and operation approved by the owner.",
    "Test and operational credentials, model updates, connectivity limits and record access need separate treatment. Defense deployment and acquisition requirements must be established for the actual program.",
  ],
};
SECURITY_PAGES.infrastructure.story = {
  photo:"windFarm", eyebrow:"Operational continuity", title:"Protect the boundary without disrupting the process.",
  paragraphs:[
    "An AI maintenance workflow may need operational data without continuous access back into the control network. Proposed changes must respect the owner's existing access paths and change procedures.",
    "Outage behavior belongs in the system's operating design. AI security controls must preserve independent safety mechanisms and established automation; a generic shutdown rule is not an operational strategy.",
  ],
};
SECURITY_PAGES.robotics.story = {
  photo:"robotfleet", eyebrow:"Device authority", title:"A permission must name the equipment.",
  paragraphs:[
    "The same model can serve multiple devices with different operating limits. Authority for one asset, software version or test environment must not transfer silently to another.",
    "Start with one integration and distinguish a proposed command, authorized dispatch and reported device state. Physical safety and perception testing require additional system-specific evidence.",
  ],
};
SECURITY_PAGES.government.story = {
  photo:"public", eyebrow:"Program requirements", title:"The environment shapes the implementation.",
  paragraphs:[
    "Government systems bring program-specific data handling, identity, hosting and acquisition requirements. A public inquiry should establish that context before any deployment is proposed.",
    "We are building privately. We do not claim an authorization to operate, government certification or access to classified environments.",
  ],
};
SECURITY_PAGES.integrators.story = {
  photo:"hardwareInspection", eyebrow:"Multiple suppliers", title:"Make ownership visible at every handoff.",
  paragraphs:[
    "One supplier may provide the model, another the tool interface and another the controller. The integration needs a clear owner for identity, policy, approval and actual execution.",
    "Our direction is to connect those responsibilities to a reviewable decision record. Native protocol support must be qualified per integration rather than implied by a universal platform label.",
  ],
};
SECURITY_PAGES.enterprise.story = {
  photo:"networkEngineer", eyebrow:"Engineering and security", title:"Fit the controls to the existing system.",
  paragraphs:[
    "The teams operating the system already have identities, change procedures and security records. An additional AI control must have a defined role within those controls.",
    "Assess integration effort, authorization gaps, incorrect denials and reviewer time against the existing workflow. Broad visibility alone is not enough to justify a new product.",
  ],
};

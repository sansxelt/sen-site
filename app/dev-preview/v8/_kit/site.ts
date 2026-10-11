// ONE PLACE FOR THE V8 SITE'S ROUTES, MENUS AND FACTS.
//
// Every page reads its claims from FACTS and STATUS below, so a fact cannot say one thing on the homepage and
// another on /contour (the x.ai study found Colossus at "150K GPUs, 90 days" on one page and "200K, 122 days" on
// another). Sources are the founder's brief of 2026-10-10 and Startup QA replies d9815366 and 8a2173c7.
//
// While v8 is a preview it lives under /dev-preview/v8. Promoting it is this one constant plus the proxy table.
export const V8_BASE = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1" ? "" : "/dev-preview/v8";
export const href = (path: string) => (path === "/" ? V8_BASE || "/" : `${V8_BASE}${path}`);

export const TAGLINE = "AI security for defense, critical infrastructure and autonomous systems.";
export const AREAS = ["defense", "critical infrastructure", "autonomous systems"] as const;
export const COMPANY_LINE = "Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems.";
export const WORK_LINE = "Our work spans model integrity, adversarial threats, machine trust and security evidence.";
export const CONTOUR = {
  name: "Vraelis Contour",
  headline: "Know what you are releasing.",
  line: "Model release security, from approval to reported runtime state.",
  status: "In private development.",
  audience: "Release, platform and security engineers at suppliers and system integrators.",
} as const;
export const FOREMAKE = "Vraelis is part of Foremake, the holding company behind Vraelis and Overlym.";
export const FOUNDER = "Nishanth Dasari";

/** The caption every Contour screen carries. Captures come from the read-only app reading the recorded trace. */
export const CAPTURE_CAPTION = "Inside the controlled ONNX reference experiment. Read-only evidence app, private development.";
export const CAPTURE_SCOPE = "Recorded worker self-reports from a synthetic ONNX CPU experiment. Not hardware attestation, not a customer deployment.";

export type Kind = "impl" | "meas" | "prop" | "hyp" | "not";
export const KIND_LABEL: Record<Kind, string> = { impl: "Working in the experiment", meas: "Measured", prop: "Proposed", hyp: "Hypothesis", not: "Not claimed" };

/** The status ledger, the single source for every "where we are" list on the site. */
export const STATUS = {
  working: [
    "Signed release and approval bindings",
    "Runtime policy enforcement: ONNX Runtime 1.23.2, CPUExecutionProvider only",
    "Real CPU inference on the approved bytes",
    "Desired against reported loaded observations, in baseline and reconcile modes",
    "A read-only evidence app over the recorded trace",
  ],
  building: [
    "A Kubernetes collector (proposed in specification v1.3)",
    "Heartbeat freshness for runtime reports",
    "Live fault runs",
    "A latency study",
    "Adapters for customer runtimes",
  ],
  notClaimed: [
    "Hardware attestation",
    "Customer deployments or adoption",
    "Certification or regulatory compliance",
    "Pricing or general availability",
  ],
} as const;

export const FACTS = {
  tests: { value: "131 of 131", label: "experiment tests pass offline, reproduced by QA", kind: "meas" as Kind },
  runtime: { value: "ONNX Runtime 1.23.2", label: "on CPU, the one supported runtime", kind: "impl" as Kind },
  observations: { value: "4 recorded", label: "observations in the captured run", kind: "impl" as Kind },
} as const;

export const WORKFLOW = [
  { n: "01", title: "Identify the release", body: "Name the model artifact, its preprocessing and its configuration by digest, so a release is one exact thing.", kinds: [["impl", "Model and configuration digests"], ["prop", "Preprocessing identity"]] as [Kind, string][], shot: "crop-release-identity" },
  { n: "02", title: "Bind approval to the release and destination", body: "An approval names the exact release and where it may run, under a runtime policy with an age limit.", kinds: [["impl", "Signed bindings in the experiment"]] as [Kind, string][], shot: "crop-release-approval" },
  { n: "03", title: "Integrate with a supported runtime", body: "The receiving runtime checks the policy before it serves. Today that is ONNX Runtime 1.23.2 on CPU.", kinds: [["impl", "ONNX Runtime 1.23.2, CPU"], ["prop", "Customer runtime adapters"]] as [Kind, string][], shot: "app-policy" },
  { n: "04", title: "Compare approved and reported", body: "Put the approved identity beside the identity the runtime reports loading, field by field.", kinds: [["impl", "Evidence app"]] as [Kind, string][], shot: "crop-pair-pending" },
  { n: "05", title: "Preserve discrepancies, missing evidence and recovery", body: "Keep every observation, including the ones that cannot confirm anything, and the explicit reload that followed.", kinds: [["impl", "Recorded observations"], ["prop", "Investigation workflow"]] as [Kind, string][], shot: "app-observations-unavailable" },
] as const;

/** The four recorded observations, as the app shows them. Times are UTC from the trace. */
export const OBSERVATIONS = [
  { n: "01", title: "Approved release loaded", state: "Matched", tone: "go", shot: "app-destination-loaded", line: "cpu-1 approved and reported loaded. Every identity field matches." },
  { n: "02", title: "Update awaiting reload", state: "Reload pending", tone: "wait", shot: "app-destination-pending", line: "cpu-2 approved while cpu-1 stays loaded. Baseline mode waits for an explicit reload." },
  { n: "03", title: "Reload completed", state: "Matched", tone: "go", shot: "app-destination-reloaded", line: "After the explicit reload, the runtime reports cpu-2 and every field matches." },
  { n: "04", title: "Runtime report unavailable", state: "Evidence unavailable", tone: "stop", shot: "app-destination-unavailable", line: "The worker stopped. cpu-2 stays approved, and nothing reports what is loaded." },
] as const;

export const RESEARCH = [
  { slug: "model-integrity", title: "Model integrity", line: "Whether the model that runs is the model that was approved.", photo: "embeddedBoard" },
  { slug: "adversarial-threats", title: "Adversarial threats", line: "Inputs, updates and supply paths built to change what a model does.", photo: "boardInspection" },
  { slug: "machine-trust", title: "Machine trust", line: "Explicit identity, limited permissions and checks at execution boundaries.", photo: "networkSwitch" },
  { slug: "security-evidence", title: "Security evidence", line: "Records a person can read, kept in order, including what could not be confirmed.", photo: "laboratoryRoom" },
] as const;

export const APPLICATIONS = [
  { slug: "defense", title: "Defense", line: "AI in mission systems, where an unapproved model change is a security event.", photo: "communicationsDishes" },
  { slug: "critical-infrastructure", title: "Critical infrastructure", line: "AI in energy, water and communications, where releases cross operators.", photo: "substationNetwork" },
  { slug: "autonomous-systems", title: "Autonomous systems", line: "AI in robots and vehicles, where models ship to machines in the field.", photo: "robotMotion" },
  { slug: "government", title: "Government and institutions", line: "Public bodies that need evidence a reviewer can read.", photo: "operationalCompute" },
  { slug: "integrators", title: "Suppliers and integrators", line: "The teams who ship model updates into systems they do not own.", photo: "integrationWorkshop" },
] as const;
export const APPLICATIONS_NOTE = "Intended application areas. Vraelis has no customer deployments in them.";

/** Join us routes into the existing contact intake: audience and topic arrive already chosen. */
export const JOIN = [
  { label: "Discuss Vraelis Contour", hint: "Release, platform and security teams", to: "/contact?topic=contour" },
  { label: "Research collaboration", hint: "Researchers and academic teams", to: "/contact?topic=research" },
  { label: "Government or institution", hint: "Public bodies", to: "/contact?topic=government" },
  { label: "Report a security issue", hint: "Disclosure", to: "/security#report" },
] as const;

export type MenuLink = { label: string; to: string; line?: string; preview?: string; previewAlt?: string; top?: boolean };
export type Menu = { id: string; label: string; kind: "mega" | "list"; links: MenuLink[]; foot?: string };

const crop = (name: string) => `/v8/contour/${name}.webp`;

export const MENUS: Menu[] = [
  {
    id: "contour", label: "Contour", kind: "mega", foot: "Vraelis Contour is in private development.",
    links: [
      { label: "Overview", to: "/contour", line: "Model release security, from approval to reported runtime state.", preview: crop("crop-approved-cpu2"), previewAlt: "Approved release cpu-2 with its identity digests." },
      { label: "How it works", to: "/contour#how", line: "Five steps from release identity to preserved evidence.", preview: crop("crop-release-approval"), previewAlt: "The approval for cpu-2: destination, policy and age limit." },
      { label: "Recorded observations", to: "/contour#observations", line: "Four real observations from the reference experiment.", preview: crop("crop-loaded-cpu1"), previewAlt: "Reported loaded release cpu-1, a worker self-report, with the differing fields marked." },
      { label: "Development status", to: "/contour/status", line: "What works today, what is being built, what we do not claim.", preview: crop("crop-release-identity"), previewAlt: "Release identity for cpu-2, with preprocessing not recorded." },
    ],
  },
  {
    id: "research", label: "Research", kind: "list",
    links: [{ label: "Overview", to: "/research" }, ...RESEARCH.map((r) => ({ label: r.title, to: `/research/${r.slug}` }))],
  },
  {
    id: "applications", label: "Applications", kind: "list",
    links: [{ label: "Overview", to: "/applications" }, ...APPLICATIONS.map((a) => ({ label: a.title, to: `/applications/${a.slug}` }))],
  },
  {
    id: "company", label: "Company", kind: "list",
    links: [
      { label: "About", to: "/company" },
      { label: "Partners", to: "/partners" },
      { label: "Changelog", to: "/changelog" },
      { label: "Security", to: "/security" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

export const FOOTER: { title: string; links: { label: string; to: string }[] }[] = [
  { title: "Vraelis Contour", links: [{ label: "Overview", to: "/contour" }, { label: "How it works", to: "/contour#how" }, { label: "Development status", to: "/contour/status" }, { label: "Documentation", to: "/docs" }] },
  { title: "Research", links: [{ label: "Overview", to: "/research" }, ...RESEARCH.map((r) => ({ label: r.title, to: `/research/${r.slug}` }))] },
  { title: "Applications", links: APPLICATIONS.map((a) => ({ label: a.title, to: `/applications/${a.slug}` })) },
  { title: "Company", links: [{ label: "About", to: "/company" }, { label: "Partners", to: "/partners" }, { label: "Changelog", to: "/changelog" }, { label: "Contact", to: "/contact" }, { label: "Join us", to: "/contact?topic=contour" }] },
  { title: "Trust", links: [{ label: "Security", to: "/security" }, { label: "Subprocessors", to: "/subprocessors" }, { label: "Data rights", to: "/data-rights" }, { label: "Image sources", to: "/image-sources" }] },
  { title: "Legal", links: [{ label: "Terms", to: "/terms" }, { label: "Privacy", to: "/privacy" }, { label: "Cookies", to: "/cookies" }, { label: "Acceptable use", to: "/acceptable-use" }, { label: "Trademark", to: "/trademark" }, { label: "All policies", to: "/legal" }] },
];

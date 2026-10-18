// ONE PLACE FOR THE V8 SITE'S ROUTES, MENUS AND FACTS.
//
// Every page reads its claims from FACTS and STATUS below, so a fact cannot say one thing on the homepage and
// another on /contour (the x.ai study found Colossus at "150K GPUs, 90 days" on one page and "200K, 122 days" on
// another). Sources are the founder's brief of 2026-10-10 and Startup QA replies d9815366 and 8a2173c7.
//
// While v8 is a preview it lives under /dev-preview/v8. Promoting it is this one constant plus the proxy table.
export const V8_BASE = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1" ? "" : "/dev-preview/v8";
/** A path on this deployment, never rewritten to another host. */
export const localHref = (path: string) => (path === "/" ? V8_BASE || "/" : `${V8_BASE}${path}`);

/** THE DOCS' PUBLIC ADDRESS. The docs are their own host, docs.vraelis.com (lib/docs-host.ts). Once v8 is public on
 *  the production deployment, every site link to /docs goes there; anywhere else (local, Vercel previews, the
 *  /dev-preview/v8 review) it stays on the docs' path on this deployment, so it works without the subdomain.
 *  NEXT_PUBLIC_VRAELIS_DOCS_ORIGIN overrides both (e.g. a preview docs domain); set it to "local" (or "") to keep
 *  links on this deployment, as the *.vercel.app review build does. */
const DOCS_ENV = process.env.NEXT_PUBLIC_VRAELIS_DOCS_ORIGIN;
const DOCS_PUBLIC_ORIGIN = (DOCS_ENV === "local" ? "" : DOCS_ENV ?? (
  process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1" && process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "https://docs.vraelis.com" : ""
)).replace(/\/$/, "");
const isDocsPath = (path: string) => path === "/docs" || /^\/docs[/?#]/.test(path);

/** A site path as a link. /docs paths go to the docs' public address when there is one (see above). */
export const href = (path: string) => {
  if (DOCS_PUBLIC_ORIGIN && isDocsPath(path)) {
    const rest = path.slice("/docs".length);
    return DOCS_PUBLIC_ORIGIN + (rest.startsWith("/") ? rest : `/${rest}`);
  }
  return localHref(path);
};

export const TAGLINE = "AI security for defense, critical infrastructure and autonomous systems.";
export const AREAS = ["defense", "critical infrastructure", "autonomous systems"] as const;
/** The hero rotation: the three core areas first, then intended applications (not products, not deployments), in the
 *  founder's order. It loops straight back to the start, so it reads as an ongoing list. */
export const HERO_KEYWORDS = [
  "defense.", "critical infrastructure.", "autonomous systems.",
  "deployed AI models.", "model updates.", "edge AI.", "machine vision.", "perception systems.", "industrial automation.",
  "autonomous fleets.", "distributed inference.", "field-deployed systems.", "inspection systems.", "AI supply chains.",
  "mission-critical workloads.",
];

/** The precise vocabulary, each term tied to where it stands (founder, 2026-10-10). */
export const TERMS: { term: string; line: string; kind: Kind; status: string }[] = [
  { term: "Artifact integrity", line: "The model bytes are checked against the approved digest before a session loads them.", kind: "impl", status: "In the experiment" },
  { term: "Configuration integrity", line: "The configuration digest is part of the release and compared on every report.", kind: "impl", status: "In the experiment" },
  { term: "Release authorization", line: "A release is signed and approved before it can be loaded.", kind: "impl", status: "In the experiment" },
  { term: "Destination-bound approval", line: "An approval names the environment and resource it applies to.", kind: "impl", status: "In the experiment" },
  { term: "Runtime identity", line: "The runtime reports which release it loaded, under which runtime policy.", kind: "impl", status: "Worker self-report" },
  { term: "Version mismatch", line: "Approved and reported identities differ, shown as reload pending.", kind: "impl", status: "In the experiment" },
  { term: "Deployment evidence", line: "Every observation is kept, including ones that confirm nothing.", kind: "impl", status: "Recorded trace" },
  { term: "Recovery verification", line: "After an explicit reload the reported identity is compared again.", kind: "impl", status: "One recorded reload" },
  { term: "Unauthorized changes", line: "Wrong destinations and changed components as scripted fault tests.", kind: "prop", status: "Specified, not run" },
  { term: "Evidence freshness", line: "Heartbeats that show a report is current, not stale.", kind: "prop", status: "Not built" },
  { term: "Model provenance", line: "Where a model and its training inputs came from, beyond its digest.", kind: "hyp", status: "Research" },
];

export const COMPANY_LINE = "Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems.";
export const WORK_LINE = "Our work spans model integrity, adversarial threats, machine trust and security evidence.";
export const CONTOUR = {
  name: "Vraelis Contour",
  headline: "Know what you are releasing.",
  line: "Model release security, from approval to reported runtime state.",
  status: "In private development.",
  audience: "Release, platform and security engineers at suppliers and system integrators.",
  /** What it does, before any count (content review 2026-10-11). */
  job: "An approved update is not proof it loaded. Contour compares the approved model release with what the receiving runtime reports running, and records differences or unavailable evidence.",
  /** The reference path today: never broader than this. */
  scope: "Private development. A synthetic ONNX CPU experiment; runtime reports are trusted worker self-reports.",
} as const;
// Founder, 2026-10-11: Foremake, Inc, Vraelis and Overlym are unincorporated brands. "Foremake, Inc" is the brand name as
// written (keep the "Inc"), but nothing may call it a registered corporation, a holding company or a parent company.
export const FOREMAKE = "Foremake, Inc is the umbrella brand behind Vraelis and Overlym. Vraelis develops AI cybersecurity software, and Vraelis Contour, its first product, is in private development. Overlym is a separate fintech venture in development.";
export const FOUNDER = "Nishanth Dasari";

/** The caption every Contour screen carries. Captures come from the read-only app reading the recorded trace. */
export const CAPTURE_CAPTION = "Read-only evidence app, inside the controlled ONNX reference experiment.";
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
    "Private collector prototype; host-checked",
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
  tests: { value: "133 of 133", label: "experiment tests at the runtime rejection-diagnostics revision, in the pinned network-disabled harness, reproduced by internal automated testing on a separate build on October 10, 2026 (Pacific)", short: "internal experiment tests, runtime rejection-diagnostics revision, reproduced offline", kind: "meas" as Kind },
  /** History: the earlier suite. 133 supersedes its count; they are never added together. */
  testsEarlier: { value: "131 of 131", label: "experiment tests at the earlier runtime-policy revision, reproduced by internal automated testing", kind: "meas" as Kind },
  runtime: { value: "ONNX Runtime 1.23.2", label: "on CPU, the one supported runtime", kind: "impl" as Kind },
  observations: { value: "4 recorded", label: "observations in the captured run", kind: "impl" as Kind },
} as const;

export const WORKFLOW = [
  { n: "01", title: "Identify the release", body: "Artifact integrity and configuration integrity: the model and its configuration are named by digest. Preprocessing identity is proposed.", kinds: [["impl", "Model and configuration digests"], ["prop", "Preprocessing identity"]] as [Kind, string][], shot: "crop-release-identity" },
  { n: "02", title: "Bind approval to the release and destination", body: "Release authorization with destination-bound approval: one exact release, one named environment, an age limit.", kinds: [["impl", "Signed bindings in the experiment"]] as [Kind, string][], shot: "crop-release-approval" },
  { n: "03", title: "Integrate with a supported runtime", body: "The receiving runtime checks its runtime policy before it serves. Today that is ONNX Runtime 1.23.2 on CPU.", kinds: [["impl", "ONNX Runtime 1.23.2, CPU"], ["prop", "Customer runtime adapters"]] as [Kind, string][], shot: "app-policy", narrow: ["crop-policy-requirements"] },
  { n: "04", title: "Compare approved and reported", body: "Runtime identity beside the approved release, field by field, so a version mismatch is visible.", kinds: [["impl", "Evidence app"]] as [Kind, string][], shot: "crop-pair-pending", narrow: ["crop-approved-cpu2", "crop-loaded-cpu1"] },
  { n: "05", title: "Preserve discrepancies, missing evidence and recovery", body: "Deployment evidence and recovery verification: every observation kept, including the ones that confirm nothing.", kinds: [["impl", "Recorded observations"], ["prop", "Investigation workflow"]] as [Kind, string][], shot: "app-observations-unavailable", narrow: ["crop-observations-list"] },
] as const;

/** The four recorded observations, as the app shows them. Times are UTC from the trace. */
export const OBSERVATIONS = [
  { n: "01", title: "Approved release loaded", state: "Matched", tone: "go", shot: "app-destination-loaded", line: "cpu-1 approved and reported loaded. Every identity field matches." },
  { n: "02", title: "Update awaiting reload", state: "Reload pending", tone: "wait", shot: "app-destination-pending", line: "cpu-2 approved while cpu-1 stays loaded. Baseline mode waits for an explicit reload." },
  { n: "03", title: "Reload completed", state: "Matched", tone: "go", shot: "app-destination-reloaded", line: "After the explicit reload, the runtime reports cpu-2 and every field matches." },
  { n: "04", title: "Runtime report unavailable", state: "Evidence unavailable", tone: "stop", shot: "app-destination-unavailable", line: "The worker stopped. cpu-2 stays approved, and nothing reports what is loaded." },
] as const;

/** Observation times and the reason code, as the captured app shows them (trace captured 2026-10-10, UTC). Shared by
 *  /contour and the docs' observation pages. */
export const OBSERVATION_TIMES: Record<string, { time: string; reason?: string }> = {
  "01": { time: "07:41:29.606" },
  "02": { time: "07:41:29.613" },
  "03": { time: "07:41:29.619" },
  "04": { time: "07:41:29.723", reason: "RUNTIME_UNAVAILABLE" },
};

/** Where each status line comes from. Shared by /contour/status and the docs' sources page. */
export const STATUS_SOURCES = {
  brief: { label: "Founder brief, 10 October 2026", line: "What is implemented, unfinished and never claimed." },
  qaTests: { label: "Internal automated testing, runtime-policy revision", line: "The 131 tests of the earlier runtime-policy revision, reproduced offline on a separate pinned Docker build. Runtime policy enforcement checked." },
  qaRejection: { label: "Internal automated testing, October 10, 2026 (runtime rejection-diagnostics revision)", line: "133 of 133 at source revision contour-runtime-status-rejection-v1, run with networking disabled (NetworkMode none before and after, exit 0). The retained test log was checked against its SHA-256 (441d44b4…08c5)." },
  qaApp: { label: "Internal automated review of the evidence app", line: "Evidence app review: five findings, each addressed in the current version." },
  spec: { label: "Specification v1.3", line: "Internal proposal that describes the Kubernetes collector. Not frozen." },
  collector: { label: "Private engineering record, October 17, 2026", line: "Host checks of the private Kubernetes collector prototype. Live-cluster validation of the current revision has not been run. The record is not public." },
} as const;

/** Short names for the browser tab (founder, 2026-10-12: "ensure all tabs actually fit"). A tab shows about 24
 *  characters, so a page's tab title is "<name> | Vraelis" with the name at most 14 characters; the full title stays in
 *  link previews and search snippets. Keyed by page slug, shared by the site and the docs (the same slugs name the same
 *  subjects). A page not listed uses its own short label. scripts/tab-titles-verify.ts holds every title to 24. */
export const TAB_NAMES: Record<string, string> = {
  // Site
  contour: "Contour", "contour-status": "Contour status", company: "About", refunds: "Refunds",
  bytedance: "ByteDance", reddit: "Reddit", "stripe-startups": "Stripe", cloudflare: "Cloudflare",
  // Applications (site and docs)
  defense: "Defense", "critical-infrastructure": "Infrastructure", "autonomous-systems": "Autonomy", government: "Government", integrators: "Integrators",
  // Research (site and docs)
  "model-integrity": "Integrity", "adversarial-threats": "Threats", "machine-trust": "Machine trust", "security-evidence": "Evidence",
  "model-release-security": "Release guide", "operating-constraints": "Constraints", "ai-security-evaluation": "Evaluation",
  // Docs
  introduction: "Introduction", "reading-the-docs": "Reading guide", "who-its-for": "Who it is for", "company-and-brands": "About Vraelis",
  "application-areas": "Applications", "security-and-disclosure": "Security", "privacy-and-data": "Privacy", "where-vraelis-is-offered": "Availability",
  "partner-scope": "Partnerships", status: "Status", "release-notes": "Release notes", sources: "Sources", glossary: "Glossary", faq: "FAQ",
  products: "Products", "release-identity": "Identity", "approval-binding": "Binding", "runtime-integration": "Runtime",
  "comparing-approved-and-reported": "Comparison", "evidence-and-observations": "Observations", "evidence-app": "Evidence app", limits: "Limits",
  "observation-01": "Observation 01", "observation-02": "Observation 02", "observation-03": "Observation 03", "observation-04": "Observation 04",
  // Earlier references (history)
  "getting-started": "Start here", "the-loop": "The loop", "what-you-can-check": "Checks", "ai-assistants": "AI assistants", ci: "CI gate",
  review: "Plan review", "run-activity": "Run activity", "recorded-reports": "Task reports", cli: "CLI",
  // Docs: key concepts, architecture, guides, reference (helpful.ts)
  "key-concepts": "Key concepts", architecture: "Architecture", walkthrough: "Walkthrough", "review-an-observation": "Review guide",
  "evaluate-contour": "Evaluate", "observation-record": "Record fields", "states-and-codes": "States, codes",
};
/** The browser-tab title for a page: "<name> | Vraelis". */
export const tabTitle = (key: string, fallback: string) => `${TAB_NAMES[key] ?? fallback} | Vraelis`;

export const RESEARCH = [
  { slug: "model-integrity", title: "Model integrity", line: "Whether the model that runs is the model that was approved.", photo: "embeddedBoard" },
  { slug: "adversarial-threats", title: "Adversarial threats", line: "Inputs, updates and supply paths built to change what a model does.", photo: "boardInspection" },
  { slug: "machine-trust", title: "Machine trust", line: "Explicit identity, limited permissions and checks at execution boundaries.", photo: "networkSwitch" },
  { slug: "security-evidence", title: "Security evidence", line: "Records a person can read, kept in order, including what could not be confirmed.", photo: "laboratoryRoom" },
] as const;

export const APPLICATIONS = [
  { slug: "defense", title: "Defense", line: "AI in mission systems, where an unexpected model change can create security and operational risk.", photo: "communicationsDishes" },
  { slug: "critical-infrastructure", title: "Critical infrastructure", line: "AI in energy, water and communications, where releases cross operators.", photo: "substationNetwork", heroPhoto: "windOperations" },
  // Detail-page heroes use licensed setting photographs; overview crops keep their existing role.
  { slug: "autonomous-systems", title: "Autonomous systems", line: "AI in robots and vehicles, where models ship to machines in the field.", photo: "robotMotion", heroPhoto: "robotAssemblyArm" },
  { slug: "government", title: "Government and institutions", line: "Public bodies that need evidence a reviewer can read.", photo: "operationalCompute" },
  { slug: "integrators", title: "Suppliers and integrators", line: "The teams who ship model updates into systems they do not own.", photo: "integrationWorkshop" },
] as const;
export const APPLICATIONS_NOTE = "Application research, grounded in the Vraelis Contour reference experiment.";
/** Under editorial photographs (content review 2026-10-11): context, never a claim about Vraelis' own facilities. */
export const PHOTO_NOTE = "Editorial photograph. It shows the kind of setting, not a Vraelis facility, its equipment or a customer installation.";

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
    // "Products", not "Contour" (founder, 2026-10-11): Vraelis Contour is the first product; others join this menu
    // once they are confirmed, by name and by who they are for. Pages only, never sections of one page (founder:
    // "everything is the same page"): the product and its status page.
    id: "contour", label: "Products", kind: "mega",
    links: [
      // One entry per product (founder, 2026-10-13: "dont have 2 for 1"). Contour status is reached from /contour.
      { label: "Vraelis Contour", to: "/contour", line: "Model release security, from approval to reported runtime state.", preview: crop("crop-approved-cpu2"), previewAlt: "Approved release cpu-2 with its identity digests." },
    ],
  },
  {
    id: "research", label: "Research", kind: "list",
    links: [{ label: "All research", to: "/research" }, ...RESEARCH.map((r) => ({ label: r.title, to: `/research/${r.slug}` }))],
  },
  {
    id: "applications", label: "Applications", kind: "list",
    links: [{ label: "All applications", to: "/applications" }, ...APPLICATIONS.map((a) => ({ label: a.title, to: `/applications/${a.slug}` }))],
  },
  {
    id: "company", label: "Company", kind: "list",
    links: [{ label: "About", to: "/company" }, { label: "Partners", to: "/partners" }, { label: "News", to: "/news" }],
  },
];

/** The phone menu's featured cards (founder, 2026-10-18: the drawer should use its whole height, with more than one
 *  button). Each has its own picture, none shown elsewhere on the site: a real Contour capture and two licensed
 *  photographs from the editorial registry (credited on Image sources). */
export const DRAWER_FEATURED = [
  { label: "Vraelis Contour", line: "Model release security, from approval to reported runtime state.", to: "/contour", img: "/v8/contour/app-overview-1200.webp", alt: "The Vraelis Contour app overview screen.", capture: true },
  { label: "Research", line: "Four areas of AI security.", to: "/research", img: "/site/photography/editorial-microscopeInspection.jpg", alt: "An engineer inspecting a circuit board under a microscope." },
  { label: "Applications", line: "Defense, critical infrastructure and autonomous systems.", to: "/applications", img: "/site/photography/editorial-robotProduction.jpg", alt: "Industrial robot arms on a factory floor." },
] as const;
/** The phone menu's small links under the ways in. News lives on the changelog until the newsroom ships. */
export const DRAWER_LINKS = [{ label: "News", to: "/changelog" }, { label: "Privacy", to: "/privacy" }, { label: "Terms", to: "/terms" }] as const;

/** Plain links under the footer logo, no heading (founder, 2026-10-13: "no company unless Palantir has it"; Palantir
 *  lists "About Palantir" among plain quick links). */
export const FOOTER_QUICK = [{ label: "About", to: "/company" }, { label: "Partners", to: "/partners" }, { label: "News", to: "/news" }] as const;

export const FOOTER: { title: string; links: { label: string; to: string }[] }[] = [
  { title: "Vraelis Contour", links: [{ label: "Overview", to: "/contour" }, { label: "How it works", to: "/contour#how" }, { label: "Development status", to: "/contour/status" }, { label: "Documentation", to: "/docs" }] },
  { title: "Research", links: [{ label: "All research", to: "/research" }, ...RESEARCH.map((r) => ({ label: r.title, to: `/research/${r.slug}` }))] },
  { title: "Applications", links: APPLICATIONS.map((a) => ({ label: a.title, to: `/applications/${a.slug}` })) },
  { title: "Trust", links: [{ label: "Security", to: "/security" }, { label: "Subprocessors", to: "/subprocessors" }, { label: "Data rights", to: "/data-rights" }, { label: "Image sources", to: "/image-sources" }] },
  { title: "Legal", links: [{ label: "Terms", to: "/terms" }, { label: "Privacy", to: "/privacy" }, { label: "Cookies", to: "/cookies" }, { label: "Acceptable use", to: "/acceptable-use" }, { label: "Trademark", to: "/trademark" }, { label: "All policies", to: "/legal" }] },
];

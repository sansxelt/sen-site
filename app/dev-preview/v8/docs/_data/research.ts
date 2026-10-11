import { RESEARCH_PAGES as AREAS, type ResearchSlug } from "../../research/content";
import { CONTOUR, RESEARCH, WORK_LINE } from "../../_kit/site";
import type { Block, Page } from "./types";

// THE RESEARCH TAB (2026-10-10): an overview, the four research areas, then the guides. The four area pages are built
// from the site's own research copy (research/content.ts), so the docs and /research/<area> cannot disagree; every
// one says it is a research area, not a product.
//
// The guides: the three v6 guides (app/dev-preview/v6/_content/guides.ts, which assembled them from
// security-direction.ts), reconciled with the founder brief of 2026-10-10:
// - "robotics suppliers" became suppliers and system integrators, and "the robot's compute budget" the
//   system's;
// - the "private policy core" is not in the brief's implemented list, so the evaluation guide no longer
//   leans on it;
// - each guide now ends with what Vraelis Contour does and does not do about the problem, in the brief's
//   implemented, proposed and not built terms.
// The guides are research guidance, not product capability, and each says so at the top.

const UPDATED = "2026-10-10";
const GUIDANCE = { t: "note" as const, label: "Research guidance", text: "This guide describes how we think about the problem. It is not a description of a product capability. Where it mentions Vraelis Contour, it says what exists in the experiment and what is proposed." };

/** How each area feeds Vraelis Contour, as the /research page draws it. */
const CONNECTS: Record<ResearchSlug, { rel: string; text: string }> = {
  "model-integrity": { rel: "Draws on directly", text: "Release identity, bound approval, approved against reported" },
  "security-evidence": { rel: "Draws on directly", text: "Ordered observations, including unavailable evidence" },
  "machine-trust": { rel: "Informs", text: "Separate approval roles, a policy checked where it serves" },
  "adversarial-threats": { rel: "Informs", text: "Which supply paths a release check covers" },
};

const AREA_NOTE: Block = { t: "note", label: "Research area", text: "This is a research area, not a product. Where it mentions Vraelis Contour, it says what exists in the experiment and what is proposed." };

function areaPage(slug: ResearchSlug): Page {
  const a = AREAS[slug];
  const ex = a.exists;
  const exists: Block[] = ex.kind === "experiment"
    ? [...(ex.lead ? [{ t: "p", text: ex.lead } as Block] : []), { t: "kinds", items: ex.items }, { t: "capture", name: ex.capture }]
    : ex.paragraphs.map((text): Block => ({ t: "p", text }));
  return {
    tab: "research", group: "Research areas", slug,
    title: a.metaTitle,
    description: a.description,
    lead: a.lead,
    updated: UPDATED,
    blocks: [
      AREA_NOTE,
      { t: "h2", text: "What we study" },
      { t: "p", text: a.studyTitle },
      { t: "facts", rows: a.study.map((p): [string, string] => [p.title, p.body]) },
      { t: "h2", text: "What exists today" },
      { t: "p", text: ex.title },
      ...exists,
      { t: "h2", text: "What is still open" },
      { t: "facts", rows: a.open.map((p): [string, string] => [p.title, p.body]) },
      { t: "h2", text: `How it connects to ${CONTOUR.name}` },
      { t: "p", text: `${CONNECTS[slug].rel}: ${CONNECTS[slug].text}.` },
      { t: "p", text: `On vraelis.com: [${a.metaTitle}](/research/${slug}), ${a.links.map((l) => `[${l.label}](${l.to})`).join(", ")}.` },
      { t: "cards", items: a.related.map((r) => ({ to: `/docs/${r}`, title: AREAS[r].metaTitle, line: RESEARCH.find((x) => x.slug === r)!.line })) },
    ],
  };
}

const OVERVIEW: Page = {
  tab: "research", group: "Research", slug: "research",
  title: "Research", nav: "Overview",
  description: `${WORK_LINE} Four research workstreams, not products, and how they connect to ${CONTOUR.name}.`,
  lead: `${WORK_LINE} These are workstreams, not products.`,
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Four research areas" },
    { t: "table", label: "The four research areas", head: ["Area", "What it studies", `With ${CONTOUR.name}`], rows: RESEARCH.map((r) => [
      `[${r.title}](/docs/${r.slug})`, r.line, `${CONNECTS[r.slug].rel}. ${CONNECTS[r.slug].text}.`,
    ]) },
    { t: "p", text: `${CONTOUR.name} is the first product direction, and it draws on model integrity and security evidence directly. The research areas are not products and have no product claims of their own.` },
    { t: "h2", text: "Guides" },
    { t: "p", text: "Three guides describe how we think about model releases, operating constraints and AI security evaluation. They are research guidance, not product capability." },
    { t: "cards", items: [
      { to: "/docs/model-release-security", title: "Model release security", line: "For the engineers who move an approved model into an operational system." },
      { to: "/docs/operating-constraints", title: "Operating constraints", line: "The control has to fit the environment, not just the model." },
      { to: "/docs/ai-security-evaluation", title: "AI security evaluation", line: "Match the threat to a measurable test." },
    ] },
  ],
};

const GUIDES: Page[] = [
  {
    tab: "research", group: "Guides", slug: "model-release-security",
    title: "A model release is a security decision.", nav: "Model release security",
    description: "For the release, platform and security engineers responsible for moving an approved model into an operational system.",
    updated: UPDATED,
    blocks: [
      GUIDANCE,
      { t: "h2", text: "The exact release" },
      { t: "p", text: "Bind the model artifact, preprocessing and configuration to a reviewed version. A release that cannot be named exactly cannot be approved exactly." },
      { t: "h2", text: "The right authority" },
      { t: "p", text: "Tie approval to the exact release and destination, independently of the workload that proposes the change." },
      { t: "h2", text: "The receiving runtime" },
      { t: "p", text: "Check compatibility, and distinguish the desired release from the version the managed service reports loading. Approval and successful loading are separate events." },
      { t: "h2", text: "The acceptance record" },
      { t: "p", text: "Retain accepted, failed or uncertain activation, and the evidence available during recovery. A missing report is a result to keep, not a gap to fill in." },
      { t: "h2", text: "A permit is only part of the control" },
      { t: "p", text: "A policy engine can return a decision. The component holding access to the resource must enforce it against the exact request, the current authority and any required approval." },
      { t: "h2", text: "Questions for each team" },
      { t: "ul", items: [
        "Release teams: how models are packaged, reviewed, promoted and rolled back.",
        "Platform teams: where a release can be checked, and where existing deployment tooling must enforce that decision.",
        "Security teams: who could alter a model release, which controls already exist, and what evidence would show a useful improvement.",
      ] },
      { t: "h2", text: "Start at the release boundary" },
      { t: "p", text: "Vraelis Contour starts here. In the experiment it connects signed release and approval bindings, runtime policy enforcement for ONNX Runtime 1.23.2 on CPU, real CPU inference, and desired against reported loaded observations, in a small synthetic ONNX workload." },
      { t: "p", text: "Loaded state evidence is a worker self-report. The experiment does not establish protection against a compromised host or show how a model behaves." },
      { t: "p", text: "Vraelis Contour is in private development. There is no public application or available deployment." },
      { t: "cards", items: [
        { to: "/docs/contour", title: "Vraelis Contour overview", line: "The five-step workflow and where it stands." },
        { to: "/docs/limits", title: "Limits and what is not built", line: "What the experiment does not establish." },
      ] },
    ],
  },
  {
    tab: "research", group: "Guides", slug: "operating-constraints",
    title: "Different systems. Different security boundaries.", nav: "Operating constraints",
    description: "The control has to fit the environment, not just the model.",
    updated: UPDATED,
    blocks: [
      GUIDANCE,
      { t: "h2", text: "Disconnected operation" },
      { t: "p", text: "Mission systems can lose connectivity. Identity, release approvals and evidence need a defined behaviour when central services are unavailable." },
      { t: "p", text: "Define outages, revocation, operating limits and independent controllers with the system owner." },
      { t: "h2", text: "Established operational controls" },
      { t: "p", text: "AI is introduced alongside existing equipment, permissions and change management processes. Security needs to respect those boundaries." },
      { t: "p", text: "A policy engine can return a decision. The component holding access to the resource must enforce it against the exact request, the current authority and any required approval." },
      { t: "h2", text: "Limited edge resources" },
      { t: "p", text: "Model updates and security checks must fit the system's compute budget, timing requirements and recovery process." },
      { t: "p", text: "Edge compute budgets, disconnected operation and supplier interfaces shape the integration. Hardware support, detection performance and deployment suitability must be demonstrated for each environment." },
      { t: "h2", text: "What this means for Vraelis Contour" },
      { t: "p", text: "The experiment runs on a CPU in a lab environment that does not actuate anything. It does not yet handle disconnected operation, report freshness or constrained edge hardware, and those are among the items not built. [Limits and what is not built](/docs/limits)" },
      { t: "h2", text: "Read the underlying guidance" },
      { t: "p", text: "[Principles for the secure integration of artificial intelligence in operational technology](https://www.cyber.gov.au/publication/principles-for-the-secure-integration-of-artificial-intelligence-in-operational-technology)" },
    ],
  },
  {
    tab: "research", group: "Guides", slug: "ai-security-evaluation",
    title: "Measure the boundary, not a broad security score.", nav: "AI security evaluation",
    description: "Match the threat to a measurable test.",
    updated: UPDATED,
    blocks: [
      GUIDANCE,
      { t: "h2", text: "Test against a defined threat" },
      { t: "p", text: "A useful evaluation separates model tampering, data poisoning, manipulated inputs and unauthorized actions. Define attacker access, normal operating conditions and the evidence needed to reproduce each result." },
      { t: "p", text: "Prompt injection and adversarial perception inputs need different test cases and controls. Constrain authority separately from detection." },
      { t: "h2", text: "Measure the engineering tradeoffs" },
      { t: "p", text: "Measure missed attacks, false alarms, latency, compute use and investigation effort. An attack test result applies to its tested conditions, not to every model or physical environment." },
      { t: "h2", text: "Distinguish change from compromise" },
      { t: "p", text: "Performance drift can have operational causes. Use qualified baselines before attributing an anomaly to an attack." },
      { t: "p", text: "These are research areas. Vraelis does not claim universal attack detection and publishes no detection or accuracy numbers." },
      { t: "h2", text: "How Vraelis Contour is evaluated today" },
      { t: "p", text: "The evaluation is narrow. At the runtime rejection-diagnostics revision, 133 of 133 internal tests pass in a pinned, network-disabled harness, and Startup QA reproduced that on a separate build on October 10, 2026 (Pacific). That measures automated behaviour inside the experiment. A latency study and live fault runs are not built." },
      { t: "h2", text: "Read the underlying guidance" },
      { t: "p", text: "[NIST adversarial machine learning taxonomy](https://www.nist.gov/publications/adversarial-machine-learning-taxonomy-and-terminology-attacks-and-mitigations-0)" },
    ],
  },
];

export const RESEARCH_PAGES: Page[] = [OVERVIEW, ...RESEARCH.map((r) => areaPage(r.slug)), ...GUIDES];

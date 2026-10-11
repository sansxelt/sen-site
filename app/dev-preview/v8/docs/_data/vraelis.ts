import { APPLICATIONS_NOTE, COMPANY_LINE, CONTOUR, FACTS, FOREMAKE, FOUNDER, KIND_LABEL, RESEARCH, TERMS, WORK_LINE } from "../../_kit/site";
import { NEWS } from "../../_content/news";
import type { Page } from "./types";

// THE VRAELIS TAB (2026-10-10, founder: "it goes from Vraelis to Products and then Contour"). What Vraelis is, how to
// read these docs, where things stand, what changed, and the words the docs use. The docs home (page.tsx) is this
// tab's Overview. Every sentence restates a fact already on the site (_kit/site.ts, _content/news.ts) or in the
// Contour pages; nothing here adds a claim.

const UPDATED = "2026-10-10";

const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** NEWS grouped by day, newest first, for the release notes. */
function releaseNotes(): Page["blocks"] {
  const days: { day: string; items: typeof NEWS }[] = [];
  for (const n of NEWS) {
    const d = days.find((x) => x.day === n.date);
    if (d) d.items.push(n); else days.push({ day: n.date, items: [n] });
  }
  return days.flatMap((d) => [
    { t: "h2" as const, text: longDay(d.day), id: d.day },
    ...d.items.flatMap((n) => [
      { t: "h3" as const, text: n.title, id: n.id },
      { t: "p" as const, text: `${n.kind}. ${n.summary}${n.to ? ` [Read more](${n.to})` : ""}` },
    ]),
  ]);
}

export const VRAELIS_PAGES: Page[] = [
  {
    tab: "vraelis", group: "Get started", slug: "introduction",
    title: "Introduction to Vraelis", nav: "Introduction",
    description: "What Vraelis is, the research it works on, its one product direction, and where these docs fit.",
    lead: COMPANY_LINE,
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "What Vraelis works on" },
      { t: "p", text: `${WORK_LINE} Those four are research areas, not products.` },
      { t: "table", label: "The four research areas", head: ["Area", "What it studies"], rows: RESEARCH.map((r) => [`[${r.title}](/docs/${r.slug})`, r.line]) },
      { t: "h2", text: "One product direction" },
      { t: "p", text: `${CONTOUR.name} is the first product direction: ${CONTOUR.line.charAt(0).toLowerCase()}${CONTOUR.line.slice(1)} It is not for public use. It is built for release, platform and security engineers at suppliers and system integrators.` },
      { t: "p", text: "There are no other Vraelis products." },
      { t: "cards", items: [
        { to: "/docs/contour", title: `${CONTOUR.name} overview`, line: "The five-step workflow and where it stands." },
        { to: "/docs/products", title: "Products", line: "The one product direction, and what is not a product." },
      ] },
      { t: "h2", text: "Where it applies" },
      { t: "p", text: `Defense, critical infrastructure and autonomous systems. ${APPLICATIONS_NOTE}` },
      { t: "h2", text: "The company" },
      { t: "p", text: `${FOREMAKE} Vraelis was founded by ${FOUNDER}. [Company](/company)` },
      { t: "h2", text: "What these docs cover" },
      { t: "ul", items: [
        "Vraelis: this introduction, how to read the docs, development status, release notes and a glossary.",
        `Products: ${CONTOUR.name}, from release identity to the evidence it keeps and where it stops.`,
        "Research: the four research areas and three guides.",
        "Earlier references: the earlier browser-testing product, kept as history. Not current.",
      ] },
    ],
  },
  {
    tab: "vraelis", group: "Get started", slug: "reading-the-docs",
    title: "How to read these docs", nav: "How to read these docs",
    description: "The five kinds of statement every page keeps apart, what the pictures and code are, and the ways to read a page: search, Ask AI and Markdown.",
    lead: "Every claim in these docs is one of five kinds, and we keep them apart.",
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "Five kinds of statement" },
      { t: "table", label: "Kinds of statement", head: ["Label", "What it means"], rows: [
        [KIND_LABEL.impl, "Built and exercised inside the controlled synthetic ONNX CPU experiment."],
        [KIND_LABEL.meas, "A number we recorded, with where it came from."],
        [KIND_LABEL.prop, "Specified or planned, and not built."],
        [KIND_LABEL.hyp, "Something we believe and are testing."],
        [KIND_LABEL.not, "Something Vraelis does not claim, such as customers, certification or pricing."],
      ] },
      { t: "kinds", items: [
        { kind: "impl", text: "A solid outline: built and exercised in the experiment." },
        { kind: "meas", text: "A solid outline: a recorded number." },
        { kind: "prop", text: "A dashed outline: not built." },
        { kind: "hyp", text: "A dashed outline: believed, being tested." },
        { kind: "not", text: "No outline: not claimed." },
      ] },
      { t: "h2", text: "Pictures and code" },
      { t: "p", text: "Product pictures are captures of the read-only evidence app reading the recorded trace. They are not mockups and they do not show a customer deployment." },
      { t: "p", text: "JSON on these pages is copied unchanged from the recorded trace of the controlled synthetic ONNX CPU experiment. The experiment's source code is not shown." },
      { t: "h2", text: "Search" },
      { t: "p", text: "Press Ctrl K, or ⌘K on a Mac, on any page to search every section of these docs. Search runs in your browser." },
      { t: "h2", text: "Ask AI" },
      { t: "p", text: "Ask AI answers from this documentation only. It quotes the passages that match your question, word for word, each linked to its section. When the docs do not cover something, it says so. Open it from the header, or from the first row of search." },
      { t: "p", text: "Ask AI does not answer from the earlier references. The conversation is not kept after the page closes." },
      { t: "p", text: "If generated answers are switched on, each one is labelled as generated, and the panel says where your question is sent." },
      { t: "h2", text: "Markdown for AI assistants" },
      { t: "p", text: "Every page has a Markdown twin. Copy for LLM copies the page as Markdown, and View as Markdown opens it. [llms.txt](/docs/llms.txt) lists every page with its twin." },
      { t: "h2", text: "Earlier references" },
      { t: "p", text: "The Earlier references tab keeps the documentation of the earlier browser-testing product, as history. Those pages are not current, and each carries a banner that says so." },
    ],
  },
  {
    tab: "vraelis", group: "Status", slug: "status",
    title: "Development status",
    description: `Where ${CONTOUR.name} stands: what works in the experiment, what is being built, and what Vraelis does not claim.`,
    lead: `Where ${CONTOUR.name} stands today, in one place. The rest of the site uses the same lists.`,
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "In numbers" },
      { t: "facts", rows: [
        ["Tests", `${FACTS.tests.value} ${FACTS.tests.label}.`],
        ["Runtime", `${FACTS.runtime.value}, ${FACTS.runtime.label}.`],
        ["Observations", `${FACTS.observations.value} ${FACTS.observations.label}.`],
      ] },
      { t: "p", text: "The tests measure automated behaviour inside the experiment. They are not production readiness or customer demand." },
      { t: "h2", text: "Where it stands" },
      { t: "ledger" },
      { t: "h2", text: "Read next" },
      { t: "cards", items: [
        { to: "/docs/limits", title: "Limits and what is not built", line: "Each item not built, and what the evidence does not establish." },
        { to: "/docs/runtime-integration", title: "Runtime integration", line: "The one supported runtime and its policy." },
      ] },
      { t: "p", text: "The development status page on vraelis.com keeps the same lists. [Development status](/contour/status)" },
    ],
  },
  {
    tab: "vraelis", group: "Status", slug: "release-notes", badge: "New",
    title: "Release notes",
    description: `Dated changes to Vraelis and ${CONTOUR.name}, newest first.`,
    lead: `Dated changes to Vraelis and ${CONTOUR.name}, newest first. Each entry is a dated fact from the repository or the review record.`,
    updated: UPDATED,
    blocks: [
      ...releaseNotes(),
      { t: "h2", text: "Earlier direction" },
      { t: "p", text: "Entries before October 7, 2026 describe the earlier browser-testing product. They are kept as history on the changelog. [Changelog](/changelog)" },
    ],
  },
  {
    tab: "vraelis", group: "Reference", slug: "glossary", badge: "New",
    title: "Glossary",
    description: "The words these docs use, each with what it means and where it stands.",
    lead: "The words these docs use. Where a term names something built or proposed, its status is beside it.",
    updated: UPDATED,
    blocks: [
      { t: "h2", text: "Security terms" },
      { t: "table", label: "Security terms", head: ["Term", "What it means", "Where it stands"], rows: TERMS.map((t) => [t.term, t.line, t.status]) },
      { t: "h2", text: "Release and evidence terms" },
      { t: "table", label: "Release and evidence terms", head: ["Term", "What it means"], rows: [
        ["Release", "One exact thing, named by digest: the model, its configuration and, proposed, its preprocessing. [Release identity](/docs/release-identity)"],
        ["Destination", "Where a release may run. In the captured run, the environment `non-actuating-lab` and the resource `onnx-cpu`."],
        ["Approval", "A binding of one exact release to one destination, under a runtime policy with an age limit. [Approval binding](/docs/approval-binding)"],
        ["Runtime policy", "The runtime a destination must have. In the experiment, ONNX Runtime 1.23.2 with exactly CPUExecutionProvider. [Runtime integration](/docs/runtime-integration)"],
        ["Observation", "One recorded comparison of the approved identity with the identity the runtime reports, with its status. [Evidence and observations](/docs/evidence-and-observations)"],
        ["Matched", "Every identity field is equal, and the reported runtime satisfies the policy."],
        ["Reload pending", "The reported identity differs from the approved one. In baseline mode the runtime waits for an explicit reload."],
        ["Evidence unavailable", "There is no loaded report. The observation carries a reason code and no loaded identity."],
        ["Reason code", "Why an observation has the status `unknown`. The captured run has one, `RUNTIME_UNAVAILABLE`."],
        ["Self-report", "What the worker says it loaded. The host and worker are trusted in the experiment, so it is not independent attestation."],
        ["Baseline mode", "The runtime keeps serving the release it loaded until an explicit reload."],
        ["Trace", "One JSON document holding a run's scope, recorded toolchain, runtime policy and observations."],
        ["Imported, not verified", "The label on every value from a trace opened in the evidence app. Signatures are not checked. [The evidence app](/docs/evidence-app)"],
      ] },
      { t: "h2", text: "Kinds of statement" },
      { t: "p", text: "Working in the experiment, measured, proposed, hypothesis and not claimed. [How to read these docs](/docs/reading-the-docs)" },
    ],
  },
];

/** Products: the one product direction, said plainly. Vraelis Contour's own pages follow it in the tab (contour.ts). */
export const PRODUCTS_OVERVIEW: Page = {
  tab: "products", group: "Products", slug: "products",
  title: "Products", nav: "Overview",
  description: `Vraelis has one product direction, ${CONTOUR.name}. There are no other Vraelis products.`,
  lead: `Vraelis has one product direction: ${CONTOUR.name}. There are no other Vraelis products.`,
  updated: UPDATED,
  blocks: [
    { t: "h2", text: CONTOUR.name },
    { t: "p", text: `${CONTOUR.headline} ${CONTOUR.line}` },
    { t: "facts", rows: [
      ["Status", "Controlled synthetic ONNX CPU experiment"],
      ["Runtime", "ONNX Runtime 1.23.2, CPUExecutionProvider"],
      ["Tests", "133 of 133, runtime rejection-diagnostics revision, reproduced by internal automated testing"],
      ["Access", "Not for public use"],
      ["Built for", "Release, platform and security engineers at suppliers and system integrators"],
    ] },
    { t: "cards", items: [
      { to: "/docs/contour", title: `${CONTOUR.name} overview`, line: "The five-step workflow and where it stands." },
      { to: "/docs/limits", title: "Limits and what is not built", line: `Where ${CONTOUR.name} stops today.` },
    ] },
    { t: "h2", text: "What is not a product" },
    { t: "p", text: "The four research areas, model integrity, adversarial threats, machine trust and security evidence, are workstreams, not products. [Research](/docs/research)" },
    { t: "p", text: "The earlier browser-testing product is history. Its documentation is kept under Earlier references and is not current." },
    { t: "h2", text: "Access" },
    { t: "p", text: `${CONTOUR.name} is not for public use. There is no public API, command line tool, console or account. To talk about it, use Join us. [Join us](/contact?topic=contour)` },
  ],
};

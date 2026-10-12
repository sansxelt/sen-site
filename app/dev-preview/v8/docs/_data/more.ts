import { OBSERVATION_2 } from "../../_content/evidence";
import { PARTNERS, PARTNERS_NOTE } from "../../_content/partners";
import { APP_PAGES, type AppSlug } from "../../applications/content";
import {
  APPLICATIONS, APPLICATIONS_NOTE, CONTOUR, FACTS, FOREMAKE, FOUNDER, OBSERVATIONS, OBSERVATION_TIMES, STATUS_SOURCES, WORKFLOW,
} from "../../_kit/site";
import type { Block, Page } from "./types";

// MORE OF THE DOCS (founder, 2026-10-12: next to Linear and Scale the docs had too little in them for the number of
// tabs). Every page here restates material already published and checked on the site, from the same data the site
// renders: the application areas (applications/content.ts), the partnerships (_content/partners.ts), the security,
// privacy and terms pages, the Contour FAQ, the status sources and the four recorded observations. Nothing here adds
// a claim, an installation step or a capability. Sources a reader can open are linked on every page.

const UPDATED = "2026-10-12";
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* ── Vraelis > Get started ───────────────────────────────────────────────────────────────────────── */

const WHO: Page = {
  tab: "vraelis", group: "Get started", slug: "who-its-for", title: `Who ${CONTOUR.name} is for`, nav: "Who it is for",
  description: `The people ${CONTOUR.name} is built for, what each of them needs from it, and what it does not do.`,
  updated: UPDATED,
  blocks: [
    { t: "p", text: `${CONTOUR.name} is built for ${lower(CONTOUR.audience)} It is in private development and not for public use.` },
    { t: "h2", text: "What each role needs" },
    { t: "table", label: "Roles", head: ["Role", "What it needs to know"], rows: [
      ["Release engineers", "Which model ships, and where."],
      ["Platform engineers", "The runtime that receives it."],
      ["Security engineers", "The record of what was approved and what loaded."],
    ] },
    { t: "note", label: "Not a customer list", text: "These are the roles it is designed for, at suppliers and system integrators. Vraelis has no customer deployments." },
    { t: "h2", text: "What it does not do" },
    { t: "ul", items: [
      "No verdict on model behaviour. A signature endorses bytes, not behaviour.",
      "No permission to change a customer's system. That stays the customer's decision.",
    ] },
    { t: "h2", text: "Talk to us" },
    { t: "p", text: "Describe the models you release, the systems that run them, how a release is approved today and which evidence you would need. [Join us](/contact)" },
  ],
};

const COMPANY: Page = {
  tab: "vraelis", group: "Get started", slug: "company-and-brands", title: "Company and brands", nav: "Company and brands",
  description: "Foremake, Inc, Vraelis and Overlym: how the brands relate, who founded Vraelis, and who operates the site.",
  updated: UPDATED,
  blocks: [
    { t: "p", text: FOREMAKE },
    { t: "facts", rows: [
      ["Umbrella brand", "Foremake, Inc"],
      ["Vraelis", "AI cybersecurity software"],
      ["First product", `${CONTOUR.name}, in private development`],
      ["Overlym", "A separate fintech venture, in development"],
      ["Founder", FOUNDER],
    ] },
    { t: "h2", text: "Who operates the site" },
    { t: "p", text: "The site and the services described on it are operated by Foremake, Inc. Foremake, Inc, Vraelis and Overlym are brands, and none of them is incorporated: \"Inc\" is part of the Foremake, Inc brand name. The [Terms](/terms) say this in full." },
    { t: "cards", items: [
      { to: "/company", title: "Company", line: "People, brands and what Vraelis works on." },
      { to: "/docs/partner-scope", title: "Partnerships", line: "The official partnerships and what they cover." },
    ] },
  ],
};

/* ── Vraelis > Applications ──────────────────────────────────────────────────────────────────────── */

const APP_OVERVIEW: Page = {
  tab: "vraelis", group: "Applications", slug: "application-areas", title: "Application areas", nav: "Overview",
  description: `Where ${CONTOUR.name} is meant to apply. ${APPLICATIONS_NOTE}`,
  updated: UPDATED,
  blocks: [
    { t: "note", label: "Intended, not deployed", text: APPLICATIONS_NOTE },
    { t: "table", label: "Areas", head: ["Area", "Why release integrity matters there"], rows: APPLICATIONS.map((a) => [`[${a.title}](/docs/${a.slug})`, a.line]) },
    { t: "h2", text: "What they have in common" },
    { t: "ul", items: [
      "Model updates ship into systems someone else operates.",
      "An unexpected release can create security and operational risk. A baseline kept on purpose is not an incident.",
      "Reviewers need evidence they can read: what was approved, what loaded, and what could not be confirmed.",
    ] },
  ],
};

function appDoc(slug: AppSlug): Page {
  const a = APP_PAGES[slug];
  const area = APPLICATIONS.find((x) => x.slug === slug)!;
  const blocks: Block[] = [
    { t: "note", label: "Intended, not deployed", text: APPLICATIONS_NOTE },
    { t: "h2", text: a.whyTitle },
    ...a.why.flatMap((w) => [{ t: "h3" as const, text: w.title }, { t: "p" as const, text: w.body }]),
  ];
  if (a.hypothesis) blocks.push({ t: "note", label: "Hypothesis", text: a.hypothesis });
  blocks.push(
    { t: "h2", text: "The workflow, in this area" },
    { t: "steps", items: WORKFLOW.map((s, i) => (a.steps[i] ? `${s.title}. ${a.steps[i]}` : `${s.title}.`)) },
    { t: "capture", name: a.capture },
  );
  if (a.stance) {
    blocks.push({ t: "h2", text: a.stance.title });
    if (a.stance.lead) blocks.push({ t: "p", text: a.stance.lead });
    blocks.push({ t: "ul", items: a.stance.cards.map((c) => `${c.title}. ${c.body}`) });
  }
  blocks.push(
    { t: "h2", text: "Not claimed" },
    { t: "ul", items: [...a.notClaimed] },
    { t: "cards", items: [
      { to: `/applications/${slug}`, title: `${area.title} on vraelis.com`, line: "The page this summary comes from." },
      ...a.related.map((r) => ({ to: `/docs/${r}`, title: r.split("-").map((w, i) => (i ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" "), line: "Related research." })),
    ] },
  );
  return { tab: "vraelis", group: "Applications", slug, title: area.title, description: a.description, lead: a.lead, updated: UPDATED, blocks };
}

/* ── Vraelis > Trust ─────────────────────────────────────────────────────────────────────────────── */

const SECURITY: Page = {
  tab: "vraelis", group: "Trust", slug: "security-and-disclosure", title: "Security and disclosure", nav: "Security and disclosure",
  description: "How to report a security issue to Vraelis, the rules for testing, and what not to send through a public form.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Report a security issue" },
    { t: "p", text: "Email `help@vraelis.com` with Security report in the subject. Say what you found, the address where it happens, and how to see it. A person reads every report." },
    { t: "steps", items: [
      "Test only systems you own or are authorized to test, and stop as soon as you can show the problem.",
      "Do not open, change or keep anyone else's data. If you reach some by accident, tell us and delete it.",
      "Give us a reasonable chance to fix it before you publish anything.",
    ] },
    { t: "table", label: "security.txt (RFC 9116)", head: ["Field", "Value"], rows: [
      ["Contact", "`help@vraelis.com`"],
      ["Policy", "[vraelis.com/security#report](/security#report)"],
      ["Preferred-Languages", "en"],
      ["Expires", "30 September 2027"],
    ] },
    { t: "h2", text: "What not to send" },
    { t: "p", text: "Keep credentials, classified material, restricted technical data and sensitive operational information out of public contact forms. Describe the system and the problem at a level you are authorized to share." },
    { t: "h2", text: "What exists today" },
    { t: "p", text: `${CONTOUR.name} exists as a controlled synthetic ONNX CPU experiment with a read-only evidence app. The site offers no self-service account, production API or operational deployment, and a contact submission does not grant access. Research topics, design intentions and local tests are not certifications.` },
  ],
};

const PRIVACY: Page = {
  tab: "vraelis", group: "Trust", slug: "privacy-and-data", title: "Privacy and data handling", nav: "Privacy and data",
  description: "What the contact form and the documentation assistant collect, how long it is kept today, and how to make a privacy request.",
  updated: UPDATED,
  blocks: [
    { t: "note", label: "Summary", text: "This page summarises the [Privacy policy](/privacy). Where they differ, the policy applies." },
    { t: "h2", text: "The contact form" },
    { t: "p", text: "It collects your email address, your name if you give it, who you are writing as, the topic and your message. Unless you are making a privacy request, it also collects your country, how you heard about Vraelis, and your company or organization and role where you give them. Resend delivers the message to our inbox and sends you one confirmation." },
    { t: "h2", text: "The documentation assistant" },
    { t: "p", text: "Ask AI answers from these docs. By default it quotes the matching documentation on our hosting and sends nothing to an AI provider. Vraelis does not log the question text, and your IP address is held in memory for up to an hour to limit abuse." },
    { t: "h2", text: "How long data is kept today" },
    { t: "ul", items: [
      "Rate-limit keys (an IP address or an email address, with a count and a start time) are not deleted automatically at present; a key is reset when the same address is used again after its window.",
      "Messages are kept in our support inbox. Resend keeps its own delivery record.",
      "Our hosting provider keeps request logs for the period its logging plan sets.",
    ] },
    { t: "h2", text: "Privacy requests" },
    { t: "p", text: "Write to `privacy@vraelis.com`, or choose a privacy request on the [contact form](/contact?topic=privacy). Privacy requests are accepted from everyone, wherever they are." },
  ],
};

const WHERE: Page = {
  tab: "vraelis", group: "Trust", slug: "where-vraelis-is-offered", title: "Where Vraelis is offered", nav: "Where Vraelis is offered",
  description: "The places Vraelis does not take inquiries from, why, and the exception for privacy requests.",
  updated: UPDATED,
  blocks: [
    { t: "p", text: `Vraelis does not offer ${CONTOUR.name}, and does not take inquiries about it or about working with Vraelis, from people or organizations located in China, including Hong Kong and Macao.` },
    { t: "p", text: "Vraelis is building for defense and critical-infrastructure work in the United States, where who may receive security software and technical information is restricted." },
    { t: "note", label: "Privacy requests", text: "Privacy and data-rights requests are accepted from everyone, wherever they are." },
    { t: "h2", text: "How the contact form applies it" },
    { t: "ul", items: [
      "The country is chosen from a fixed list.",
      "Choosing China, Hong Kong or Macao shows why the inquiry cannot be accepted, and the server refuses it.",
      "The country is what the sender declares; it is not verified.",
    ] },
    { t: "cards", items: [{ to: "/terms", title: "Terms", line: "Where Vraelis is offered, in the terms." }] },
  ],
};

const PARTNERSHIPS: Page = {
  tab: "vraelis", group: "Trust", slug: "partner-scope", title: "Partnerships",
  description: `The ${PARTNERS.length} official partnerships, what each covers, and what it does not. ${PARTNERS_NOTE}`,
  updated: UPDATED,
  blocks: [
    { t: "note", label: "Scope", text: PARTNERS_NOTE },
    ...PARTNERS.flatMap((p): Block[] => [
      { t: "h2", text: p.name },
      { t: "p", text: p.summary },
      { t: "facts", rows: [["Established", p.established], ["Focus", p.focus]] },
      { t: "h3", text: "What it covers" },
      { t: "ul", items: [...p.means] },
      { t: "h3", text: "What it does not" },
      { t: "ul", items: [...p.boundary] },
      { t: "p", text: `[The partnership record](/partners/${p.slug})` },
    ]),
  ],
};

/* ── Vraelis > Status and Reference ──────────────────────────────────────────────────────────────── */

const SOURCES: Page = {
  tab: "vraelis", group: "Status", slug: "sources", title: "Sources behind the status", nav: "Sources",
  description: "Where every line of the development status comes from, and how to read the test counts.",
  updated: UPDATED,
  blocks: [
    { t: "p", text: "Every line on the [development status](/docs/status) names its source. These are the sources." },
    { t: "table", label: "Sources", head: ["Source", "What it is"], rows: Object.values(STATUS_SOURCES).map((s) => [s.label, s.line]) },
    { t: "h2", text: "Reading the test counts" },
    { t: "p", text: `${FACTS.tests.value} ${FACTS.tests.label}. The earlier ${FACTS.testsEarlier.value} belongs to an earlier revision and is history.` },
    { t: "note", label: "Never added together", text: "The counts of different revisions and suites are separate measurements. They are not summed, and none of them is production readiness, customer demand or independent review." },
  ],
};

const FAQ: Page = {
  tab: "vraelis", group: "Reference", slug: "faq", title: "Frequently asked questions", nav: "FAQ",
  description: `Short answers about ${CONTOUR.name}, access, the source, partners and where Vraelis is offered.`,
  updated: UPDATED,
  blocks: [
    { t: "h3", text: `Is ${CONTOUR.name} available?` },
    { t: "p", text: `Not publicly. It is built for ${lower(CONTOUR.audience)} [Join us](/contact) to tell us about your release path.` },
    { t: "h3", text: "Is there a public API, command line tool or console?" },
    { t: "p", text: "No. Product access is closed while the product is in private development. The earlier product's API and command line tool are retired." },
    { t: "h3", text: "Does it roll back automatically?" },
    { t: "p", text: "No. Baseline mode serves what it loaded until an explicit, recorded reload. The experiment also has a reconcile mode." },
    { t: "h3", text: "Where is the source?" },
    { t: "p", text: "Private. The site shows recorded evidence and captures of the evidence app." },
    { t: "h3", text: "Is runtime identity attested by hardware?" },
    { t: "p", text: "No. Runtime reports are worker self-reports. Hardware attestation is not claimed." },
    { t: "h3", text: "Do the partners use or endorse it?" },
    { t: "p", text: `No. ${PARTNERS_NOTE} [Partnerships](/docs/partner-scope)` },
    { t: "h3", text: "Where is Vraelis offered?" },
    { t: "p", text: "Not in China, including Hong Kong and Macao. Privacy requests are accepted from everyone. [Where Vraelis is offered](/docs/where-vraelis-is-offered)" },
    { t: "h3", text: "Who operates Vraelis?" },
    { t: "p", text: "Foremake, Inc, an unincorporated brand. [Company and brands](/docs/company-and-brands)" },
  ],
};

/* ── Products > Vraelis Contour > Recorded observations ──────────────────────────────────────────── */

const RELEASES: Record<string, { approved: string; loaded: string }> = {
  "01": { approved: "cpu-1", loaded: "cpu-1" },
  "02": { approved: "cpu-2", loaded: "cpu-1" },
  "03": { approved: "cpu-2", loaded: "cpu-2" },
  "04": { approved: "cpu-2", loaded: "No report" },
};
const CLOSER: Record<string, string> = {
  "01": "The approved release is the one the runtime reports loaded. Every identity field matches.",
  "02": "cpu-2 is approved while cpu-1 stays loaded. In baseline mode the runtime keeps serving what it loaded until an explicit reload. This is an approved session's baseline, not an unauthorized deployment.",
  "03": "After the explicit reload the runtime reports cpu-2, and every identity field matches the approval.",
  "04": "The worker stopped reporting. cpu-2 stays approved, and nothing confirms what is loaded. The evidence says so rather than guessing.",
};

function observationDoc(i: number): Page {
  const o = OBSERVATIONS[i];
  const rec = OBSERVATION_TIMES[o.n];
  const r = RELEASES[o.n];
  const blocks: Block[] = [
    { t: "facts", rows: [
      ["Recorded", `10 October 2026, ${rec.time} UTC`],
      ["State", o.state],
      ["Approved", r.approved],
      ["Reported loaded", r.loaded],
      ...(rec.reason ? [["Reason code", `\`${rec.reason}\``] as [string, string]] : []),
    ] },
    { t: "p", text: CLOSER[o.n] },
    { t: "capture", name: o.shot },
  ];
  if (o.n === "02") blocks.push({ t: "h2", text: "The recorded observation" }, { t: "code", label: "observation 02, reload pending", lang: "json", text: OBSERVATION_2 });
  blocks.push(
    { t: "note", label: "What this is", text: "A worker self-report from one captured run of the synthetic ONNX CPU experiment, shown by the read-only evidence app. A recording, not a live control, and not hardware attestation." },
    { t: "cards", items: OBSERVATIONS.filter((x) => x.n !== o.n).map((x) => ({ to: `/docs/observation-${x.n}`, title: `Observation ${x.n}: ${x.title}`, line: x.state })) },
  );
  return {
    tab: "products", section: CONTOUR.name, group: "Recorded observations", slug: `observation-${o.n}`,
    title: `Observation ${o.n}: ${o.title}`, nav: `${o.n} ${o.title}`,
    description: o.line, updated: UPDATED, blocks,
  };
}

export const VRAELIS_MORE: { getStarted: Page[]; applications: Page[]; trust: Page[]; status: Page[]; reference: Page[] } = {
  getStarted: [WHO, COMPANY],
  applications: [APP_OVERVIEW, ...APPLICATIONS.map((a) => appDoc(a.slug))],
  trust: [SECURITY, PRIVACY, WHERE, PARTNERSHIPS],
  status: [SOURCES],
  reference: [FAQ],
};
export const OBSERVATION_PAGES: Page[] = OBSERVATIONS.map((_, i) => observationDoc(i));

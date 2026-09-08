// Typed, data-driven documentation content for design 06. The sidebar, previous/next, table of contents, and
// per-page metadata are all generated from this array. Adding a page here adds it everywhere, no manual nav.
export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "steps"; items: string[] }
  | { t: "note"; label: string; text: string };

export type Doc = {
  slug: string;
  group: string;
  title: string;
  summary: string;
  outcome: string;
  blocks: Block[];
  related?: string[];
};

// Sidebar group order.
export const DOC_GROUPS = ["Getting started", "The work", "Oversight", "Beyond the task"];

export const DOCS: Doc[] = [
  {
    slug: "getting-started",
    group: "Getting started",
    title: "Getting started with Vraelis",
    summary: "Connect a system, write a first guarantee, and read your first decision.",
    outcome: "You have a connected system and one guarantee under oversight.",
    blocks: [
      { t: "p", text: "Vraelis checks the work an AI agent does on your software at the point it is claimed complete, against a sentence you wrote before the work started. This guide takes you from an empty account to your first verified guarantee." },
      { t: "h2", text: "1. Connect a system" },
      { t: "p", text: "A system is one deployed application Vraelis oversees. Connecting it gives Vraelis a deployment to drive and a place to keep every guarantee, plan, and verification. You confirm ownership before anything runs." },
      { t: "h2", text: "2. Write a guarantee" },
      { t: "p", text: "State one outcome the business depends on, in one plain sentence. This is the guarantee Vraelis holds the work to, independently of the agent that performs it." },
      { t: "h2", text: "3. Read the result" },
      { t: "p", text: "When work is claimed complete, Vraelis returns a decision of Verified, Failed, or Blocked, with the evidence behind it and any decisions that need a person." },
      { t: "note", label: "Live today", text: "You can connect a web system, hold a requirement outside its code, and verify the live software against it in a real browser. Continuous ingestion of an agent's activity is a direction, not a current capability." },
    ],
    related: ["guarantees", "review"],
  },
  // THIS PAGE DOCUMENTED A ROUTE THAT DOES NOT EXIST, IN A VOCABULARY NOBODY ELSE USES.
  //
  // It was titled Work, described a /work surface, and listed four states: In progress, In review, Finding
  // and Complete. There is no /work route. The console's own navigation reads Overview, Systems, Guarantees
  // and Verifications, and the product has exactly three verdicts, translated through one function in
  // lib/preflight/public-decision.ts so the console, the API, the CI gate and the webhooks cannot disagree
  // about a run. Publishing a set of state names the product does not use is the same defect the engine
  // exists to catch, committed by the company selling the catch. Retitled to the surface that is actually
  // there, and the five labels below are the five that surface renders.
  {
    slug: "systems",
    group: "The work",
    title: "Systems",
    summary: "Everything you have connected, and how the last run on each one decided.",
    outcome: "You can see where every connected system stands.",
    blocks: [
      { t: "p", text: "A system is one deployed application Vraelis oversees. Systems is the index of them: every system you have connected, each with the decision from its most recent verification." },
      { t: "h2", text: "What a system holds" },
      { t: "ul", items: [
        "The deployment Vraelis drives when a run is launched.",
        "The guarantees defined against it, each pinned to the exact approved meaning it is proved against.",
        "Every verification, with its evidence and its decision preserved.",
        "The issues a failed run raised, each carrying the repair package written for a coding agent.",
      ] },
      { t: "h2", text: "What the label on a system means" },
      { t: "ul", items: [
        "Verified: the last run held its claim, with the evidence to show it.",
        "Failed: the last run did not, and it says what happened instead.",
        "Blocked: no honest decision could be reached, so none is claimed.",
        "In progress: a run is moving and has not reached a decision yet.",
        "Not tested: nothing has been verified against this system yet.",
      ] },
      { t: "note", label: "In review is not a verdict", text: "A plan waiting for a person to approve it is in review. That is a state a plan is in before anything runs, not an answer about your software. The answers are Verified, Failed, and Blocked." },
    ],
    related: ["guarantees", "findings"],
  },
  // THIS PAGE NAMED AN OBJECT THE PRODUCT DOES NOT HAVE.
  //
  // It was slugged /docs/responsibilities and titled "Responsibilities", and "responsibility" has no table,
  // no column and no type anywhere in this repository. The durable object a person actually creates is a
  // guarantee: sql/vraelis-preflight-19-guarantees.sql defines it, lib/preflight reads and writes it, the
  // console lists it at /guarantees, and a run records the guarantee it was proved against. A visitor who
  // read this page and then signed in met a different product, which is the exact drift the engine is sold
  // to catch. The slug moved with the noun; the only inbound link was the Platform menu in _system/shell.tsx
  // and it moved too. Nothing else in the repository referenced the old slug, and app/sitemap.ts builds the
  // documentation urls from this array, so it followed on its own.
  {
    slug: "guarantees",
    group: "The work",
    title: "Guarantees",
    summary: "The one sentence about your software that has to stay true.",
    outcome: "You can write a guarantee Vraelis will hold the work to.",
    blocks: [
      { t: "p", text: "A guarantee is a named outcome the company depends on, written as one sentence. It is held outside the code, so a change that quietly drops it is caught rather than shipped." },
      { t: "h2", text: "Writing a good guarantee" },
      { t: "steps", items: [
        "State an outcome, not a set of steps. \"A paid customer keeps the plan they bought\" travels; \"call the billing endpoint\" does not.",
        "Keep it to one sentence. If it needs two, it is probably two guarantees.",
        "Make it checkable against the running software, not against the agent's description of its work.",
      ] },
      { t: "h2", text: "What Vraelis does with it" },
      { t: "p", text: "Vraelis crawls the deployment you connected, derives the requirements the guarantee implies and the browser journeys that would prove them, and shows you that plan. Nothing runs until you approve it, and the paid run consumes the plan exactly as approved." },
      { t: "note", label: "Separation of duties", text: "The agent that performs the work cannot approve the standard used to judge it. A person approves the guarantee and the plan that proves it." },
    ],
    related: ["review", "completion"],
  },
  // THE SUBJECT OF THIS PAGE IS THE RUN, NOT THE AGENT, AND IT USED TO BE THE AGENT.
  //
  // It promised "you can follow what an agent is doing while it does it" and listed submitted plans, code
  // changes and external calls as things that appear here. None of that is ingested: no code reads an
  // agent's activity, and /platform#current carries the opposite sentence in the Direction column, where it
  // has always been. Two surfaces on the same site answering the same question differently is exactly the
  // drift this product is sold to catch, so the boundary below is the platform page's sentence word for
  // word rather than a second phrasing of it. The slug moved with the subject: /docs/live-activity named
  // the thing that is not built.
  {
    slug: "run-activity",
    group: "The work",
    title: "Run activity",
    summary: "What a verification did, step by step, with the evidence it captured.",
    outcome: "You can follow what a verification run observed, step by step, with its evidence.",
    blocks: [
      { t: "p", text: "Run activity is the record of one verification: the approved plan it executed, the journeys it drove in a real browser, what each step expected against what it observed, and the evidence captured along the way." },
      { t: "h2", text: "What appears here" },
      { t: "ul", items: [
        "The approved plan the run consumed, in the order it was reviewed.",
        "Each journey and each step, with expected against observed.",
        // "and traces" promised a file that does not exist. ArtifactSink in worker/preflight/types.ts has
        // exactly one method, saveScreenshot, and the record a run keeps is the per step row plus console
        // errors and failed network requests. Nothing writes a Playwright trace, so nothing here offers one.
        "Execution evidence: screenshots, console errors, and failed network requests.",
        "The decision the run reached, and the issue and repair package behind a failure.",
      ] },
      { t: "note", label: "Honest boundary", text: "Today a check begins at the point work is claimed complete. Plans, code changes and tool calls are not ingested while an agent is working." },
    ],
    related: ["completion", "findings"],
  },
  {
    slug: "review",
    group: "Oversight",
    title: "Review",
    summary: "The decision only a person can make, held outside the agent.",
    outcome: "You approve or refuse the plan before a run can start.",
    blocks: [
      { t: "p", text: "A person approves or refuses the reviewed plan as a whole before a run can start. An agent can propose the plan; it cannot approve it." },
      { t: "h2", text: "What reaches review today" },
      { t: "ul", items: [
        "The whole plan, once, before its first run.",
        "A repair, re-checked independently against the same standard.",
      ] },
      { t: "p", text: "A decision in Review is recorded against the guarantee, so the reason a plan was approved is preserved next to the plan itself." },
      { t: "note", label: "Honest boundary", text: "Today Review approves or refuses a plan as a whole. It does not yet single out a sensitive or irreversible step inside an already-approved plan for its own hold. That is direction, not built." },
    ],
    related: ["guarantees", "findings"],
  },
  {
    slug: "findings",
    group: "Oversight",
    title: "Findings",
    summary: "Contradictions, missing evidence, and unsafe assumptions.",
    outcome: "You can understand and route what oversight surfaced.",
    blocks: [
      { t: "p", text: "A finding is something oversight surfaced that stands between the work and trusted completion: a claim that the evidence does not support, a requirement the running software does not meet, or an assumption that would be unsafe to ship." },
      { t: "h2", text: "A finding is not a blocker by default" },
      { t: "p", text: "Not every finding is a defect. Some are questions for a person; some are resolved by evidence; some become a repair. Each carries what Vraelis observed and why it was raised, so the next step is a decision, not a mystery." },
    ],
    related: ["repair", "review"],
  },
  {
    slug: "repair",
    group: "Oversight",
    title: "Repair",
    summary: "A structured handoff back to the agent, and an independent recheck.",
    outcome: "You can turn a failure into a checked fix.",
    blocks: [
      { t: "p", text: "When a run fails a guarantee, Vraelis packages what should have happened, what happened instead, how to reproduce it, and the evidence. That package is a structured handoff the agent can act on." },
      { t: "h2", text: "The division of labor" },
      { t: "p", text: "The agent diagnoses the cause and makes the change. Vraelis independently rechecks the repair against the same guarantee. A repair is verified as its own run, and an earlier record is never overwritten." },
      // WHERE THE LOOP ACTUALLY STOPS. This page described a handoff and a recheck without saying that both
      // ends are manual, which let a reader assume the package is delivered and the recheck fires by itself.
      // Neither is true, /platform#current says so in the Direction column, and a boundary a customer meets
      // in their first week belongs on the page that describes the mechanism, not only on the marketing one.
      { t: "note", label: "Honest boundary", text: "The package is written onto the issue and rendered as the repair handoff on the run report. Vraelis does not send it anywhere, and the recheck is a rerun a person starts." },
      { t: "note", label: "Preserved history", text: "Every result is kept. A later Verified does not erase an earlier Failed; the history of how the software reached trust stays intact." },
    ],
    related: ["completion", "memory"],
  },
  {
    slug: "completion",
    group: "Oversight",
    title: "Completion",
    summary: "Verified, Failed, or Blocked, with the evidence behind it.",
    outcome: "You can trust, or refuse to trust, a completion claim.",
    blocks: [
      { t: "p", text: "Completion is the decision at the end of a run against a guarantee. It is one of three answers, and the third is the one most tools refuse to give." },
      { t: "ul", items: [
        "Verified: the guarantee held, with the evidence to show it.",
        "Failed: it did not, and here is what happened instead.",
        "Blocked: no honest decision could be reached, so none is claimed.",
      ] },
      { t: "p", text: "Completion is accepted only when the guarantee is met, not when the agent says it is done." },
    ],
    related: ["repair", "memory"],
  },
  // THIS PAGE DESCRIBED A CAPABILITY _content/scope.ts LISTS AS HORIZON, IN THE PRESENT TENSE.
  //
  // It read "Memory is where that accumulates" and named five kinds of accumulated understanding, while the
  // Direction column on /platform#current says of the same capability, in the same words the code supports,
  // "Not built. How much an agent may be trusted to do alone should be a conclusion drawn from what it has
  // actually got right." A documentation page and a scope page on one site disagreeing about whether
  // something exists is the drift this product is sold to catch. What is true today is the first paragraph:
  // history is preserved per guarantee and nothing is overwritten. The compounding half is kept, because it
  // is the honest direction, and is labelled as direction rather than described as a feature.
  {
    slug: "memory",
    group: "Beyond the task",
    title: "Memory",
    summary: "What is kept after every run, and the accumulated understanding that is not built yet.",
    outcome: "You know what Vraelis keeps today, and what memory would add.",
    blocks: [
      { t: "p", text: "Every run against a guarantee is kept: the plan that was approved, the step by step record, the screenshots, the decision it reached, and the issue and repair package behind a failure. A later Verified does not erase an earlier Failed, so the history of how a guarantee reached trust stays intact." },
      { t: "h2", text: "Direction: oversight that compounds" },
      { t: "p", text: "Not built. The direction is that every guarantee teaches Vraelis something about your software and your agents, so what it learns on one makes the next faster to judge and harder to fool. Nothing in the product reads that history back today." },
      { t: "note", label: "Honest boundary", text: "Vraelis keeps the full history of each guarantee and shows it to you. It does not yet use that history to judge the next run, and nothing scores an agent on its record." },
    ],
    related: ["completion", "getting-started"],
  },
];

export function docsByGroup() {
  return DOC_GROUPS.map((group) => ({ group, docs: DOCS.filter((d) => d.group === group) }));
}
export function getDoc(slug: string) {
  return DOCS.find((d) => d.slug === slug) ?? null;
}
export function adjacentDocs(slug: string) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS[i - 1] : null, next: i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : null };
}
export function docHeadings(doc: Doc) {
  return doc.blocks.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2").map((b) => b.text);
}

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
    summary: "Connect a system, assign a first responsibility, and read your first oversight result.",
    outcome: "You have a connected system and one responsibility under oversight.",
    blocks: [
      { t: "p", text: "Vraelis follows the work an AI agent does on your software, from the moment responsibility is assigned to the moment the result can be trusted. This guide takes you from an empty account to your first tracked responsibility." },
      { t: "h2", text: "1. Connect a system" },
      { t: "p", text: "A system is one application Vraelis oversees. Connecting it gives Vraelis a deployment to observe and a place to keep every responsibility, decision, and record. You confirm ownership before anything runs." },
      { t: "h2", text: "2. Assign a responsibility" },
      { t: "p", text: "State one outcome the business depends on, in plain language. This is the responsibility Vraelis will hold the work to, independently of the agent that performs it." },
      { t: "h2", text: "3. Read the result" },
      { t: "p", text: "When work is claimed complete, Vraelis returns a decision of Verified, Failed, or Blocked, with the evidence behind it and any decisions that need a person." },
      { t: "note", label: "Live today", text: "You can connect a web system, hold a requirement outside its code, and verify the live software against it in a real browser. Continuous ingestion of an agent's activity is a direction, not a current capability." },
    ],
    related: ["responsibilities", "review"],
  },
  {
    slug: "work",
    group: "The work",
    title: "Work",
    summary: "Everything an agent is responsible for, and where each item stands.",
    outcome: "You can see the state of every responsibility at a glance.",
    blocks: [
      { t: "p", text: "Work is the top-level view of your account: every responsibility assigned to an agent, grouped by system, with its current oversight state." },
      { t: "h2", text: "States" },
      { t: "ul", items: [
        "In progress: the agent is planning or changing code.",
        "In review: a person needs to make a decision before it can proceed.",
        "Finding: Vraelis found a contradiction, a missing piece of evidence, or an unsafe assumption.",
        "Complete: the responsibility was met and independently accepted.",
      ] },
      { t: "p", text: "Each state is a link into the detail for that responsibility, where the plan, the changes, the evidence, and the decisions live." },
    ],
    related: ["responsibilities", "findings"],
  },
  {
    slug: "responsibilities",
    group: "The work",
    title: "Responsibilities",
    summary: "The durable statement of what a piece of agent work must accomplish.",
    outcome: "You can write a responsibility Vraelis will hold the work to.",
    blocks: [
      { t: "p", text: "A responsibility is a named outcome the company depends on. It is held outside the code, so a change that quietly drops it is caught rather than shipped." },
      { t: "h2", text: "Writing a good responsibility" },
      { t: "steps", items: [
        "State an outcome, not a set of steps. \"A paid customer keeps the plan they bought\" travels; \"call the billing endpoint\" does not.",
        "Keep it to one sentence. If it needs two, it is probably two responsibilities.",
        "Make it checkable against the running software, not against the agent's description of its work.",
      ] },
      { t: "note", label: "Separation of duties", text: "The agent that performs the work cannot approve the standard used to judge it. A person approves the responsibility and the plan that proves it." },
    ],
    related: ["review", "completion"],
  },
  {
    slug: "live-activity",
    group: "The work",
    title: "Live activity",
    summary: "The plan, changes, tools, assumptions, and evidence as the work happens.",
    outcome: "You can follow what an agent is doing while it does it.",
    blocks: [
      { t: "p", text: "Live activity is the running record of a responsibility: the plan the agent created, the files it changed, the external systems it called, the assumptions it made, and the evidence collected along the way." },
      { t: "h2", text: "What appears here" },
      { t: "ul", items: [
        "Submitted plans and the steps they contain.",
        "Code changes and the systems they touch.",
        "External calls and their observable effects.",
        "Assumptions the agent stated or Vraelis inferred, flagged for review.",
        "Execution evidence: real browser runs, screenshots, and traces.",
      ] },
      { t: "note", label: "Honest boundary", text: "Vraelis works from available activity, submitted plans, code changes, external events, and the agent's own claims. It does not read an agent's internal reasoning. Deeper live-agent integration is a direction." },
    ],
    related: ["agents", "findings"],
  },
  {
    slug: "review",
    group: "Oversight",
    title: "Review",
    summary: "The decisions only a person should make, in one queue.",
    outcome: "You can act on the decisions that need human judgment.",
    blocks: [
      { t: "p", text: "Review is where sensitive and uncertain decisions are raised to a person. An agent can propose; some choices should not ship without someone deciding." },
      { t: "h2", text: "What reaches review" },
      { t: "ul", items: [
        "Sensitive actions, such as a pricing or access change.",
        "Assumptions that cannot be settled from evidence alone.",
        "Points where the responsibility and the observed behavior disagree.",
      ] },
      { t: "p", text: "A decision in Review is recorded against the responsibility, so the reason a change shipped is preserved next to the change itself." },
    ],
    related: ["responsibilities", "findings"],
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
      { t: "p", text: "When work fails a responsibility, Vraelis packages what should have happened, what happened instead, how to reproduce it, and the evidence. That package is a structured handoff the agent can act on." },
      { t: "h2", text: "The division of labor" },
      { t: "p", text: "The agent diagnoses the cause and makes the change. Vraelis independently rechecks the repair against the same responsibility. A repair is verified as its own run, and an earlier record is never overwritten." },
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
      { t: "p", text: "Completion is the decision at the end of a responsibility. It is one of three answers, and the third is the one most tools refuse to give." },
      { t: "ul", items: [
        "Verified: the responsibility held, with the evidence to show it.",
        "Failed: it did not, and here is what happened instead.",
        "Blocked: no honest decision could be reached, so none is claimed.",
      ] },
      { t: "p", text: "Completion is accepted only when the responsibility is met, not when the agent says it is done." },
    ],
    related: ["repair", "memory"],
  },
  {
    slug: "memory",
    group: "Beyond the task",
    title: "Memory",
    summary: "Requirements, failures, repairs, and trusted decisions, accumulated over time.",
    outcome: "You can see how oversight compounds across tasks.",
    blocks: [
      { t: "p", text: "Every responsibility teaches Vraelis something about your software and your agents. Memory is where that accumulates: the requirements you depend on, the boundaries of your architecture, the failures that recur, the decisions you have approved, and the standard your completions are held to." },
      { t: "h2", text: "Why it matters" },
      { t: "p", text: "Oversight compounds. What Vraelis learns on one responsibility makes the next faster to judge and harder to fool. The value is not a single verdict; it is a growing, company-specific understanding of how your software and your agents actually behave." },
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

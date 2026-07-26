// Dated release feed. Seeded only with truthful shipped milestones from the repository. Dates and claims are
// real; where a capability points at future work it is labeled as direction, not shipped.
export type Entry = { date: string; tag: "go" | "wait"; tagLabel: string; title: string; body: string[]; note?: string };

export const CHANGELOG: Entry[] = [
  {
    date: "2026-07-23",
    tag: "go",
    tagLabel: "Shipped",
    title: "Canonical verification result page",
    body: [
      "A verification now has one read-only result page: the claim, the decision, the evidence, and the provenance, in a single canonical route. A decision is translated through one place, so what a person reads and what a machine reads never disagree.",
    ],
  },
  {
    date: "2026-07-23",
    tag: "go",
    tagLabel: "Shipped",
    title: "Webhooks: verification.completed",
    body: [
      "External systems can now receive a verification.completed event when a run finishes, with the canonical decision and a reference to its evidence. The production delivery path was proven end to end against a real run.",
    ],
  },
  {
    date: "2026-07-22",
    tag: "go",
    tagLabel: "Shipped",
    title: "Reviewed plans, approved once and consumed exactly",
    body: [
      "A dry run now mints an immutable plan. A person approves that exact plan, and a paid execution consumes exactly what was reviewed, nothing more. The standard a completion is judged by is fixed before the work is judged, and the building agent cannot change it.",
    ],
  },
  {
    date: "2026-07-22",
    tag: "go",
    tagLabel: "Proven",
    title: "A full Failed to Verified repair loop, on a real run",
    body: [
      "The complete loop closed end to end against a live application: a claim failed against its requirement, a repair was submitted, and the repair was independently verified, with the earlier failed record preserved rather than overwritten.",
    ],
  },
  {
    date: "2026-07-21",
    tag: "go",
    tagLabel: "Shipped",
    title: "The verification primitive",
    body: [
      "The core surface became a single primitive: submit a claimed outcome and a deployment, receive an evidence-backed decision of Verified, Failed, or Blocked. Everything else in the product is built on that one honest answer.",
    ],
  },
  {
    date: "2026-07-20",
    tag: "wait",
    tagLabel: "Direction",
    title: "Toward continuous agent oversight",
    body: [
      "The verification engine is one capability inside a broader direction: following an agent's activity continuously, ingesting live plans and changes, and making autonomy decisions from an agent's track record.",
    ],
    // The renderer already prints a bold "Direction" label before this, so the note must not open with the
    // word again: it extracted and read as "DirectionDirection, not shipped."
    note: "Not shipped. Live activity ingestion and autonomy decisions are not yet available.",
  },
];

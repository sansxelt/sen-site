// Dated release feed. Seeded only with truthful shipped milestones from the repository. Dates and claims are
// real; where a capability points at future work it is labeled as direction, not shipped.
//
// HOW AN ENTRY EARNS ITS PLACE. Every one below was written from the commit that shipped it, and the date is
// that commit's date rather than the date the entry was typed. The feed had gone eleven days stale while the
// product changed underneath it, which is a particular kind of dishonesty for a company whose whole claim is
// that a record should not drift from the thing it records. Prefer fewer, truer entries: one line of work
// that closed is one entry, even when it took nine commits, and nothing goes in that the code does not do.
//
// FUTURE SCOPE DOES NOT LIVE HERE. It lives on /platform#current, beside the list of what is live, so the two
// are read together and cannot disagree. A changelog is a record of the past; a roadmap sitting inside one
// eventually reads as though it already happened. The single Direction entry at the foot of this file is the
// exception and is dated, because on that date the direction itself was the news.
export type Entry = { date: string; tag: "go" | "wait"; tagLabel: string; title: string; body: string[]; note?: string };

export const CHANGELOG: Entry[] = [
  {
    date: "2026-08-03",
    tag: "go",
    tagLabel: "Shipped",
    title: "The refusal now runs on every path that starts a run",
    body: [
      "Vraelis declines to charge when it cannot build a check that would prove the claim. That refusal ran on the public API and on guarantee preparation, and nowhere else, so the two paths a person actually takes, a launch from the console and a targeted rerun, never reached it. It now runs above every credit hold and above the free pass, so nothing is spent before the decision to refuse is made.",
      "A contract that never stated an outcome cannot be gated, because there is nothing to gate it against. Those launches are recorded as ungated rather than counted as having passed, so the size of what is left is measurable instead of arguable.",
    ],
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "The last false Verified",
    body: [
      "An adversarial sweep of the live guarantee found that eight of eleven approved plans could not tell a working application from a broken one. A rejected sign-in was recorded as a successful one, because the check looked for a session-shaped cookie and an anonymous visitor already carries several. An unsaved form satisfied the assertion that it had saved. A flow that never ran was dropped from the verdict instead of failing it, and an empty one passed.",
      "Every one of those is now closed, and the last surface that translated a partial-coverage rerun into a green Verified was corrected to say Blocked, which is what the API, the CI gate and the webhooks had been saying about the same run all along.",
    ],
    note: "A repair rerun exercises only the flows that had failed. That is evidence the repair worked, not evidence the whole guarantee holds, and it is no longer allowed to read as the latter.",
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "A run refuses an address that does not resolve",
    body: [
      "A verification pointed at a mistyped hostname used to queue, drive a real browser at nothing, return Blocked, and keep the charge. The product took payment to report that a URL was wrong. The hostname is now resolved before a run is admitted, above the hold and above the free pass, so a typo costs nothing rather than costing the one free run an account is given.",
      "It asks only whether the name resolves. A real deployment is allowed to answer 404 or 401, and everything ambiguous is let through, including a timeout, because refusing a real customer over a slow second is worse than the charge it would have prevented.",
    ],
  },
  {
    date: "2026-07-30",
    tag: "go",
    tagLabel: "Shipped",
    title: "A single verification can be paid for on its own",
    body: [
      "Pay as you go no longer needs a subscription behind it. The price and the balance had been held in different units, so a customer could top up, watch the balance rise, relaunch, and be refused again forever by a product that could not see the money it had just taken.",
    ],
  },
  {
    date: "2026-07-28",
    tag: "go",
    tagLabel: "Shipped",
    title: "Plans priced on what stays proven, and a way off one",
    body: [
      "The four plans differed only by three numbers, and not one of them mentioned a guarantee. Nobody wants forty verifications; they want checkout to keep granting access and sign-in to keep working. A plan now leads with how many guarantees it keeps proven, and the capacity that pays for that is stated underneath rather than sold as the product.",
      "There is an enterprise tier, and cancelling is a real path with a record rather than a button with nothing behind it.",
    ],
  },
  {
    date: "2026-07-28",
    tag: "go",
    tagLabel: "Shipped",
    title: "The CLI installs as a command",
    body: [
      "One line puts a vraelis command on the PATH, on macOS, Linux and Windows. It signs in and stores a key, says which credential is winning when a machine holds more than one, and exits 0, 1 or 2 for Verified, Failed and Blocked, so a deploy can be gated on the exit code alone. The installer is served as plain text so it can be read before it is run.",
    ],
    note: "Installed by script. The npm package is prepared but is not published, so nothing here is available with npm install yet.",
  },
  {
    date: "2026-07-26",
    tag: "go",
    tagLabel: "Shipped",
    title: "One site, one console, one design",
    body: [
      "The public site was replaced and the console was given the same treatment on a graphite ground, so the walk from a marketing page to sign-in to the product no longer crosses three visual identities. Six pages were added, including the limitations and current-capability surfaces this company would rather a reader found on its own site than worked out later.",
    ],
  },
  {
    date: "2026-07-25",
    tag: "go",
    tagLabel: "Shipped",
    title: "A model may author a requirement. Only a person may review it.",
    body: [
      "Authorship and review became separate recorded facts. A requirement the system wrote is marked machine-authored and awaiting review, and there is no state in which it approves itself. Submitting a claim without an approved plan returns the plan for review and runs nothing.",
      "Running discovery again against an approved contract now refuses, rather than quietly rewriting the meaning an earlier verification was measured against.",
    ],
  },
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

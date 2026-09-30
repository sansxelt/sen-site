// WHAT VRAELIS CAN REACH, WHAT IS NEXT, AND WHAT IT DOES NOT COVER.
//
// REWRITTEN 2026-09-28, twice in one day. The file used to carry a five-rung ladder: web apps, HTTP APIs,
// native apps, an evidence SDK, connected devices and simulators, then physical systems, with a thesis that
// the model "stays the same across web apps, APIs, native software and physical systems". It was first cut
// back to the browser under the brief that locked the public story on one function. The founder then named
// connected devices as the niche, so they are back, stated to the standard every other line here meets:
//
//   LIVE today      a connected device checked THROUGH ITS WEB CONTROL PANEL OR DASHBOARD. That is a web app,
//                   so it is the same real-browser check: an operator action goes in, and Vraelis reads the
//                   state the system reports afterwards, including after a reload.
//   NEXT, NOT BUILT reading the device itself: firmware, sensors, telemetry, command receipt. Nothing in the
//                   product reaches a device directly, and every line that mentions it says so.
//
// HTTP API checks exist as a signed-in beta and are stated once, on /limitations, rather than listed here as
// an equal. The evidence SDK and simulators are not listed separately any more: the SDK was only ever the
// means to device-level checks, and that is the row it now belongs to.
//
// THIS FILE IS THE ONLY PLACE /platform READS COVERAGE FROM, for the same reason _content/scope.ts is the
// only place that answers "what is built": two hand-kept copies of a coverage claim will drift.
//
// ── THE RULE THAT GOVERNS EVERY LINE BELOW, AND IT IS NOT NEGOTIABLE ────────────────────────────────────
//
// A surface may be marked LIVE only after a real failing case has been driven end to end through the actual
// product on that surface, and the product returned the failure truthfully. NEXT means not built, carries no
// date, and says what happens today instead. NOT COVERED means refused or out of reach, with no promise.
//
// ── ON DEVICES IN PARTICULAR ────────────────────────────────────────────────────────────────────────────
//
// Vraelis verifies DEFINED BEHAVIOUR against stated requirements, with evidence. It does not certify safety
// and does not guarantee that any system is harmless. No line here may suggest otherwise, at any tier.

export type CoverageTier = "Live" | "Next" | "Not covered";

export type Surface = {
  /** What a reader would call the thing being checked. */
  readonly name: string;
  /** How Vraelis reaches it, or would. */
  readonly reach: string;
  /** The true present tense. On a Next row this must say, plainly, that it is not built. */
  readonly today: string;
  readonly tier: CoverageTier;
  /** One line for compact lists (the homepage's "What you can check"). Same claim as `reach`, shorter. */
  readonly brief: string;
};

/** The one idea the section rests on. Stated once, here, so no page re-argues it. */
export const COVERAGE_THESIS =
  "Vraelis checks what a person can do through a web app, in a real browser, on the public address you name. That covers web apps themselves, and connected devices such as drones, robots and fleets through the control panel that runs them. It records what each step expected and what it observed, and answers from that.";

/** What is real first, then what is next, then the edges a reader meets in their first week. */
export const SURFACES: readonly Surface[] = [
  {
    name: "Deployed web applications",
    reach: "A real browser drives the running app the way a person would, on the public https address you name: production, staging or a preview deployment.",
    today: "This is the surface the product was proven on, and every verification so far ran here.",
    tier: "Live",
    brief: "A real browser on the public address you name: production, staging or a preview deployment.",
  },
  {
    name: "Connected devices, through their web control panel",
    reach: "Drones, robots, fleets and other connected hardware, checked through the web control panel or dashboard that runs them. An operator action goes in, for example Return home, and Vraelis checks the state the system reports afterwards: the drone shows Landed, and still does after a reload.",
    today: "Live, because the control panel is a web app: it is the same real-browser check. Vraelis sees what the panel shows and nothing the panel does not.",
    tier: "Live",
    brief: "Drones, robots and fleets, through the web panel that runs them.",
  },
  {
    name: "Device-level checks",
    reach: "Reading the device itself rather than its panel: firmware, sensors, telemetry, command receipt, state transitions and timing, on robots, drones and industrial equipment.",
    today: "Next, not built yet. Nothing in the product reads a device directly today. Vraelis verifies defined behaviour against stated requirements; it does not certify safety.",
    tier: "Next",
    brief: "The device itself: its own API, telemetry and commands, not only its panel.",
  },
  {
    // Electron named because the founder named it (2026-09-29): it is the desktop case most of the people
    // this is for actually ship, and it is the one a browser engine can most plausibly drive.
    name: "Desktop and native mobile applications",
    reach: "The application as a user runs it, on the platform it ships to, starting with Electron desktop apps.",
    today: "Next, not built yet. Today Vraelis checks what a real browser can open, and a native binary is outside it.",
    tier: "Next",
    brief: "Electron and native apps, run the way a user runs them.",
  },
  {
    name: "SDKs and libraries",
    reach: "An SDK or library as its users call it: its own examples run in a sandbox, with what each call returned compared against what it should return.",
    today: "Next, not built yet. Today Vraelis can check an SDK only through a web app built on it.",
    tier: "Next",
    brief: "Your SDK's own examples, run and checked against what they should do.",
  },
  {
    // Readiness is evidence about observed behaviour, mapped to named rules. It is never a certification and
    // never legal advice, and no line may drift toward either (FTC v. accessiBe, 2025, is the precedent).
    name: "Readiness for US and EU rules",
    reach: "The behaviour those rules look at, checked on the live product: trackers that fire before consent, whether reject is as easy as accept, keyboard access, cancelling as easily as signing up, and default passwords on a device panel. Each result names the rule it was checked against and the date.",
    today: "Next, not built yet. When it ships it is evidence for your auditor or counsel. It is not a certification and not legal advice.",
    tier: "Next",
    brief: "Consent, accessibility, cancellation and device security, as evidence for your auditor or counsel.",
  },
  {
    name: "Local and private addresses",
    reach: "localhost, private network addresses, and anything not served over public https.",
    today: "Refused before a run starts, and nothing is charged. Deploy the change somewhere public, a preview URL is enough, and check that.",
    tier: "Not covered",
    brief: "localhost and private networks are refused before a run starts, and nothing is charged.",
  },
];

/** The standing promise about how a row moves. Printed under the list wherever it renders. */
export const COVERAGE_RULE =
  "A surface is marked Live only after a real failing case has been driven end to end through the product on it and the product reported the failure truthfully. Not when the code exists, and not because it is close.";

// WHAT VRAELIS CAN REACH, AND WHAT IT CANNOT REACH YET.
//
// The company definition is broader than the product: the verification model is meant to cover systems
// people run, digital and physical. The SITE, until now, described exactly one surface, a web application in
// a browser, and said nothing about the rest. A reader could not tell whether the browser was the thesis or
// the beachhead, and the honest answer is that it is the beachhead.
//
// THIS FILE IS THE ONLY PLACE THAT ANSWERS IT, for the same reason _content/scope.ts is the only place that
// answers "what is built": two hand-kept copies of a coverage claim will drift, and a coverage claim that
// has drifted is the exact failure this product exists to catch.
//
// ── THE RULE THAT GOVERNS EVERY LINE BELOW, AND IT IS NOT NEGOTIABLE ────────────────────────────────────
//
// A surface may be marked LIVE only after a real failing case has been driven end to end through the actual
// product on that surface, and the product returned the failure truthfully. Not when the adapter compiles.
// Not when the tests pass. Not when it works once by hand. Everything else is DIRECTION, is labelled that
// way wherever it appears, carries no date, and states what happens today instead in the words a reader
// could check.
//
// Detailed product copy must never imply that a Direction surface can be bought, booked or run. The company
// may describe where this goes; it may not describe an unbuilt runtime as though a customer could reach it.
//
// ── ON THE API LINE IN PARTICULAR ───────────────────────────────────────────────────────────────────────
//
// HTTP API verification is generally accessible and technically live, and the engine's INTERNAL canary
// passed. A third-party customer-path proof has not been run. "Internally proven" is true. "Externally
// proven with a real third-party customer path" is NOT, and must never be written, here or anywhere.
//
// ── ON THE PHYSICAL LINE IN PARTICULAR ──────────────────────────────────────────────────────────────────
//
// Vraelis verifies DEFINED BEHAVIOUR against stated requirements, with evidence. It does not certify safety
// and does not guarantee that any system is harmless. No line here may suggest otherwise, at any tier, ever.

export type CoverageTier = "Live" | "Direction";

export type Surface = {
  /** What a reader would call the thing being verified. */
  readonly name: string;
  /** How Vraelis reaches it, or would. */
  readonly reach: string;
  /** The true present tense. On a Direction row this must say, plainly, that it is not built. */
  readonly today: string;
  readonly tier: CoverageTier;
};

/** The one idea the ladder rests on. Stated once, here, so no page re-argues it. */
export const COVERAGE_THESIS =
  "The model does not change from one kind of system to the next. A requirement is written down and held outside the code, the running system is exercised against it under controlled conditions, what happened is captured as evidence, and a decision is made by something other than the thing that did the work. What changes is only how the system is reached and what counts as evidence once you are there. That is why the list below is a reach problem rather than a second product.";

/** Ordered deliberately: what is real first, then outward by how far it is from what is real. */
export const SURFACES: readonly Surface[] = [
  {
    name: "Deployed web applications",
    reach: "A real browser drives the running software the way a person would, against the deployment you name.",
    today: "This is the surface the product was proven on, and every guarantee verified so far ran here.",
    tier: "Live",
  },
  {
    name: "HTTP APIs",
    reach: "Requests, chained calls, the identity they run as, and the state they leave behind afterwards.",
    today: "Generally accessible and technically live. The engine's internal canary passed, including a genuine refusal. A third-party customer-path proof has not been run, and is not claimed.",
    tier: "Live",
  },
  {
    name: "Mobile, desktop and native applications",
    reach: "The application as a user runs it, on the platform it ships to.",
    today: "Not covered. The boundary today is what a real browser and an HTTP client can observe from outside, and a native binary is outside it. The limitations page says the same thing.",
    tier: "Direction",
  },
  {
    name: "An SDK that carries evidence back",
    reach: "For systems no browser and no HTTP client can reach from outside. The SDK would register the exact build, model, firmware and configuration under test, receive the verification instructions, and emit signed execution checkpoints that attach to that exact identity.",
    today: "Not built. The SDK is an integration direction and has never been run as a verified surface. It is the piece the three rows below depend on, which is why it sits above them.",
    tier: "Direction",
  },
  {
    name: "Connected devices, simulators and the edge",
    reach: "Device-control APIs, fleet and operator surfaces, and simulators standing in for hardware that is expensive or unsafe to exercise directly.",
    today: "Not built. Nothing in the product reaches a device or a simulator today.",
    tier: "Direction",
  },
  {
    name: "Physical systems",
    reach: "Robots, drones and industrial equipment, where the evidence is telemetry, command receipt, internal state transitions, actuator outcome, timing, and how the system recovers when something goes wrong.",
    today: "Not built, and further out than everything above it. Stated because it is where the model leads, not because any part of it can be run. Vraelis verifies defined behaviour against stated requirements; it does not certify safety and never will.",
    tier: "Direction",
  },
];

/** The standing promise about how a row moves. Printed under the ladder wherever it renders. */
export const COVERAGE_RULE =
  "A surface moves to Live when a real failing case has been driven end to end through the product on that surface and the product reported the failure truthfully. Not when the code exists, and not because it is close.";

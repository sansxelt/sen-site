// THE TWO LISTS THIS COMPANY IS JUDGED ON, IN ONE FILE.
//
// /platform#current and /company both publish what is live and where the product is going. They were two
// hand-maintained copies and they had already drifted. /company's live list was missing the refusal to
// charge for a claim no check could prove, which is the strongest single thing the product does, and its
// direction column was still four bare noun phrases, the exact shape /platform had already repaired. Two
// surfaces disagreeing about what is built, on a site whose whole pitch is that a record must not drift
// from the thing it records, is the defect this product exists to catch. One list now, imported twice.
//
// THERE IS NO /roadmap ROUTE AND THERE SHOULD NOT BE ONE. A list of destinations lifted out of the column
// beside "Live today" is read as a list of features, because nothing in the phrasing tells a reader which
// side of the line an item is on once it has been moved away from the other side. The same reasoning keeps
// scope out of the changelog, and _content/changelog.ts records it: a record of the past containing a
// roadmap eventually reads as though the roadmap already happened. The two halves stay adjacent or they
// stop being comparable, and a third surface is a third thing that can disagree with the other two.
//
// EVERY DIRECTION ITEM CARRIES A DESTINATION AND THE TRUE PRESENT TENSE UNDERNEATH IT. The second half is
// the load-bearing one, and it is the half a reader can check: it says what happens today, including the
// places where what happens today is "you copy it yourself" or "nothing writes that table". Each was read
// out of the code before it was written here, not inferred from a roadmap. Where the honest answer is that
// nothing is built, it says so in those words.
//
// THE TIER IS NOT A DATE AND MUST NEVER BECOME ONE. /platform#current states that nothing in that section
// is a delivery date, and the standing rule under the two columns is that a line moves to the left when it
// works in the product, never because it is nearly done. Next, Later and Horizon order the work by how much
// of it is already standing; they promise nothing about when.

// What the product does today. Every line is something a reader could exercise this afternoon.
//
// REWRITTEN 2026-09-28 around the one function the public story is locked on. Lines that described the
// check as "a guarantee" first, or put HTTP APIs beside web apps as an equal, are gone: a guarantee is a
// console concept (a claim saved so it can be checked again) and HTTP API checks are a signed-in beta, which
// /limitations says in one line. What was added is what shipped: the MCP server, the approval link, and the
// re-check of an approved plan.
export const LIVE: string[] = [
  "One sentence about a deployed web app, turned into a plan a person approves before anything runs",
  "Connected devices such as drones, robots and fleets, checked through the web control panel that runs them",
  "A real browser run on the live app, with steps, screenshots, console errors and failed requests",
  "An answer with evidence for every run, a repair prompt when it finds a problem, and every run kept",
  "A refusal to charge when no check could prove the claim, on every path that starts a run",
  "A re-check of the same approved plan after a fix, within 24 hours of the approval, up to 10 times, on the same site",
  "The console, an installable CLI, the API for CI, and an MCP server for AI assistants, local and hosted",
  "Signed webhooks and Slack delivery",
];

export type Tier = "Next" | "Later" | "Horizon";
// [destination, what happens today instead, how much of it is already standing]
export type DirectionItem = [string, string, Tier];

// Written in tier order, because the tier is the only ranking on this list and a reader scanning the column
// should not have to reassemble it from a shuffled set of labels.
//
// GAPS IN THE CHECK, AND THE ONE AREA IT IS GROWING INTO. Until 2026-09-28 this list ran out to a Horizon
// tier: live agent activity, surfaces beyond the browser, and autonomy earned from a record. Those were
// destinations for a much larger company, and printed beside the live list they read as the product, so
// they left the public story. The same day the founder named connected devices as the niche: they are checked
// through their web control panels today (see LIVE), and reading the device itself is the first Next line
// below, with native apps beside it. The rest is the honest list of places the check is not finished, each
// with the true present tense. "The repair reaches your coding agent on its own" left this list too: over
// MCP and the CLI the repair prompt now goes straight back to whoever asked.
export const DIRECTION: DirectionItem[] = [
  ["Device-level checks: firmware, sensors and telemetry read from the device itself",
    "Not built yet. Today a drone, robot or fleet is checked through the web control panel that runs it, and Vraelis sees only what that panel shows. Nothing reads the device directly.",
    "Next"],
  ["Native mobile and desktop apps",
    "Not built yet. Today the boundary is what a real browser can open, and a native binary is outside it.",
    "Next"],
  ["The command line and the SDK published as npm packages",
    "Today the CLI installs from a script served as plain text, on macOS, Linux and Windows. Its npm package is prepared and not published, and the TypeScript SDK is in the same state.",
    "Next"],
  ["A plan is rehearsed before a person is asked to approve it",
    "Today a plan goes from prepared to approved with nothing having tried to run it in between. The rehearsal that refuses to mint a plan which cannot pass is an operator script, outside the product.",
    "Next"],
  ["Every run asserts a value no earlier run could have left behind",
    "Today a plan can assert a value an earlier run wrote, so an app that has stopped saving can still come back as if it worked. Clearing that state is a script somebody runs.",
    "Next"],
  ["A repair is a durable record of its own",
    "Today the repair table exists and nothing writes to it, so the surfaces that read it are switched off. The repair prompt itself is real and lives on the issue, on the run report, and in the answer an AI assistant or the CLI receives.",
    "Later"],
  ["A new deployment is noticed, and rechecked without being asked",
    "Today Vraelis reads the deployment you point it at when a run is launched. Nothing watches for the next one. A re-check is started by a person, a CI job or an AI assistant.",
    "Later"],
  ["One page per saved claim, showing every failure, fix and re-check in order",
    "Today each run records the claim and the exact approved plan it was proved against, and a re-check points back at the run it repeats. No surface puts that history in a line yet.",
    "Later"],
];

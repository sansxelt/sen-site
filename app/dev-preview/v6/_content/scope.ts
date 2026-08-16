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
export const LIVE: string[] = [
  "A responsibility record with a reviewed standard held outside the code",
  "Execution of the running software in a real browser, with evidence",
  "A refusal to charge when no check could prove the claim, on every path that starts a run",
  "Human review, findings, and a repair package written for a coding agent",
  "Verified / Failed / Blocked decisions, with history preserved",
  "Deployed web applications and HTTP APIs",
  "API, an installable CLI, webhooks, GitHub, Vercel, and Slack",
];

export type Tier = "Next" | "Later" | "Horizon";
// [destination, what happens today instead, how much of it is already standing]
export type DirectionItem = [string, string, Tier];

// Written in tier order, because the tier is the only ranking on this list and a reader scanning the column
// should not have to reassemble it from a shuffled set of labels.
//
// Six became eleven when the source these were written from was read properly: five honest boundaries were
// not on the page at all, and four of them are things a customer meets in their first week. A gap a reader
// finds out about after paying is worse than the same gap printed here.
export const DIRECTION: DirectionItem[] = [
  ["The command line installs with npm install",
    "Today it installs from a script served as plain text, on macOS, Linux and Windows. The package is prepared and is not published, so npm install does not reach it.",
    "Next"],
  ["A plan is rehearsed before a person is asked to approve it",
    "Today a plan goes from prepared to approved with nothing having tried to run it in between. The rehearsal that refuses to mint a plan which cannot pass is an operator script, outside the product.",
    "Next"],
  ["Every run asserts a value no earlier run could have left behind",
    "Today a plan can assert a value an earlier run wrote, so software that has stopped saving can still come back Verified. Clearing that state is a script somebody runs.",
    "Next"],
  ["An outcome sentence is required when a system is connected",
    "Today a contract that never named an outcome has no claim to gate, so its launches are recorded as ungated rather than counted as having passed.",
    "Next"],
  ["The repair reaches your coding agent on its own",
    "Today a failure writes a repair package onto the issue: what should have happened, what happened instead, and the evidence. Vraelis does not send it anywhere. You copy it.",
    "Later"],
  ["A repair is a durable record of its own",
    "Today the repair table exists and nothing writes to it, so the surfaces that read it are switched off. The repair package itself is real and lives on the issue and on the run report.",
    "Later"],
  ["A new deployment is noticed, and rechecked without being asked",
    "Today Vraelis reads the deployment you point it at when a run is launched. Nothing watches for the next one, and every recheck is started by a person.",
    "Later"],
  ["One page per guarantee, showing every failure, repair and recheck in order",
    "Today each run records the guarantee and the exact approved meaning it was proved against. No surface puts that history in a line yet.",
    "Later"],
  ["Live agent activity read as it happens",
    "Today a check begins at the point work is claimed complete. Plans, code changes and tool calls are not ingested while an agent is working.",
    "Horizon"],
  ["Surfaces beyond a browser, and beside the agent",
    "Today the boundary is what a real browser and an HTTP client can observe from outside. Mobile, desktop and native applications are not covered.",
    "Horizon"],
  ["Reliability memory, and autonomy earned from a record",
    "Not built. How much an agent may be trusted to do alone should be a conclusion drawn from what it has actually got right, rather than a setting somebody chooses.",
    "Horizon"],
];

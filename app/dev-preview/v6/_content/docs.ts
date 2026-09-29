// Typed, data-driven documentation content for design 06. The sidebar, previous/next, table of contents, and
// per-page metadata are all generated from this array. Adding a page here adds it everywhere, no manual nav.
//
// REORGANISED 2026-09-28 around the one thing the product does: one sentence about a deployed web app, a plan
// a person approves, a real browser run on the live app, and one answer with the evidence, then a re-check
// after a fix. Three pages were added for what shipped that day (the loop, AI assistants over MCP, and
// re-checks), "Review" became "Approving a plan" because an API key can no longer approve one, and a
// guarantee is described as what it now is in the public story: a claim saved so it can be checked again.
// Slugs that already existed were kept, so no inbound link broke.
export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "steps"; items: string[] }
  | { t: "note"; label: string; text: string }
  // A real, copyable command or payload inside the article. Rendered by the same DocCode block the per-page
  // example uses, so a setup page can show its commands in the order a reader runs them.
  | { t: "code"; label: string; text: string };

export type Doc = {
  slug: string;
  group: string;
  title: string;
  summary: string;
  outcome: string;
  blocks: Block[];
  related?: string[];
};

// Sidebar group order. DOCS below is written in this order too, because previous and next follow the array.
export const DOC_GROUPS = ["Getting started", "Ways to use it", "The check", "The record"];

export const DOCS: Doc[] = [
  {
    slug: "getting-started",
    group: "Getting started",
    title: "Getting started with Vraelis",
    summary: "Write one sentence about your deployed app, approve the plan, and read your first decision.",
    outcome: "You have run one check on your live app and read its answer.",
    blocks: [
      { t: "p", text: "Vraelis checks whether a deployed web app does what someone says it does. You write one sentence about what should work, a person approves the plan Vraelis writes from it, and a real browser tries it on the live app. The answer is Verified, Failed or Blocked, with the evidence. This guide takes you from an empty account to that first answer." },
      { t: "h2", text: "1. Name the deployed app" },
      { t: "p", text: "Give Vraelis the public https address where the app runs: production, staging or a preview deployment. For a connected device, that is the web control panel or dashboard that runs it. Localhost and private addresses are refused before anything runs. You confirm ownership of the app before a check can start." },
      { t: "h2", text: "2. Write what should work" },
      { t: "p", text: "One sentence: what a user can do, and what should be true afterwards. \"A signed-in user can cancel their plan from Billing and then sees Cancelled\" is a good claim. \"Test the billing page\" is not, because it names no outcome." },
      { t: "p", text: "The same works for a connected device, through the web control panel that runs it: \"After an operator presses Return home, the drone shows Landed, and still does after a reload.\" Vraelis checks what the panel reports. Reading the device itself, its firmware, sensors or telemetry, is next and not built yet." },
      { t: "h2", text: "3. Approve the plan" },
      { t: "p", text: "Vraelis turns the sentence into requirements and the browser steps that would prove them, and shows you both. Nothing runs until a person approves that exact plan. If no check could prove the claim, Vraelis says so and charges nothing." },
      { t: "h2", text: "4. Read the answer" },
      { t: "p", text: "Verified means the claim held on the live app. Failed means it did not, with what was expected, what was observed, and a repair prompt. Blocked means no decision could be reached, so none is claimed. Every answer carries its steps, screenshots, console errors and failed requests." },
      { t: "note", label: "Four ways in", text: "The same check runs from the console, the CLI, CI through the API, and AI assistants over MCP. Start in whichever you already have open." },
    ],
    related: ["the-loop", "ai-assistants"],
  },
  {
    slug: "the-loop",
    group: "Getting started",
    title: "Verify, approve, run, re-check",
    summary: "The whole loop, in the order it happens, in each of the ways to run it.",
    outcome: "You know every step between a claim and a trusted answer, and who takes each one.",
    blocks: [
      { t: "p", text: "Every check follows the same loop, whether it starts in the console, the CLI, a CI job or an AI assistant. The names differ by channel; the steps and the rules do not." },
      { t: "steps", items: [
        "Verify. Send the deployed URL and one sentence. Vraelis writes a plan and returns an approval link. Nothing has run and nothing is charged.",
        "Approve. A person opens the link and approves the plan with one click. An API key cannot approve a plan, so a script or an assistant never signs off on its own check.",
        "Run. The approved plan runs in a real browser on the live app, exactly as approved. The answer is Verified, Failed or Blocked, with the evidence.",
        "Re-check. After a Failed, deploy the fix and run the same approved plan again. No new approval is needed within 24 hours of the approval, for up to 10 re-checks, on the same site.",
      ] },
      { t: "h2", text: "The same loop in each channel" },
      { t: "ul", items: [
        "Console: write the claim, approve under Review, read the result, and run it again from the result page.",
        "CLI: vraelis verify --url URL --claim \"...\" --wait prints the approval link, waits for the approval, runs, and exits 0, 1 or 2. vraelis recheck vrf_... --wait runs the same plan after a fix.",
        "API: POST /v1/verifications returns review_required and an approve_url. After the approval, resubmit with reviewed_plan_id to start the run, read GET /v1/verifications/{id}, and re-check with POST /v1/verifications/{id}/recheck.",
        "AI assistants over MCP: vraelis_verify, then vraelis_status while the person approves and the run finishes, then vraelis_recheck after a fix.",
      ] },
      { t: "note", label: "Billing", text: "Every run is billed as one verification, a re-check included. A claim Vraelis refuses because no check could prove it costs nothing." },
    ],
    related: ["review", "recheck"],
  },
  {
    slug: "ai-assistants",
    group: "Ways to use it",
    title: "Connect an AI assistant",
    summary: "Let an assistant check its change on the live app over MCP, and hand you the approval.",
    outcome: "Your assistant can call Vraelis, and you know what it can and cannot do with it.",
    blocks: [
      { t: "p", text: "An AI assistant that supports MCP can call Vraelis after it changes your web app. It gets three tools: vraelis_verify to ask for a check, vraelis_status to read where it is, and vraelis_recheck to run the same approved plan after a fix. No tool can approve a plan; the assistant hands you the link." },
      { t: "h2", text: "Set up with vraelis init" },
      { t: "code", label: "Install, sign in, and set up the assistants on this machine", text: "curl -fsS https://vraelis.com/install | sh      # macOS and Linux\nirm https://vraelis.com/install.ps1 | iex        # Windows PowerShell\n\nvraelis login\nvraelis init                 # every assistant found on this machine\nvraelis init claude codex    # or name them: claude, codex, gemini, copilot, cursor, trae, all" },
      { t: "p", text: "init writes the MCP setup for Claude Code, Codex, Gemini CLI, GitHub Copilot in VS Code and the Copilot CLI, and Cursor. For Trae it prints the JSON to paste under Settings > MCP > Add > Configure manually. It also adds a short rule to the project's AGENTS.md, verify before you say it's done, and to CLAUDE.md or GEMINI.md when those assistants are chosen and the file does not already import AGENTS.md. On Windows, use init rather than the manual lines: it registers node and the script path, because many assistants cannot launch the installer's vraelis.cmd." },
      { t: "h2", text: "Set up by hand" },
      { t: "code", label: "Local assistants run the server the CLI provides", text: "claude mcp add --scope user vraelis -- vraelis mcp     # Claude Code, terminal and VS Code\ncodex mcp add vraelis -- vraelis mcp                   # Codex, CLI and IDE extension\ngemini mcp add vraelis vraelis mcp                     # Gemini CLI" },
      { t: "p", text: "GitHub Copilot in VS Code, the Copilot CLI, Cursor and Trae take a JSON entry instead, and the setup page lists each one. ChatGPT and Claude on the web connect to the hosted server at https://vraelis.com/mcp and sign in with OAuth: they send you to Vraelis to sign in and click Allow, which creates an API key named after the connector that you can revoke under Developers. Any other MCP client can run vraelis mcp over stdio, or reach the hosted server with an x-api-key header." },
      { t: "note", label: "What no tool can do", text: "Approve a plan, re-check more than 24 hours after the approval or more than 10 times, or re-check on a different site. Every run, a re-check included, is one verification." },
    ],
    related: ["the-loop", "recheck"],
  },
  // "REVIEW" BECAME "APPROVING A PLAN", slug unchanged. On 2026-09-28 the approve endpoint stopped accepting
  // API keys altogether: the keys that call it now belong to CLIs, CI jobs and AI assistants, and the promise
  // is that the tool that asked for a check is not the one that signs off on it.
  {
    slug: "review",
    group: "The check",
    title: "Approving a plan",
    summary: "The one step only a person can take, and why an API key cannot.",
    outcome: "You can approve a plan, and you know why a script or an assistant cannot.",
    blocks: [
      { t: "p", text: "Before the first run of a claim, a person approves the plan Vraelis wrote from it: the requirements it will judge and the browser steps that will prove them. The approval is its own recorded event, saying who approved which plan and when. The run then executes exactly that plan." },
      { t: "h2", text: "Where the approval happens" },
      { t: "ul", items: [
        "In the console, under Review.",
        "At the approval link a check returns: approve_url in the API, the link the CLI prints and opens, and the link an AI assistant hands you. It opens app.vraelis.com/review/ followed by the plan id.",
        "In ChatGPT and Claude, the Vraelis card carries a Review and approve button that opens the same page.",
      ] },
      { t: "h2", text: "Why an API key cannot approve" },
      { t: "p", text: "POST /v1/verifications/plans/{id}/approve refuses every API key with 403 plan_requires_human and returns the approve_url, so the caller can hand it to a person. GET /v1/verifications/plans/{id} reads the plan and its approval_state, and carries approve_url while the plan is still pending." },
      { t: "code", label: "What a key gets back", text: "POST /v1/verifications/plans/rvp_3c9e26ef/approve\n\n403\n{\n  \"error\": { \"code\": \"plan_requires_human\", \"message\": \"Only a signed-in person can approve a plan. ...\" },\n  \"approve_url\": \"https://app.vraelis.com/review/rvp_3c9e26ef\"\n}" },
      { t: "note", label: "Honest boundary", text: "A plan is approved or refused as a whole. Nothing inside an approved plan is singled out for its own hold." },
    ],
    related: ["the-loop", "recheck"],
  },
  // THE SUBJECT OF THIS PAGE IS THE RUN, NOT THE AGENT. It once promised "you can follow what an agent is doing
  // while it does it". None of that is ingested, and the boundary below says so.
  {
    slug: "run-activity",
    group: "The check",
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
        "The decision the run reached, and the repair prompt behind a failure.",
      ] },
      { t: "note", label: "Honest boundary", text: "A check begins when someone says the work is done. Vraelis does not read code, diffs or tool calls, and it does not watch anyone while they work." },
    ],
    related: ["completion", "findings"],
  },
  {
    slug: "completion",
    group: "The check",
    title: "Completion",
    summary: "Verified, Failed, or Blocked, with the evidence behind it.",
    outcome: "You can trust, or refuse to trust, a claim that something works.",
    blocks: [
      { t: "p", text: "Completion is the decision at the end of a run. It is one of three answers, and the third is the one most tools refuse to give." },
      { t: "ul", items: [
        "Verified: the claim held on the live app, with the evidence to show it.",
        "Failed: it did not, and here is what happened instead.",
        "Blocked: no honest decision could be reached, so none is claimed.",
      ] },
      { t: "p", text: "The same three words come back in the console, the CLI's exit code, the API, the MCP tools and the webhooks. A claim is accepted when the live app shows it, not when someone says it is done." },
    ],
    related: ["repair", "recheck"],
  },
  {
    slug: "findings",
    group: "The check",
    title: "Findings",
    summary: "What broke, in terms a person or a coding agent can act on.",
    outcome: "You can read what a failed run found and route it to whoever fixes it.",
    blocks: [
      { t: "p", text: "A finding is what a run records when the live app does not do what the claim says: the requirement that failed, what was expected, what was observed, the steps to reproduce it, and the step it failed at." },
      { t: "h2", text: "A finding is not a guess" },
      { t: "p", text: "Each finding carries what Vraelis observed in the browser and why it was raised, so the next step is a fix, not a mystery. When a run cannot decide, for example because a test account cannot sign in, the answer is Blocked with the reason rather than a finding." },
    ],
    related: ["repair", "recheck"],
  },
  {
    slug: "repair",
    group: "The check",
    title: "Repair",
    summary: "A repair prompt for whoever fixes it, and a re-check that proves the fix.",
    outcome: "You can turn a Failed into a checked fix.",
    blocks: [
      { t: "p", text: "When a run fails, Vraelis writes a repair prompt: what should have happened, what happened instead, how to reproduce it, and the evidence. It is written so a person or a coding agent can act on it directly." },
      { t: "h2", text: "The division of labor" },
      { t: "p", text: "Whoever fixes it diagnoses the cause and makes the change. Vraelis does not edit code. Once the fix is deployed, a re-check runs the same approved plan again as its own run, and an earlier record is never overwritten." },
      { t: "note", label: "Where the prompt goes", text: "Back to whoever asked: in the answer an AI assistant gets over MCP, in the CLI's output (--repair-prompt prints only the prompt), in the API response, and on the run report. A re-check is started by a person, a CI job or an assistant. Nothing re-checks on its own." },
      { t: "note", label: "Preserved history", text: "Every result is kept. A later Verified does not erase an earlier Failed." },
    ],
    related: ["recheck", "completion"],
  },
  {
    slug: "recheck",
    group: "The check",
    title: "Re-checks",
    summary: "Run the same approved plan again after a fix, without a new approval.",
    outcome: "You can prove a fix on the live app without asking for approval again.",
    blocks: [
      { t: "p", text: "A re-check runs every journey of an approved plan again, against the live app, after a fix has been deployed. It returns a new verification id and points back at the run it repeats; the earlier record is never touched. It runs all the journeys, not only the failed ones, because a run over a subset can only prove a repair, not the whole claim." },
      { t: "h2", text: "When no new approval is needed" },
      { t: "ul", items: [
        "Within 24 hours of the person's approval of the plan.",
        "For at most 10 re-checks of that approval.",
        "On the same site: the same scheme and host. A different path on that site is allowed.",
      ] },
      { t: "p", text: "Outside those limits the API answers recheck_window_closed or recheck_limit_reached. Start a new verification and a person approves its plan again." },
      { t: "h2", text: "How to start one" },
      { t: "code", label: "API, CLI and MCP", text: "POST /v1/verifications/vrf_9c1e0f2a41/recheck        # optional body: { \"deployment_url\": \"...\" }\n\nvraelis recheck vrf_9c1e0f2a41 --wait\n\nvraelis_recheck  { \"verification_id\": \"vrf_9c1e0f2a41\" }" },
      { t: "p", text: "The response carries recheck_of, rechecks_left and recheck_window_ends_at, and GET /v1/verifications/{id} reports recheck_of on every run. A re-check needs a key with launch access, because it spends." },
      { t: "note", label: "Billing", text: "Each re-check is billed as one verification, the same as the first run." },
    ],
    related: ["repair", "review"],
  },
  // THIS PAGE DOCUMENTED A ROUTE THAT DOES NOT EXIST, IN A VOCABULARY NOBODY ELSE USES, until it was retitled
  // to the surface that is actually there. The five labels below are the five that surface renders, and the
  // three verdicts are translated through lib/preflight/public-decision.ts so no surface can disagree.
  {
    slug: "systems",
    group: "The record",
    title: "Systems",
    summary: "Every app you have connected, and how the last run on each one decided.",
    outcome: "You can see where every connected app stands.",
    blocks: [
      { t: "p", text: "A system is one deployed app you check with Vraelis. Systems is the index of them: every app you have connected, each with the decision from its most recent verification." },
      { t: "h2", text: "What a system holds" },
      { t: "ul", items: [
        "The deployment Vraelis drives when a run is launched.",
        "The claims checked against it, each with the exact approved plan it was proved against.",
        "Every verification, with its evidence and its decision preserved.",
        "The issues a failed run raised, each carrying its repair prompt.",
      ] },
      { t: "h2", text: "What the label on a system means" },
      { t: "ul", items: [
        "Verified: the last run held its claim, with the evidence to show it.",
        "Failed: the last run did not, and it says what happened instead.",
        "Blocked: no honest decision could be reached, so none is claimed.",
        "In progress: a run is moving and has not reached a decision yet.",
        "Not tested: nothing has been verified against this system yet.",
      ] },
      { t: "note", label: "In review is not a verdict", text: "A plan waiting for a person to approve it is in review. That is a state a plan is in before anything runs, not an answer about your app. The answers are Verified, Failed, and Blocked." },
    ],
    related: ["guarantees", "memory"],
  },
  // A GUARANTEE IS A SAVED CLAIM. The page used to sell it as the durable object at the center of the product
  // ("the one sentence about your software that has to stay true"). In the public story locked on 2026-09-28
  // the claim is the object, and a guarantee is the console's name for a claim kept so it can be checked
  // again. The table (sql/vraelis-preflight-19-guarantees.sql) and the console's /guarantees are unchanged.
  {
    slug: "guarantees",
    group: "The record",
    title: "Guarantees",
    summary: "A claim saved so it can be checked again.",
    outcome: "You can keep a claim and check it again later against the same approved meaning.",
    blocks: [
      { t: "p", text: "A guarantee is a claim you save in the console so it can be checked again: the same sentence, held outside the code, with the plan a person approved for it. It is useful for the things that have to keep working as the app changes, such as sign-in, checkout, or one customer never seeing another's data." },
      { t: "h2", text: "Writing a claim worth keeping" },
      { t: "steps", items: [
        "State an outcome, not a set of steps. \"A paid customer keeps the plan they bought\" travels; \"call the billing endpoint\" does not.",
        "Keep it to one sentence. If it needs two, it is probably two claims.",
        "Make it checkable on the running app, not against someone's description of their work.",
      ] },
      { t: "note", label: "Separation of duties", text: "Whoever did the work cannot approve the standard used to judge it. A person approves the plan behind every guarantee, and an API key cannot." },
    ],
    related: ["systems", "review"],
  },
  // WHAT IS KEPT, AND NOTHING MORE. This page once described accumulated, compounding understanding in the
  // present tense and later as a Direction section. The direction left the public story on 2026-09-28; what
  // remains is what is true today. Slug kept so existing links resolve.
  {
    slug: "memory",
    group: "The record",
    title: "Memory",
    summary: "What is kept after every run, and what is not read back.",
    outcome: "You know exactly what Vraelis keeps about each check.",
    blocks: [
      { t: "p", text: "Every run is kept: the plan that was approved, the step by step record, the screenshots, the decision it reached, and the repair prompt behind a failure. A re-check points back at the run it repeats. A later Verified does not erase an earlier Failed, so the history of how a claim came to hold stays intact." },
      { t: "note", label: "Honest boundary", text: "Vraelis keeps the full history and shows it to you. It does not use that history to judge the next run." },
    ],
    related: ["systems", "completion"],
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

// Typed, data-driven documentation content for design 06. The sidebar, previous/next, table of contents, and
// per-page metadata are all generated from this array. Adding a page here adds it everywhere, no manual nav:
// the rail, the docs home, /llms.txt, /llms-full.txt and the sitemap all read DOCS.
//
// REORGANISED 2026-09-28 around the one thing the product does: one sentence about a deployed web app, a plan
// a person approves, a real browser run on the live app, and one answer with the evidence, then a re-check
// after a fix. Three pages were added for what shipped that day (the loop, AI assistants over MCP, and
// re-checks), "Review" became "Approving a plan" because an API key can no longer approve one, and a
// guarantee is described as what it now is in the public story: a claim saved so it can be checked again.
// Slugs that already existed were kept, so no inbound link broke.
//
// 2026-10-02 (plan C, batch 7): four pages joined "Ways to run" (cli, api, ci, webhooks). Their reference
// material is copied from app/dev-preview/v6/developers/page.tsx as it stood at 10c6b20f (the request and
// response shapes, the dry run, the gate script, the webhook verification code), which /developers no longer
// carries; the CLI's options and the CI step are copied from the console's own Command line page
// (app/rank/app/api/cli-section.tsx), which is read off the real binary. /docs/ai-assistants took the
// per-assistant setup from /agents#manual, one h3 per assistant with the ids /agents links to. The five
// console figures were re-shot from the black console, and their marks re-measured on the new files.
//
// INLINE MARKUP. Text in p, ul, steps, note and table cells may carry `code` (backticks) and [label](href)
// links, and nothing else. A link sits after its sentence, never inside it: the translator keys on whole
// text nodes, and a link in the middle of a sentence splits it into fragments (plan 0.6). Inline code is
// machine text the translator skips.
import { V6_BASE, v6ShouldPrefetch } from "@/lib/v6-routes";

/** Current guides advertised by the docs index, sitemap and machine-readable exports. */
export const CURRENT_DOC_SLUGS: readonly string[] = ["ai-security", "contour-release-security", "recorded-reports"];

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  // A sub-heading with a fixed id, so an anchor can be linked from elsewhere (/agents links the ten
  // /docs/ai-assistants#<assistant> ids) and survives a change to the heading's words.
  | { t: "h3"; text: string; id: string }
  | { t: "ul"; items: string[] }
  | { t: "steps"; items: string[] }
  | { t: "note"; label: string; text: string }
  // A real, copyable command or payload inside the article. Rendered by the same DocCode block the per-page
  // example uses, so a setup page can show its commands in the order a reader runs them.
  | { t: "code"; label: string; text: string }
  // Reference rows: exit codes, options, variables. `label` names the table for assistive technology; the
  // first cell of each row is its header. Cells take inline markup.
  | { t: "table"; label: string; head: string[]; rows: string[][] }
  // A REAL CONSOLE SCREENSHOT, cropped to the part the text is about, with numbered marks. Captured from the
  // QA account's own runs in the black console (2026-10-02), never mocked up. x and y are percentages of the
  // image (measured on the file, scratchpad qa/b7a-docs/capture.mjs), and each mark's label is printed under
  // it, so the numbers carry meaning without the picture.
  | { t: "figure"; src: string; alt: string; width: number; height: number; caption: string; credit?: string; marks?: { x: number; y: number; label: string }[] }
  // The surfaces list from _content/coverage.ts, so the docs and the site read one source.
  | { t: "surfaces" };

export type Doc = {
  slug: string;
  group: string;
  title: string;
  summary: string;
  outcome: string;
  /** What this does NOT do, in one sentence. Linear's docs carry one on every page; ours say where the
   *  product stops so nobody finds out from a failed run. */
  limit?: string;
  blocks: Block[];
  related?: string[];
};

// Sidebar group order. DOCS below is written in this order too, because previous and next follow the array.
export const DOC_GROUPS = ["Getting started", "Ways to run", "The check", "The record"];


// ── Reference material copied from /developers at 10c6b20f. Every shape is read off the route handlers
//    (app/api/v1/verifications, cli/vraelis.mjs, lib/preflight/webhook-dispatch.ts); re-check them there
//    before editing a line. The line continuations are "\\", not "\": see docs/[slug]/page.tsx.
const API_CREATE = `# 1. Submit the claim. Vraelis writes a plan and asks a person to approve it before anything runs.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{
    "deployment_url": "https://staging.example.com",
    "claim": "A customer can upgrade to Pro and still have access after signing in again."
  }'`;

const API_CREATE_RES = `{
  "state": "review_required",
  "review_required": true,
  "claim": "A customer can upgrade to Pro and still have access after signing in again.",
  "requirements": [
    "Upgrading to Pro grants Pro access immediately",
    "Pro access is still present after signing out and back in"
  ],
  "reviewed_plan_id": "rvp_3c9e26ef",
  "reviewed_plan_expires_at": "2026-09-28T19:04:11.000Z",
  "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef",
  "human_reviewed": false,
  "message": "Vraelis built a plan that can prove this claim, and no person has reviewed it yet. A person approves it at approve_url; then resubmit with reviewed_plan_id to run exactly what was approved. Nothing was run and nothing was charged."
}`;

const API_APPROVE_RUN = `# 2. A person opens approve_url and approves the plan with one click. A key cannot:
curl -X POST https://vraelis.com/api/v1/verifications/plans/rvp_3c9e26ef/approve \\
  -H "x-api-key: $VRAELIS_API_KEY"
#    -> 403 { "error": { "code": "plan_requires_human", ... },
#             "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef" }

# While you wait for the person, read the plan. approve_url is present while it is pending.
curl https://vraelis.com/api/v1/verifications/plans/rvp_3c9e26ef \\
  -H "x-api-key: $VRAELIS_API_KEY"
#    -> { "reviewed_plan_id": "rvp_3c9e26ef", "approval_state": "pending",
#         "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef", ... }

# 3. Once approval_state reads "approved", resubmit the SAME deployment and claim with the plan id.
#    This is the call that starts a run, and the first response that carries a verification_id.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://staging.example.com",
        "claim": "A customer can upgrade to Pro and still have access after signing in again.",
        "reviewed_plan_id": "rvp_3c9e26ef" }'
#    -> { "verification_id": "vrf_9c1e0f2a41", "state": "running",
#         "status_url": "/v1/verifications/vrf_9c1e0f2a41", "human_reviewed": true }`;

const API_READ = `# 4. Poll until a decision lands. While the run is going, there is no decision yet.
curl https://vraelis.com/api/v1/verifications/vrf_9c1e0f2a41 \\
  -H "x-api-key: $VRAELIS_API_KEY"`;

const API_READ_RES = `{
  "verification_id": "vrf_9c1e0f2a41",
  "state": "completed",
  "decision": "failed",
  "claim": "A customer can upgrade to Pro and still have access after signing in again.",
  "requirements": [
    "Upgrading to Pro grants Pro access immediately",
    "Pro access is still present after signing out and back in"
  ],
  "failures": [
    {
      "severity": "critical",
      "title": "Pro access is lost after signing back in",
      "expected": "The account still shows Pro after re-authenticating",
      "observed": "The account reverted to the Free plan",
      "reproduce": ["Upgrade to Pro", "Sign out", "Sign back in", "Open billing"]
    }
  ],
  "evidence": [
    { "checking": "Upgrade to Pro", "result": "passed", "failed_at_step": null },
    { "checking": "Access persists after re-auth", "result": "failed", "failed_at_step": 3 }
  ],
  "repair_prompt": "Pro entitlement is not re-read on session restore. On sign-in, load the subscription from the source of truth before rendering plan state, and confirm Pro survives a full sign-out and sign-in.",
  "console_url": "https://app.vraelis.com/systems/app_5b7d/passes/9c1e0f2a41",
  "reviewed_plan_id": "rvp_3c9e26ef",
  "recheck_of": null,
  "human_reviewed": true
}`;

const API_RECHECK = `# 5. Deploy the fix, then run the same approved plan again. No new approval inside the window.
curl -X POST https://vraelis.com/api/v1/verifications/vrf_9c1e0f2a41/recheck \\
  -H "x-api-key: $VRAELIS_API_KEY"`;

const API_RECHECK_RES = `{
  "verification_id": "vrf_4be27d9c10",
  "state": "running",
  "status_url": "/v1/verifications/vrf_4be27d9c10",
  "recheck_of": "vrf_9c1e0f2a41",
  "human_reviewed": true,
  "reviewed_plan_id": "rvp_3c9e26ef",
  "rechecks_left": 9,
  "recheck_window_ends_at": "2026-09-29T18:04:11.000Z"
}`;

const API_IDEM_ERR = `{
  "error": {
    "code": "idempotency_key_reused",
    "message": "That idempotency key was already used for a different verification. Use a new key, or resend the original request exactly.",
    "request_id": "req_5f3a90"
  }
}`;

const API_DRY = `# Ask "is this claim provable against this build?" before spending anything.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://staging.example.com",
        "claim": "A customer can upgrade to Pro and keep access after signing in again.",
        "dry_run": true }'`;

const API_DRY_RES = `{
  "dry_run": true,
  "would_launch": true,
  "requirements": ["Upgrading to Pro grants Pro access immediately", "..."],
  "reviewed_plan_id": "rvp_3c9e26ef",
  "reviewed_plan_expires_at": "2026-09-28T19:04:11.000Z",
  "approval_required": true,
  "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef",
  "human_reviewed": false
}`;

const CLI_INSTALL = `# Install. macOS and Linux:
curl -fsS https://vraelis.com/install | sh
# Windows (PowerShell):
irm https://vraelis.com/install.ps1 | iex

# Sign in once. Paste a key with "Launch runs" access, created at app.vraelis.com/developers.
vraelis login`;

const CLI_VERIFY = `# Check a claim. Prints the plan and the approval link, opens the link when a person
# is at the terminal, waits for the approval, runs, and exits on the decision.
vraelis verify \\
  --url https://staging.example.com \\
  --claim "A customer can upgrade to Pro and keep access after signing in again" \\
  --wait

# After a fix is deployed to the same address: the same approved plan, with no
# new approval within 24 hours of the approval, up to 10 times.
vraelis recheck vrf_9c1e0f2a41 --wait`;

// The console's own CI step (app/rank/app/api/cli-section.tsx), word for word.
const CI_STEP = `# In CI: gate the deploy on the DECISION, not on the command finishing.
curl -fsS https://vraelis.com/install | sh
vraelis verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait --json > result.json
# The approval link is printed to the log; the job waits until a person approves.
# exit 0 verified   exit 1 failed   exit 2 blocked, or could not run
#
# Blocked is not a pass. A run that merely finished is not a pass.
# Only exit 0 should ship.

# On a failure, hand the repair prompt straight to a coding agent:
vraelis result "$(jq -r .verification_id result.json)" --repair-prompt | claude -p`;

const CI_GATE = `// gate.mjs: ship only on "verified". The exit code gates the deploy.
// 0 verified   1 failed   2 blocked   3 no decision reached   4 the plan still needs a person to approve it
import { randomUUID } from "node:crypto";

const API = "https://vraelis.com/api/v1/verifications";
const headers = {
  "content-type": "application/json",
  "x-api-key": process.env.VRAELIS_API_KEY,
  "idempotency-key": randomUUID(),
};
const request = { deployment_url: process.env.PREVIEW_URL, claim: process.env.VRAELIS_CLAIM };
const post = (body) => fetch(API, { method: "POST", headers, body: JSON.stringify(body) });

// A submit with no reviewed_plan_id returns review_required, not a run: no verification_id, nothing charged.
// A key cannot approve the plan, so the job hands the link to a person and stops.
const planId = process.env.VRAELIS_REVIEWED_PLAN_ID;
if (!planId) {
  const plan = await (await post(request)).json();
  console.error("A person approves this plan first: " + plan.approve_url);
  process.exit(4);
}

// The approved plan is what starts a run, and this response is the first to carry a verification_id.
const { verification_id } = await (await post({ ...request, reviewed_plan_id: planId })).json();

// While running, decision is absent; keep polling until it lands.
let decision = null, out;
for (let i = 0; i < 120 && decision === null; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  out = await (await fetch(API + "/" + verification_id, { headers })).json();
  decision = out.decision ?? null;
}

// Gate on the decision, never the run state. A finished run is not a pass.
switch (decision) {
  case "verified": process.exit(0);
  case "failed":   process.exit(1);
  case "blocked":  process.exit(2);
  default:         process.exit(3); // no decision within the polling window
}`;

// The body an endpoint under Developers receives: buildVerificationPayload's fields, then the delivery_id
// lib/v-webhooks.ts adds. Example values, as on /developers at 10c6b20f, plus that last line.
const HOOK_PAYLOAD = `{
  "event": "verification.completed",
  "run_id": "9c1e0f2a41",
  "application_id": "app_5b7d",
  "decision": "failed",
  "flows_total": 4,
  "flows_passed": 3,
  "deployment_url": "https://staging.example.com",
  "completed_at": "2026-09-28T18:04:11.220Z",
  "report_url": "https://app.vraelis.com/systems/app_5b7d/passes/9c1e0f2a41",
  "delivery_id": "5f0c2e8a-1b7d-4c39-9e2a-0f2a41c1e9d6"
}`;

// Two changes from the /developers original, both read off lib/v-webhooks.ts: the key is the endpoint's own
// signing secret (whsec_..., shown under Developers in the console), not a variable named like a Vraelis key,
// and the lengths are compared first, because timingSafeEqual throws on buffers of different lengths.
const HOOK_VERIFY = `// Verify the delivery: HMAC-SHA256 over \`\${timestamp}.\${rawBody}\`, keyed with the endpoint's
// signing secret (whsec_...), which the console shows under Developers.
import { createHmac, timingSafeEqual } from "node:crypto";

const timestamp = req.headers["x-vraelis-timestamp"];
const signature = req.headers["x-vraelis-signature"];   // "sha256=<hex>"
const expected = "sha256=" + createHmac("sha256", process.env.VRAELIS_WEBHOOK_SECRET)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex");

const ok = Boolean(signature) && signature.length === expected.length
  && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));`;

// The per-assistant setup, from /agents#manual at 10c6b20f, which took each line from ASSISTANTS in
// cli/vraelis.mjs. The plain stdio entry Cursor and Trae both read is built from an object, so the rendered
// JSON is always valid.
const MCP_SERVERS = JSON.stringify({ mcpServers: { vraelis: { command: "vraelis", args: ["mcp"] } } }, null, 2);

// The CLI's exit codes, as /developers listed them at 10c6b20f (cli/vraelis.mjs implements them).
const CLI_EXITS: string[][] = [
  ["`0`", "Verified. The claim held on the live app, with evidence."],
  ["`1`", "Failed. The claim did not hold; a repair prompt is attached."],
  ["`2`", "Blocked, or the tool could not run at all."],
];

export const DOCS: Doc[] = [
  {
    slug: "ai-security",
    group: "Getting started",
    title: "AI security at Vraelis",
    summary: "Our development scope, the security problems we are investigating and the foundations that exist today.",
    outcome: "Understand the current direction and distinguish research from implemented components.",
    limit: "Public workspace access is closed. These references are not instructions for an available deployment.",
    blocks: [
      { t: "p", text: "Vraelis is developing independent cybersecurity software for AI-enabled defense, critical infrastructure and robotics. The company direction covers model integrity, adversarial threats, machine trust and security evidence." },
      { t: "h2", text: "Company scope and products" },
      { t: "p", text: "The company scope follows AI from release through operation and investigation. These workstreams organize research and development; they are not four available products. Vraelis Contour is our first product direction, focused on model release security for robotics suppliers and system integrators." },
      { t: "h2", text: "Model integrity" },
      { t: "p", text: "Identify the model, dependencies and configuration a system is running, and compare them with reviewed artifacts. Authenticity helps establish provenance; it does not prove that a model is safe or free of backdoors. Runtime attestation and deployment integrations remain development work." },
      { t: "h2", text: "Adversarial threats" },
      { t: "p", text: "Investigate manipulated inputs, training-data poisoning and untrusted instructions reaching AI agents. Evaluation must name the model, attacker capabilities, conditions and limitations. We do not claim a universal attack detector or measured edge-inference performance." },
      { t: "h2", text: "Machine trust" },
      { t: "p", text: "Separate an AI proposal from permission to act. Identity, resource, action, workload integrity and policy must be established through trustworthy sources. Existing safety controls remain responsible for physical recovery and safe states." },
      { t: "h2", text: "Security evidence" },
      { t: "p", text: "Compare supplied reports against reviewed criteria and inspect the source events supporting a finding. Missing evidence remains unresolved. A recorded report is not authenticated telemetry or physical ground truth." },
      { t: "h2", text: "Current foundations" },
      { t: "p", text: "Private foundations include a policy decision core, a recorded-evidence evaluator and a small model-release experiment with real ONNX CPU loading. The experiment separates authorized release metadata from the session a managed service reports loading. Production identity, runtime integrations and independently trustworthy observation remain development work." },
      { t: "p", text: "The private workspace address is data.vraelis.com. Sign-in and new account access are currently closed." },
      { t: "note", label: "Earlier implementation references", text: "The browser verification, CLI, API and console guides describe earlier implementation work. They do not define the current company scope or establish availability of those services." },
    ],
    related: ["contour-release-security", "recorded-reports"],
  },
  {
    slug: "contour-release-security",
    group: "Getting started",
    title: "Vraelis Contour release security",
    summary: "Understand the intended release workflow, recipient responsibilities and limits of the private reference experiment.",
    outcome: "Distinguish release identity, approval, readiness, managed loading and acceptance evidence.",
    limit: "Vraelis Contour is in private development. Release evidence does not establish model safety or protection against a compromised host.",
    blocks: [
      { t: "p", text: "Vraelis Contour is our first product direction within a wider AI cybersecurity company. Its intended users are release, platform and security engineers at robotics suppliers and system integrators. The candidate job is connecting an approved model-bearing release to its receiving environment and an explicit acceptance outcome." },
      { t: "h2", text: "The release unit" },
      { t: "p", text: "Define the complete unit the recipient accepts. It may include the model, preprocessing, configuration, calibration and runtime dependencies, or form part of an application, container or firmware release. Checking a model alone cannot establish compatibility of the whole system." },
      { t: "h2", text: "The intended workflow" },
      { t: "steps", items: ["Identify the exact release and the assessments that apply to those artifacts.", "Establish the recipient authority and bind approval to the release and its destination.", "Check candidate compatibility before accepted rollout under the agreed operating policy.", "Record what the managed runtime reports loading and preserve failed or uncertain activation.", "Let the recipient decide acceptance, continued operation, withdrawal and recovery."] },
      { t: "h2", text: "Supplier and recipient responsibilities" },
      { t: "p", text: "The supplier identifies and delivers the release. The recipient owns destination authorization and acceptance. The runtime operator controls installation and recovery. These responsibilities may belong to different organizations; a supplier signature does not grant permission to change a customer's system." },
      { t: "h2", text: "Current reference experiment" },
      { t: "p", text: "A small private ONNX CPU experiment exercises signed model/configuration bindings, destination-bound approval, real synthetic model execution and desired-versus-loaded session reports. It also exposes interrupted activation and an authorized release that fails to load. It is a reference experiment rather than an available robotics integration." },
      { t: "h2", text: "What the evidence establishes" },
      { t: "ul", items: ["A signature authenticates an endorsement of particular bytes; it does not establish benign behavior or absence of backdoors.", "Loaded-session evidence is a managed-service self-report. The host and worker are trusted; this is not independent attestation.", "A missing or inconsistent observation remains unresolved. Authorization and successful activation are separate events.", "Signer revocation and withdrawal of an already running release are separate policy decisions."] },
      { t: "h2", text: "Evaluation before integration" },
      { t: "p", text: "A useful evaluation starts with a recurring recipient problem and compares existing signing, deployment, scanning and logging tools. Define the threat, required evidence, availability, recovery and total integration effort before testing a new control. Public workspace access remains closed." },
    ],
    related: ["ai-security", "recorded-reports"],
  },
  {
    slug: "recorded-reports",
    group: "Getting started",
    title: "Review recorded task reports",
    summary: "Compare supplied control-panel, service and device reports for one task. Inspect disagreements, missing evidence and changes to another asset.",
    outcome: "You have evaluated a supplied recording against reviewed criteria and inspected the source events.",
    limit: "The private evaluator evaluates reported states. It does not connect to a live device, establish physical ground truth or certify safety.",
    blocks: [
      { t: "p", text: "This reference describes the recorded-evidence component in private development. Public workspace access is closed. The component compares supplied events with reviewed criteria; it does not run a live investigation or protect a device." },
      { t: "h2", text: "Evaluation sequence" },
      { t: "steps", items: ["Supply a supported recording and review its asset, task and capture identity.", "Define the required events, deadline and any assets that must remain unchanged.", "Review declared coverage before evaluating the supplied reports.", "Inspect findings and their cited source events. Insufficient coverage remains inconclusive."] },
      { t: "h2", text: "Supported input" },
      { t: "table", label: "Recording formats", head: ["Format", "Current support"], rows: [["JSON", "Normalized version 1 recordings, up to 1 MB and 2,000 events. Each event names its source, asset, task, timestamp and supported state."], ["MCAP", "Uncompressed files up to 5 MB, with flat JSON task-event messages. Map each supported topic to control, service or device, then supply a capture manifest."], ["Not supported", "ROS CDR, LZ4 or Zstandard compression, arbitrary nested message schemas, sensor interpretation and live device streams."]] },
      { t: "p", text: "For MCAP, event time comes from the payload’s timeMs field, not the container timestamp. Review run and build identity, topic mapping, clock and captured intervals before evaluation. Declared coverage describes the supplied recording; it is not proof that a device’s report is authentic." },
      { t: "h2", text: "What the result means" },
      { t: "ul", items: ["Passed: the supplied reports meet the reviewed criteria, within the declared capture window.", "Failed: a required event is absent from declared full coverage, arrives too late, reports a contradictory state or changes an asset that should remain unchanged.", "Inconclusive: the required identity, baseline, source event or capture coverage is insufficient to establish the result."] },
      { t: "h2", text: "Compare a change" },
      { t: "p", text: "Keep an evaluated result as the baseline, load the next recording and use the same reviewed criteria. The comparison shows changed findings. Changing a requirement changes the question; it does not demonstrate that a repair succeeded." },
      { t: "h2", text: "Export and persistence" },
      { t: "p", text: "Export the evidence to keep the criteria, evaluator version, findings and source references. Source hashes identify the supplied bytes; they do not authenticate a device. The component does not save cloud history. Export before closing the tab." },
    ],
    related: ["ai-security"],
  },
  {
    slug: "getting-started",
    group: "Getting started",
    title: "Getting started with Vraelis",
    summary: "Write one sentence about your deployed app, approve the plan, and read your first decision.",
    outcome: "You have run one check on your live app and read its answer.",
    limit: "Vraelis checks what a browser can reach on a public address. It does not read your code, your database or a device's firmware.",
    blocks: [
      { t: "p", text: "Vraelis checks whether a deployed web app does what someone says it does. You write one sentence about what should work, a person approves the plan Vraelis writes from it, and a real browser tries it on the live app. The answer is Verified, Failed or Blocked, with the evidence. This guide takes you from an empty account to that first answer." },
      { t: "h2", text: "1. Name the deployed app" },
      { t: "p", text: "Give Vraelis the public https address where the app runs: production, staging or a preview deployment. For a connected device, that is the web control panel or dashboard that runs it. Localhost and private addresses are refused before anything runs. You confirm ownership of the app before a check can start." },
      { t: "h2", text: "2. Write what should work" },
      { t: "p", text: "One sentence: what a user can do, and what should be true afterwards. \"A signed-in user can cancel their plan from Billing and then sees Cancelled\" is a good claim. \"Test the billing page\" is not, because it names no outcome." },
      // The panel, not the aircraft: Vraelis sees what the control panel shows (plan 0.3, Devices).
      { t: "p", text: "The same works for a connected device, through the web control panel that runs it: \"After an operator presses Return home, the panel shows Landed, and still does after a reload.\" Vraelis checks what the panel reports. Reading the device itself, its firmware, sensors or telemetry, is next and not built yet." },
      { t: "h2", text: "3. Approve the plan" },
      { t: "p", text: "Vraelis turns the sentence into requirements and the browser steps that would prove them, and shows you both. Nothing runs until a person approves that exact plan. If no check could prove the claim, Vraelis says so and charges nothing." },
      { t: "h2", text: "4. Read the answer" },
      { t: "p", text: "Verified means the claim held on the live app. Failed means it did not, with what was expected, what was observed, and a repair prompt. Blocked means no decision could be reached, so none is claimed. Every answer carries its steps, screenshots, console errors and failed requests." },
      { t: "note", label: "Four ways in", text: "The same check runs from the console, the CLI, CI through the API, and AI assistants over MCP. Start in whichever you already have open." },
    ],
    related: ["the-loop", "what-you-can-check", "cli", "ai-assistants"],
  },
  {
    slug: "the-loop",
    group: "Getting started",
    title: "Verify, approve, run, re-check",
    summary: "The whole loop, in the order it happens, in each of the ways to run it.",
    outcome: "You know every step between a claim and a trusted answer, and who takes each one.",
    limit: "No step can be skipped: nothing runs before a person approves the plan.",
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
        "CLI: `vraelis verify --url URL --claim \"...\" --wait` prints the approval link, waits for the approval, runs, and exits 0, 1 or 2. `vraelis recheck vrf_... --wait` runs the same plan after a fix.",
        "API: `POST /v1/verifications` returns `review_required` and an `approve_url`. After the approval, resubmit with `reviewed_plan_id` to start the run, read `GET /v1/verifications/{id}`, and re-check with `POST /v1/verifications/{id}/recheck`.",
        "AI assistants over MCP: `vraelis_verify`, then `vraelis_status` while the person approves and the run finishes, then `vraelis_recheck` after a fix.",
      ] },
      { t: "note", label: "Billing", text: "Every run is billed as one verification, a re-check included. A claim Vraelis refuses because no check could prove it costs nothing." },
    ],
    related: ["review", "recheck", "cli", "api"],
  },
  {
    slug: "what-you-can-check",
    group: "Getting started",
    title: "What you can check",
    summary: "Every kind of thing Vraelis is for, and whether it works today.",
    outcome: "You know whether Vraelis can check what you built, today.",
    limit: "A surface is listed as Live only after a real failing case ran end to end on it.",
    blocks: [
      { t: "p", text: "Vraelis is for anything people build and ship: websites, web and desktop apps, SDKs, and connected devices such as drones and robots. Today it checks what a real browser can reach. The list below says, for each kind, whether it works now." },
      { t: "surfaces" },
      { t: "h2", text: "Readiness is evidence, not certification" },
      { t: "p", text: "When readiness checks ship, each result will say which rule it was checked against, on what date, and whether a person still needs to look. That is evidence for your auditor or counsel. It is not a certification, and it is not legal advice." },
    ],
    related: ["getting-started", "the-loop"],
  },
  {
    slug: "ai-assistants",
    group: "Ways to run",
    title: "Connect an AI assistant",
    summary: "Let an assistant check its change on the live app over MCP, and hand you the approval.",
    outcome: "Your assistant can call Vraelis, and you know what it can and cannot do with it.",
    limit: "An assistant can ask for a check and read the answer. It cannot approve the plan.",
    blocks: [
      { t: "p", text: "An AI assistant that supports MCP can call Vraelis after it changes your web app. It gets three tools: `vraelis_verify` to ask for a check, `vraelis_status` to read where it is, and `vraelis_recheck` to run the same approved plan after a fix. No tool can approve a plan; the assistant hands you the link." },
      { t: "h2", text: "Set up with vraelis init" },
      { t: "code", label: "Install, sign in, and set up the assistants on this machine", text: "curl -fsS https://vraelis.com/install | sh      # macOS and Linux\nirm https://vraelis.com/install.ps1 | iex        # Windows PowerShell\n\nvraelis login\nvraelis init                 # every assistant found on this machine\nvraelis init claude codex    # or name them: claude, codex, gemini, copilot, cursor, trae, all" },
      { t: "p", text: "`vraelis init` writes the MCP setup for Claude Code, Codex, Gemini CLI, GitHub Copilot in VS Code and the Copilot CLI, and Cursor. For Trae it prints the JSON to paste under Settings > MCP > Add > Configure manually. It also adds a short rule to the project's AGENTS.md, verify before you say it's done, and to CLAUDE.md or GEMINI.md when those assistants are chosen and the file does not already import AGENTS.md. On Windows, use init rather than the manual lines: it registers node and the script path, because many assistants cannot launch the installer's vraelis.cmd." },
      // ONE H3 PER ASSISTANT, WITH THE IDS /agents LINKS TO (plan C /agents and /docs/ai-assistants). The ids are
      // fixed here rather than derived from the headings, so renaming an assistant cannot break a link.
      { t: "h2", text: "Set up each assistant by hand" },
      { t: "p", text: "Assistants on your machine run the local server, `vraelis mcp`, which the CLI provides. ChatGPT and Claude on the web cannot start a local process, so they connect to the hosted server at https://vraelis.com/mcp and sign in with OAuth. Allow creates an API key named after the connector, which you can revoke any time under Developers in the console." },
      { t: "h3", id: "claude-code", text: "Claude Code" },
      { t: "p", text: "The terminal and the VS Code extension share one configuration, so one command covers both." },
      { t: "code", label: "Run in a terminal", text: "claude mcp add --scope user vraelis -- vraelis mcp" },
      { t: "h3", id: "codex", text: "Codex" },
      { t: "p", text: "The CLI and the IDE extension share one configuration." },
      { t: "code", label: "Run in a terminal", text: "codex mcp add vraelis -- vraelis mcp" },
      { t: "h3", id: "gemini-cli", text: "Gemini CLI" },
      { t: "p", text: "One command." },
      { t: "code", label: "Run in a terminal", text: "gemini mcp add vraelis vraelis mcp" },
      { t: "h3", id: "copilot-in-vs-code", text: "GitHub Copilot in VS Code" },
      { t: "p", text: "Add this to your user or workspace `mcp.json`." },
      { t: "code", label: "JSON", text: JSON.stringify({ servers: { vraelis: { type: "stdio", command: "vraelis", args: ["mcp"] } } }, null, 2) },
      { t: "h3", id: "copilot-cli", text: "GitHub Copilot CLI" },
      { t: "p", text: "Add this to `~/.copilot/mcp-config.json`." },
      { t: "code", label: "JSON", text: JSON.stringify({ mcpServers: { vraelis: { type: "local", command: "vraelis", args: ["mcp"], tools: ["*"] } } }, null, 2) },
      { t: "h3", id: "cursor", text: "Cursor" },
      { t: "p", text: "Add this to `~/.cursor/mcp.json`." },
      { t: "code", label: "JSON", text: MCP_SERVERS },
      { t: "h3", id: "trae", text: "Trae" },
      { t: "p", text: "In Trae, open Settings > MCP > Add > Configure manually, and paste this." },
      { t: "code", label: "JSON", text: MCP_SERVERS },
      { t: "h3", id: "chatgpt", text: "ChatGPT" },
      { t: "p", text: "ChatGPT connects to the hosted server over the web. Turn on developer mode (Settings, Apps and Connectors, Advanced), add a connector with this URL, and choose OAuth. ChatGPT sends you to Vraelis to sign in and click Allow." },
      { t: "code", label: "Connector URL", text: "https://vraelis.com/mcp" },
      { t: "h3", id: "claude", text: "Claude (claude.ai and desktop)" },
      { t: "p", text: "Settings > Connectors > Add custom connector, with this URL. Claude sends you to Vraelis to sign in and click Allow." },
      { t: "code", label: "Connector URL", text: "https://vraelis.com/mcp" },
      { t: "h3", id: "any-mcp-client", text: "Any other MCP client" },
      { t: "p", text: "Run the local server over stdio, or connect to the hosted server over HTTP with your API key in an `x-api-key` header." },
      { t: "code", label: "Local or hosted", text: "stdio   vraelis mcp\nHTTP    https://vraelis.com/mcp   with header  x-api-key: <your key>" },
      { t: "note", label: "What no tool can do", text: "Approve a plan, re-check more than 24 hours after the approval or more than 10 times, or re-check on a different site. Every run, a re-check included, is one verification." },
    ],
    related: ["the-loop", "recheck", "cli"],
  },
  {
    slug: "cli",
    group: "Ways to run",
    title: "The command line",
    summary: "Install the vraelis CLI, check a claim from a terminal, and read the decision from its exit code.",
    outcome: "You can check a claim from a terminal or a script and act on its exit code.",
    limit: "It does not approve plans; a person approves from the link it prints.",
    blocks: [
      { t: "p", text: "The vraelis CLI calls the same API. verify prints the plan and the approval link, opens the link when a person is at the terminal, waits for the approval, runs the check and exits on the decision. In CI the exit code is what an if-statement reads." },
      { t: "h2", text: "Install and sign in" },
      { t: "code", label: "macOS and Linux, or Windows in PowerShell", text: CLI_INSTALL },
      { t: "p", text: "In CI and scripts, set `VRAELIS_API_KEY` instead of signing in. The environment takes precedence over a stored key, so a pipeline never uses a key someone left on the machine. [Create an API key](https://app.vraelis.com/developers)" },
      { t: "h2", text: "Check a claim" },
      { t: "code", label: "Verify, then re-check after a fix", text: CLI_VERIFY },
      { t: "h2", text: "Exit codes" },
      { t: "table", label: "Exit codes", head: ["Exit code", "What it means"], rows: CLI_EXITS },
      { t: "p", text: "The CLI collapses “blocked” and “could not run” into 2, because a gate should treat “I could not check” the same as “no verdict.” A hand-rolled gate that polls the API can split those out, exiting 3 when no decision is reached in the window." },
      { t: "h2", text: "Options" },
      { t: "table", label: "Options", head: ["Option", "What it does"], rows: [
        ["`--wait`", "Wait for the verdict. Without it the command prints the id and exits 0 immediately, which means started, not verified."],
        ["`--json`", "Emit one JSON object instead of human output. This is the mode for CI and for agents."],
        ["`--repair-prompt`", "On failure, print only the repair prompt, ready to pipe into a coding agent."],
        ["`--idempotency-key`", "Reuse a key so a retry returns the original verification instead of starting, and paying for, a second one."],
        ["`--timeout`", "How long `--wait` waits (for approval and for the decision) before giving up. Default 900 seconds."],
        ["`--no-open`", "Print the approval link without opening a browser."],
      ] },
      { t: "h2", text: "Other commands" },
      { t: "table", label: "Other commands", head: ["Command", "What it does"], rows: [
        ["`vraelis result VRF_ID`", "Show a verification's decision."],
        ["`vraelis init`", "Plug Vraelis into Claude Code, Codex, Gemini CLI, Copilot, Cursor or Trae, and tell them to verify before saying done."],
        ["`vraelis mcp`", "Run the MCP server the assistants talk to. They start it for you."],
        ["`vraelis status`", "Show which key is in use, where it came from, and whether it works."],
        ["`vraelis logout`", "Forget the stored key."],
      ] },
      { t: "h2", text: "With no person at the terminal" },
      { t: "p", text: "A CI job has no person at the terminal, and a key cannot approve a plan, so the first check of a claim waits on the link until someone approves it or `--timeout` runs out. Re-checks of that approved plan need no new approval within 24 hours of the approval, up to 10 times, on the same address. A new preview URL is a different address, so its first check waits for a person again." },
      { t: "note", label: "Not on npm yet", text: "The CLI installs from the script above, on macOS, Linux and Windows. Its npm package is prepared and not published." },
    ],
    related: ["ci", "api", "ai-assistants"],
  },
  {
    slug: "api",
    group: "Ways to run",
    title: "The API",
    summary: "Submit a claim, have a person approve the plan, start the run, read the decision and re-check after a fix, over HTTP.",
    outcome: "You can start a check from your own code and read the decision with its evidence.",
    limit: "An API key cannot approve a plan: every key gets 403 plan_requires_human and the link a person opens.",
    blocks: [
      { t: "p", text: "Authenticate with an API key, POST a deployment and a claim, send the `approve_url` to a person, resubmit with the approved plan id to start the run, then poll until a decision lands. After a fix, re-check the same plan. Base URL is https://vraelis.com." },
      { t: "h2", text: "Authenticate" },
      { t: "p", text: "Every request carries your key in the `x-api-key` header. Keys are created in the app, shown once, and stored only as a hash. Launching or re-checking needs a key with launch access, because it spends. [Create an API key](https://app.vraelis.com/developers)" },
      { t: "h2", text: "Submit the claim" },
      { t: "code", label: "Request", text: API_CREATE },
      { t: "p", text: "Returns `202` with `state: \"review_required\"`, the derived requirements, the plan to approve, and the `approve_url` a person opens. No run started, nothing charged, and no verification id yet. The response also carries `contract_id` and `contract_version`." },
      { t: "code", label: "Response", text: API_CREATE_RES },
      { t: "h2", text: "Approve, then start the run" },
      { t: "p", text: "Only a signed-in person approves a plan, with one click at the `approve_url`. The approval is its own recorded event: who approved which plan, and when. Every API key is refused with `403 plan_requires_human` and the same link, so the tool that asked for the check can never sign off on it. The run then executes exactly the approved plan, with no re-derivation." },
      { t: "code", label: "Approve, read the plan, then run it", text: API_APPROVE_RUN },
      { t: "h2", text: "Read the decision" },
      { t: "p", text: "Poll `GET /v1/verifications/{id}`. While running, the body is just the id and state. Once complete, `decision` is one of `verified`, `failed`, or `blocked`. `recheck_of` names the verification a re-check repeated, or is null." },
      { t: "code", label: "Request", text: API_READ },
      { t: "code", label: "Response", text: API_READ_RES },
      { t: "h2", text: "Re-check after a fix" },
      { t: "p", text: "After a Failed, deploy the fix and call `POST /v1/verifications/{id}/recheck`. It runs every journey of the same approved plan again and returns a new verification id; the earlier record is never touched. No new approval is needed within 24 hours of the approval, for at most 10 re-checks, on the same scheme and host. An optional `deployment_url` may name another path on that same site. Past those limits the API answers `recheck_window_closed` or `recheck_limit_reached`, and you start a new verification. Each re-check is billed as one verification." },
      { t: "code", label: "Request", text: API_RECHECK },
      { t: "code", label: "Response", text: API_RECHECK_RES },
      { t: "h2", text: "Ask before you commit" },
      { t: "p", text: "A dry run derives the plan, checks it can actually prove the claim, and charges nothing. When it can, it mints the same plan a person approves in step 2 above, with its `approve_url`. When it cannot, it says so with a repair prompt, and there is nothing to approve." },
      { t: "code", label: "Request", text: API_DRY },
      { t: "code", label: "Response", text: API_DRY_RES },
      { t: "h2", text: "Requirements" },
      { t: "p", text: "Every response echoes the requirements Vraelis derived from your claim, and states whether a person approved them in `human_reviewed`. A model reading a claim can misread it; the requirements are what the person is approving, and they are how you catch a confidently wrong verdict before you trust it." },
      { t: "h2", text: "Idempotency" },
      { t: "p", text: "Send an `idempotency-key` header. A retry with the same key, deployment, and claim replays the original verification instead of starting and paying for a second one. The same key with a different claim is refused, so a changed request can never be answered with an earlier run." },
      { t: "code", label: "The same key with a different claim", text: API_IDEM_ERR },
      { t: "h2", text: "Errors" },
      { t: "p", text: "Errors share one envelope: `{ error: { code, message, request_id } }`, with the id also on the `X-Request-Id` header. A claim that cannot be proven returns `claim_not_provable` (422) with a repair prompt, and nothing is charged." },
      { t: "h2", text: "What has shipped" },
      { t: "p", text: "We will not document an endpoint we have not shipped. These are the ones that answer today." },
      { t: "ul", items: [
        "`POST /api/v1/verifications`, create, dry-run, or run an approved plan",
        "`GET /api/v1/verifications/plans/{id}`, the plan, its approval state, and `approve_url` while it is pending",
        "`GET /api/v1/verifications/{id}`, decision, evidence, repair prompt, `recheck_of`",
        "`POST /api/v1/verifications/{id}/recheck`, the same approved plan after a fix",
        "`POST /api/v1/verifications/plans/{id}/approve`, for a signed-in person only; every API key gets `403 plan_requires_human`",
        "The vraelis CLI: `verify`, `recheck`, `result`, `init`, `mcp`",
        "The MCP server, local (`vraelis mcp`) and hosted (`https://vraelis.com/mcp`)",
        "Signed `verification.completed` webhooks, and Slack delivery",
      ] },
      { t: "note", label: "SDK", text: "A TypeScript SDK, @vraelis/sdk 0.3.0, wraps these calls as prepare, getPlan, waitForApproval, run, waitForResult, recheck and get. It is built and tested in the repository and is not yet published to npm, so it cannot be installed today." },
    ],
    related: ["cli", "ci", "webhooks"],
  },
  {
    slug: "ci",
    group: "Ways to run",
    title: "Gate a release in CI",
    summary: "Run a check from a CI job and ship only when the decision is verified.",
    outcome: "A release goes out only when the claim held on the live app.",
    limit: "A CI job cannot approve a plan. The first check of a claim waits until a person approves it at the link.",
    blocks: [
      { t: "p", text: "Gate on the decision, never the run state. A finished run is not a pass. In CI the exit code is what an if-statement reads." },
      { t: "h2", text: "With the CLI" },
      { t: "code", label: "A CI step", text: CI_STEP },
      { t: "table", label: "Exit codes", head: ["Exit code", "What it means"], rows: CLI_EXITS },
      { t: "p", text: "The job needs `VRAELIS_API_KEY` in its environment, from a key with launch access, and Node 18 or newer. The CLI does not open a browser in CI: the approval link goes to the log. [Create an API key](https://app.vraelis.com/developers)" },
      { t: "h2", text: "The first check of a claim" },
      { t: "p", text: "A CI job has no person at the terminal, and a key cannot approve a plan, so the first check of a claim waits on the link until someone approves it or `--timeout` runs out. Re-checks of that approved plan need no new approval within 24 hours of the approval, up to 10 times, on the same address. A new preview URL is a different address, so its first check waits for a person again. The gate below splits the two cases instead." },
      { t: "h2", text: "A gate that calls the API" },
      { t: "p", text: "The CLI collapses “blocked” and “could not run” into 2, because a gate should treat “I could not check” the same as “no verdict.” A hand-rolled gate that polls the API can split those out, exiting 3 when no decision is reached in the window." },
      { t: "code", label: "gate.mjs", text: CI_GATE },
      { t: "table", label: "The gate's exit codes", head: ["Exit code", "What it means"], rows: [
        ["`0`", "verified"],
        ["`1`", "failed"],
        ["`2`", "blocked"],
        ["`3`", "no decision reached"],
        ["`4`", "the plan still needs a person to approve it"],
      ] },
      { t: "table", label: "What the gate reads", head: ["Variable", "What it holds"], rows: [
        ["`VRAELIS_API_KEY`", "An API key with launch access."],
        ["`PREVIEW_URL`", "The deployment to check."],
        ["`VRAELIS_CLAIM`", "The sentence that has to hold."],
        ["`VRAELIS_REVIEWED_PLAN_ID`", "The approved plan's id. Unset on the first run, so the gate prints the approval link and exits 4."],
      ] },
      { t: "note", label: "Honest boundary", text: "Nothing watches your deployments. A check runs when a person, a CI job or an AI assistant starts one, so put it before the release step." },
    ],
    related: ["cli", "api", "recheck"],
  },
  {
    slug: "webhooks",
    group: "Ways to run",
    title: "Webhooks",
    summary: "Get a signed verification.completed event when a verification finalizes, and check its signature.",
    outcome: "Your systems get each decision as it lands, and can check it came from Vraelis.",
    limit: "A delivery carries the decision, counts, ids and a link to the evidence, never a session id, token, credential or signed artifact URL.",
    blocks: [
      { t: "p", text: "Connect an endpoint and Vraelis POSTs a signed `verification.completed` event the moment a verification finalizes. It carries only owner-safe facts: the decision, flow counts, ids, and a link to the evidence. Never a session id, token, credential, or signed artifact URL." },
      // TWO PLACES SEND THE EVENT, and both fire on every finished verification (dispatchWebhooks in
      // worker/preflight/run-store-postgres.ts): the account's endpoints under Developers (lib/v-webhooks.ts:
      // a whsec_ secret per endpoint, retries, x-vraelis-delivery) and a system's Webhook or Slack connections
      // (lib/preflight/webhook-dispatch.ts: Slack formatting, no retries, signed with a key only Vraelis
      // holds). /developers described them as one; every sentence below is read off those two files.
      { t: "h2", text: "Add an endpoint" },
      { t: "p", text: "Add it under Developers in the console. The endpoint gets its own signing secret, which starts with `whsec_`. The console shows it when you add the endpoint, Reveal shows it again, and Rotate replaces it. Send test posts a sample event marked `\"test_event\": true`. [Open Developers in the console](https://app.vraelis.com/developers#webhooks)" },
      { t: "ul", items: [
        "The address must be https on port 443, on a public host. Localhost and private addresses are refused.",
        "A delivery that times out, or gets a 5xx or 429 answer, is tried again, up to five attempts in all. Deliveries lists the recent ones, and Retry sends a failed one again.",
        "An account can have up to 10 endpoints. Every finished verification goes to each one that is enabled.",
      ] },
      { t: "h2", text: "The event" },
      { t: "p", text: "One event, `verification.completed`, delivered with the headers `x-vraelis-event`, `x-vraelis-timestamp`, and `x-vraelis-signature`." },
      { t: "p", text: "Each delivery also carries an `x-vraelis-delivery` header, with the same id as `delivery_id` in the body. A retry keeps that id, so a receiver can drop a repeat." },
      { t: "code", label: "Example payload", text: HOOK_PAYLOAD },
      { t: "h2", text: "Verify a delivery" },
      { t: "p", text: "The signature is an HMAC over the raw body prefixed with the timestamp, so recompute over the exact bytes you received before trusting the payload." },
      { t: "p", text: "Key the HMAC with the endpoint's signing secret, and keep the secret on your server, for example in an environment variable." },
      { t: "code", label: "Node.js", text: HOOK_VERIFY },
      { t: "h2", text: "Slack, and webhooks on one system" },
      { t: "p", text: "A system can also send the event itself: add a Webhook or a Slack connection in its settings, under Connections. A Slack incoming webhook gets the event as a formatted message in your channel instead of raw JSON, with the decision, flows passed, and a link to the evidence." },
      { t: "p", text: "These deliveries carry no `delivery_id` and are not retried, and a Webhook connection has no signing secret of its own. When a receiver has to check where a delivery came from, add its endpoint under Developers." },
    ],
    related: ["api", "ci", "completion"],
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
    limit: "An approval covers one plan on one site. It does not approve changes to that plan.",
    blocks: [
      { t: "p", text: "Before the first run of a claim, a person approves the plan Vraelis wrote from it: the requirements it will judge and the browser steps that will prove them. The approval is its own recorded event, saying who approved which plan and when. The run then executes exactly that plan." },
      { t: "h2", text: "Where the approval happens" },
      { t: "ul", items: [
        "In the console, under Review.",
        "At the approval link a check returns: `approve_url` in the API, the link the CLI prints and opens, and the link an AI assistant hands you. It opens `app.vraelis.com/review/` followed by the plan id.",
        "In ChatGPT and Claude, the Vraelis card carries a Review and approve button that opens the same page.",
      ] },
      { t: "h2", text: "Why an API key cannot approve" },
      { t: "p", text: "`POST /v1/verifications/plans/{id}/approve` refuses every API key with `403 plan_requires_human` and returns the `approve_url`, so the caller can hand it to a person. `GET /v1/verifications/plans/{id}` reads the plan and its `approval_state`, and carries `approve_url` while the plan is still pending." },
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
    limit: "The record shows what the browser saw. It does not include a video or a Playwright trace.",
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
    limit: "Verified means the approved plan held on that run. It is not a promise about the next deploy.",
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
    limit: "A finding says what the live app did. It does not say which line of code caused it.",
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
    limit: "Vraelis writes the prompt and checks the fix. It never edits your code.",
    blocks: [
      { t: "p", text: "When a run fails, Vraelis writes a repair prompt: what should have happened, what happened instead, how to reproduce it, and the evidence. It is written so a person or a coding agent can act on it directly." },
      { t: "h2", text: "The division of labor" },
      { t: "p", text: "Whoever fixes it diagnoses the cause and makes the change. Vraelis does not edit code. Once the fix is deployed, a re-check runs the same approved plan again as its own run, and an earlier record is never overwritten." },
      { t: "note", label: "Where the prompt goes", text: "Back to whoever asked: in the answer an AI assistant gets over MCP, in the CLI's output (`--repair-prompt` prints only the prompt), in the API response, and on the run report. A re-check is started by a person, a CI job or an assistant. Nothing re-checks on its own." },
      { t: "note", label: "Preserved history", text: "Every result is kept. A later Verified does not erase an earlier Failed." },
    ],
    related: ["recheck", "completion"],
  },
  {
    slug: "recheck",
    group: "The check",
    title: "Re-checks",
    summary: "Run the same approved plan again after a fix, within its limits, without a new approval.",
    outcome: "You can prove a fix on the live app without asking for approval again.",
    limit: "A re-check runs the plan that was approved. To check something new, start a new verification.",
    blocks: [
      { t: "p", text: "A re-check runs every journey of an approved plan again, against the live app, after a fix has been deployed. It returns a new verification id and points back at the run it repeats; the earlier record is never touched. It runs all the journeys, not only the failed ones, because a run over a subset can only prove a repair, not the whole claim." },
      { t: "h2", text: "When no new approval is needed" },
      { t: "ul", items: [
        "Within 24 hours of the person's approval of the plan.",
        "For at most 10 re-checks of that approval.",
        "On the same site: the same scheme and host. A different path on that site is allowed.",
      ] },
      { t: "p", text: "Outside those limits the API answers `recheck_window_closed` or `recheck_limit_reached`. Start a new verification and a person approves its plan again." },
      { t: "h2", text: "How to start one" },
      { t: "code", label: "API, CLI and MCP", text: "POST /v1/verifications/vrf_9c1e0f2a41/recheck        # optional body: { \"deployment_url\": \"...\" }\n\nvraelis recheck vrf_9c1e0f2a41 --wait\n\nvraelis_recheck  { \"verification_id\": \"vrf_9c1e0f2a41\" }" },
      { t: "p", text: "The response carries `recheck_of`, `rechecks_left` and `recheck_window_ends_at`, and `GET /v1/verifications/{id}` reports `recheck_of` on every run. A re-check needs a key with launch access, because it spends." },
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
    limit: "A system's label is its latest run, not a measure of everything the app does.",
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
    limit: "A guarantee is not checked on a schedule. A person, a CI job or an assistant starts each run.",
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
    limit: "History is kept and shown. It is never used to judge the next run.",
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
/** The page's h2 headings, in order (kept for callers that want the flat list). */
export function docHeadings(doc: Doc) {
  return doc.blocks.filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2").map((b) => b.text);
}

/** The id an h2 gets from its words. */
export const dslug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type TocItem = { id: string; text: string; level: 2 | 3 };
/** "On this page": every h2 (id from its words) and every h3 (its own fixed id), in reading order. */
export function docOutline(doc: Doc): TocItem[] {
  const out: TocItem[] = [];
  for (const b of doc.blocks) {
    if (b.t === "h2") out.push({ id: dslug(b.text), text: b.text, level: 2 });
    else if (b.t === "h3") out.push({ id: b.id, text: b.text, level: 3 });
  }
  return out;
}

// ── INLINE MARKUP ────────────────────────────────────────────────────────────────────────────────────────
export type Inline = { k: "text"; s: string } | { k: "code"; s: string } | { k: "link"; s: string; href: string };
const INLINE_RE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
/** Splits a line of docs text into plain text, `code` and [label](href) links. */
export function inline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ k: "text", s: text.slice(last, at) });
    out.push(m[1] !== undefined ? { k: "code", s: m[1] } : { k: "link", s: m[2], href: m[3] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ k: "text", s: text.slice(last) });
  return out;
}

// THE CONSOLE'S FIRST PATH SEGMENTS (plan 0.5, reserved). On vraelis.com these answer with a redirect to
// app.vraelis.com, and a prefetch that crosses origins is blocked by CORS: two console errors per link and
// nothing fetched. v6ShouldPrefetch covers /app and /checkout; lib/ is not edited, so the docs check the
// whole list here.
const CONSOLE_FIRST = /^\/(systems|verifications|guarantees|review|records|usage|applications|passes|issues|repairs|deployments|activity|team|organization|api|connections|plans|credits|billing|account|checkout|limits|cli|admin|new|app)(?:[/?#]|$)/;
/** The prefetch prop for a docs link: false for a console path, otherwise left to Next. Takes a clean path
 *  ("/app") or one with V6_BASE in front. */
export function docPrefetch(href: string): false | undefined {
  const path = V6_BASE && href.startsWith(V6_BASE + "/") ? href.slice(V6_BASE.length) : href;
  if (!path.startsWith("/")) return undefined;
  return v6ShouldPrefetch(path) && !CONSOLE_FIRST.test(path) ? undefined : false;
}

const SITE = "https://vraelis.com";
/** Inline markup as Markdown: code stays in backticks, and a site link becomes absolute, because the
 *  Markdown is read away from the site (Copy page, /llms-full.txt). */
function inlineMarkdown(text: string): string {
  return inline(text).map((x) => (x.k === "code" ? `\`${x.s}\`` : x.k === "link" ? `[${x.s}](${x.href.startsWith("/") ? SITE + x.href : x.href})` : x.s)).join("");
}
const cell = (s: string) => inlineMarkdown(s).replace(/\|/g, "\\|");

/** The page as Markdown, for the Copy as Markdown button and for AI assistants that read docs. Figures
 *  become their alt text and numbered labels, so nothing a picture says is lost in text. */
export function docToMarkdown(doc: Doc, surfaces: { name: string; brief: string; tier: string }[] = []): string {
  const out: string[] = [`# ${doc.title}`, "", doc.summary, "", `Outcome: ${doc.outcome}`];
  if (doc.limit) out.push("", `What it does not do: ${doc.limit}`);
  for (const b of doc.blocks) {
    out.push("");
    switch (b.t) {
      case "p": out.push(inlineMarkdown(b.text)); break;
      case "h2": out.push(`## ${b.text}`); break;
      case "h3": out.push(`### ${b.text}`); break;
      case "ul": out.push(...b.items.map((i) => `- ${inlineMarkdown(i)}`)); break;
      case "steps": out.push(...b.items.map((i, n) => `${n + 1}. ${inlineMarkdown(i)}`)); break;
      case "note": out.push(`> **${b.label}.** ${inlineMarkdown(b.text)}`); break;
      case "code": out.push(`${b.label}:`, "", "```", b.text, "```"); break;
      case "table": out.push(`| ${b.head.map(cell).join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`, ...b.rows.map((r) => `| ${r.map(cell).join(" | ")} |`)); break;
      case "figure": out.push(`[Screenshot: ${b.alt}]`, ...(b.marks ?? []).map((m, n) => `${n + 1}. ${m.label}`)); break;
      case "surfaces": out.push(...surfaces.map((x) => `- **${x.name}** (${x.tier}): ${x.brief}`)); break;
    }
  }
  return out.join("\n") + "\n";
}

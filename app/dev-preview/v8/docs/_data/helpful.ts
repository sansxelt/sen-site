import { OBSERVATION_2, POLICY } from "../../_content/evidence";
import { CONTOUR } from "../../_kit/site";
import type { Page } from "./types";

// THE PAGES AN ENGINEER WORKS FROM (founder, 2026-10-12: "ensure docs are actually helpful, look through Palantir,
// Scale and Anduril"). What their docs do and ours did not: define every object in one sentence and say how the objects
// relate (Scale's Key Concepts, Anduril's data model), write the data flow out (Palantir's Apollo overview), name every
// state with its cause and what to check (Apollo's statuses), give the record field by field from a real example,
// state the hard numbers, walk one real example end to end, and send restricted parts to a named path instead of
// hinting at them (Anduril's "work with your representative"). Every fact below is already published on the site or
// in the recorded trace; nothing adds a capability, an installation step or a claim.

const UPDATED = "2026-10-12";

/* ── Get started > Key concepts ─────────────────────────────────────────────────────────────────── */

const KEY_CONCEPTS: Page = {
  tab: "vraelis", group: "Get started", slug: "key-concepts", title: "Key concepts",
  description: `The objects ${CONTOUR.name} works with, one sentence each, how they relate, and one example that runs through all of them.`,
  lead: "Ten words carry the whole product. Each gets one sentence, then the example shows them working together.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "The objects" },
    { t: "table", label: "Key concepts", head: ["Concept", "What it is", "Where it is defined"], rows: [
      ["Release", "One version of a model and its configuration, published for approval. The example has two: `cpu-1` and `cpu-2`.", "[Release identity](/docs/release-identity)"],
      ["Release identity", "The digests that name a release exactly: model, configuration, release and receipt. Preprocessing identity is proposed, not recorded.", "[Release identity](/docs/release-identity)"],
      ["Approval", "A signed decision that one release may run in one destination, under one policy, within an age limit.", "[Approval binding](/docs/approval-binding)"],
      ["Policy", "The runtime a destination requires: the exact ONNX Runtime version and execution providers, and who may publish, deploy and approve.", "[Runtime integration](/docs/runtime-integration)"],
      ["Destination", "Where an approved release may run: an environment and a resource. In the experiment, `non-actuating-lab` and `onnx-cpu`.", "[Approval binding](/docs/approval-binding)"],
      ["Runtime", "The process that loads and serves the model. In the experiment, a managed ONNX Runtime session on CPU.", "[Runtime integration](/docs/runtime-integration)"],
      ["Desired", "The approved release the runtime should be running.", "[Observation record](/docs/observation-record)"],
      ["Loaded", "What the runtime reports it is actually running. A worker self-report, not attestation.", "[Observation record](/docs/observation-record)"],
      ["Observation", "One comparison of desired with loaded, with a status: matched, pending or unknown.", "[States and codes](/docs/states-and-codes)"],
      ["Trace", "The ordered file of observations a run produces. The evidence app reads it; it never changes it.", "[Evidence and observations](/docs/evidence-and-observations)"],
    ] },
    { t: "h2", text: "How they relate" },
    { t: "ul", items: [
      "A release has exactly one identity. Change any byte of the model or configuration and the identity changes.",
      "An approval names one release, one destination and one policy. It does not approve a model in general.",
      "A runtime loads a release only if its own version and execution providers satisfy the policy the approval names.",
      "Every observation pairs one desired release with one loaded report, or with a reason why there is no report.",
      "A trace holds observations in the order they were recorded. Nothing is dropped, including the ones that confirm nothing.",
    ] },
    { t: "h2", text: "The example, all the way through" },
    { t: "steps", items: [
      "`cpu-1` is published and approved for `non-actuating-lab / onnx-cpu`. The runtime loads it and reports it. Observation 01: matched.",
      "`cpu-2` is published and approved. The runtime is in baseline mode, so it keeps serving `cpu-1`. Observation 02: pending (Reload pending).",
      "An explicit reload loads `cpu-2`, and the runtime reports it. Observation 03: matched.",
      "The worker stops. `cpu-2` stays approved, but nothing reports what is loaded. Observation 04: unknown, reason `RUNTIME_UNAVAILABLE`.",
    ] },
    { t: "note", label: "Read this first", text: "Everything here comes from one captured run of a synthetic ONNX CPU experiment. The loaded side is what the worker says about itself; Vraelis does not claim hardware attestation." },
    { t: "cards", items: [
      { to: "/docs/architecture", title: "Architecture", line: "Who does what, and where each piece of evidence comes from." },
      { to: "/docs/walkthrough", title: "Walkthrough", line: "The same four observations, screen by screen." },
    ] },
  ],
};

/* ── Products > Architecture ────────────────────────────────────────────────────────────────────── */

const ARCHITECTURE: Page = {
  tab: "products", section: CONTOUR.name, group: "", slug: "architecture", title: "Architecture and data flow", nav: "Architecture",
  description: `The parts of the ${CONTOUR.name} reference experiment, who does what, and how evidence moves from an approval to the evidence app.`,
  lead: "Four roles, one policy, one runtime and one read-only app. This is how the pieces of the reference experiment fit together.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Roles" },
    { t: "table", label: "Roles in the policy", head: ["Role", "What it does"], rows: [
      ["Publisher", "Publishes a release: the model and configuration, named by digest."],
      ["Approver", "Signs the approval that binds one release to one destination, policy and age limit."],
      ["Deployer", "Delivers the approved release to the destination's runtime."],
      ["Reviewer", "Reads the evidence afterwards in the read-only evidence app. Not a role in the policy; anyone with the trace."],
    ] },
    { t: "p", text: "The policy names who may publish, deploy and approve (`publishers`, `deployers`, `approvers`). In the captured run they are the placeholder principals `publisher`, `deployer` and `approver`." },
    { t: "h2", text: "The data flow" },
    { t: "steps", items: [
      "Publish. The release is written to the experiment's local release store, whose signatures the experiment checks.",
      "Approve. The approval names the release, the destination (`non-actuating-lab / onnx-cpu`), the policy (`cpu-lab`, version 1) and an age limit of 60 seconds.",
      "Load. Before it serves, the runtime checks the policy: ONNX Runtime exactly 1.23.2, execution providers exactly `CPUExecutionProvider`. A mismatch is refused.",
      "Report. The worker reports what its session loaded: the release's identity and its own runtime (ONNX Runtime version, execution providers, Python version).",
      "Record. Each report is compared with the approved release and recorded as an observation in the trace, in order.",
      "Review. The evidence app opens the trace read-only, checks its structure and consistency, and shows each observation with its source JSON. It does not check signatures.",
    ] },
    { t: "workflow" },
    { t: "h2", text: "What the architecture is not" },
    { t: "ul", items: [
      "Not a deployment tool. It does not decide what runs where; it records what was approved and what is reported.",
      "The evidence app is read-only and never changes a runtime. The private runtime adapter can prepare and activate sessions: approved-session mode waits for an explicit reload, while reconcile mode synchronizes the desired release before inference.",
      "Not attestation. The loaded identity is the worker's own report. The host and worker are trusted in the experiment.",
      "Not live. The evidence app reads a recorded trace; it does not watch a running system.",
    ] },
    { t: "note", label: "Where Python sits", text: "The worker reports its Python version (3.12.14 in the captured run), but Python is not part of the signed policy. The app labels it recorded only." },
    { t: "cards", items: [
      { to: "/docs/runtime-integration", title: "Runtime integration and policy", line: "The policy fields, and how a runtime is checked." },
      { to: "/docs/observation-record", title: "Observation record", line: "Every field of an observation, from the real trace." },
    ] },
  ],
};

/* ── Products > Guides ──────────────────────────────────────────────────────────────────────────── */

const WALKTHROUGH: Page = {
  tab: "products", section: CONTOUR.name, group: "Guides", slug: "walkthrough", title: "Walkthrough: one release, four observations", nav: "Walkthrough",
  description: "Follow the captured run from the first approved release to the moment the runtime stops reporting, with the evidence app's screens and what each one tells you.",
  lead: "One captured run, 10 October 2026, in the order it happened. Each step shows what the evidence app displays and what a reviewer can conclude from it.",
  updated: UPDATED,
  blocks: [
    { t: "note", label: "Before you begin", text: "Nothing to install: this follows the recorded trace. If a word is new, [Key concepts](/docs/key-concepts) defines it in one sentence." },
    { t: "h2", text: "1. The approved release is loaded", id: "loaded" },
    { t: "p", text: "`cpu-1` is approved and the runtime reports `cpu-1`. Every identity field matches, and the reported runtime satisfies the policy. Status `matched`." },
    { t: "capture", name: "app-destination-loaded" },
    { t: "p", text: "What you can conclude: the release the worker says it is running is the one that was approved. What you cannot: that the host is honest, or anything about how the model behaves." },
    { t: "h2", text: "2. A new release is approved but not yet loaded", id: "pending" },
    { t: "p", text: "`cpu-2` is approved. The runtime is in baseline mode, so it keeps serving `cpu-1` until an explicit reload. Status `pending`, shown as Reload pending." },
    { t: "capture", name: "crop-pair-pending" },
    { t: "p", text: "What you can conclude: the approval and the running release differ, and the record says exactly which fields differ. This is an approved session's baseline, not an unauthorized deployment." },
    { t: "h2", text: "3. The reload completes", id: "reloaded" },
    { t: "p", text: "After the explicit reload the runtime reports `cpu-2`, and every field matches the approval. Status `matched` again." },
    { t: "capture", name: "crop-pair-reloaded" },
    { t: "h2", text: "4. The runtime stops reporting", id: "unavailable" },
    { t: "p", text: "The worker stops. `cpu-2` stays approved, and nothing reports what is loaded. Status `unknown`, reason `RUNTIME_UNAVAILABLE`, shown as Evidence unavailable." },
    { t: "capture", name: "app-destination-unavailable" },
    { t: "p", text: "What you can conclude: the evidence has a gap at this point, and the record says so. Missing evidence is not a different release; it is no evidence." },
    { t: "h2", text: "What you have seen" },
    { t: "ul", items: [
      "Approved and loaded are recorded separately, so a difference is visible field by field.",
      "A pending reload is recorded as a state, not hidden or treated as a failure.",
      "A gap in reporting is recorded as unavailable evidence with a reason code.",
    ] },
    { t: "cards", items: [
      { to: "/docs/review-an-observation", title: "Review an observation", line: "A checklist for reading any observation." },
      { to: "/docs/observation-02", title: "Observation 02 in full", line: "The source JSON of the pending observation." },
    ] },
  ],
};

const REVIEW: Page = {
  tab: "products", section: CONTOUR.name, group: "Guides", slug: "review-an-observation", title: "Review an observation", nav: "Review an observation",
  description: "How a reviewer reads one observation: what to check, in what order, and what each state means for the release.",
  lead: "Five checks, in order. Each one says what to look at in the evidence app and what the answer means.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "The checks" },
    { t: "steps", items: [
      "Status. `matched`, `pending` or `unknown`. It tells you which of the next checks matter.",
      "Desired. Which release was approved: its id, generation and the four digests (model, configuration, release, receipt).",
      "Loaded. Which release the runtime reports, field by field beside the desired one. Any differing digest is marked.",
      "Runtime. Whether the reported ONNX Runtime version and execution providers satisfy the policy. Python is recorded only.",
      "Provenance. Where the observation came from (the worker's self-report), when it was received, and its reason code if there is one.",
    ] },
    { t: "capture", name: "crop-observation-unavailable", caption: "Observation 04 in the evidence app: cpu-2 approved, no loaded report, no session, reason code RUNTIME_UNAVAILABLE. A self-report from the managed ONNX session, not independent attestation." },
    { t: "h2", text: "What each state means" },
    { t: "table", label: "States", head: ["State", "Typical cause", "What it tells a reviewer", "What to check next"], rows: [
      ["Matched (`matched`)", "The approved release is loaded and the runtime satisfies the policy.", "The worker reports running exactly what was approved.", "Nothing for this observation. The claim rests on the worker's self-report."],
      ["Reload pending (`pending`)", "A new release was approved while the runtime keeps its loaded baseline.", "Approved and running differ, intentionally, until an explicit reload.", "Whether a reload is expected, and the next observation after it."],
      ["Evidence unavailable (`unknown`)", "No loaded report, for example `RUNTIME_UNAVAILABLE` when the worker stopped.", "There is no evidence of what is loaded at this point.", "Why reporting stopped, and the first observation after it resumes."],
    ] },
    { t: "note", label: "What no state tells you", text: "How the model behaves, whether the host is honest, or anything about machines outside the experiment. See [Limits](/docs/limits)." },
    { t: "cards", items: [
      { to: "/docs/states-and-codes", title: "States and codes", line: "Every state and code the trace and the app use." },
      { to: "/docs/evidence-app", title: "The evidence app", line: "Its screens, and the checks it runs when it opens a trace." },
    ] },
  ],
};

const EVALUATE: Page = {
  tab: "products", section: CONTOUR.name, group: "Guides", slug: "evaluate-contour", title: `Evaluate ${CONTOUR.name} for your team`, nav: "Evaluate for your team",
  description: `What to prepare before talking to Vraelis about ${CONTOUR.name}, what Vraelis will and will not ask for, and how access works while it is in private development.`,
  lead: `${CONTOUR.name} is not for public use. If your team ships model updates into systems someone else operates, this is how to start a useful conversation.`,
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Is it for you?" },
    { t: "ul", items: [
      "You release models, or updates to them, into systems another team or organization operates.",
      "You need to show what was approved, for where, and what actually loaded.",
      "You are a release, platform or security engineer at a supplier or system integrator.",
    ] },
    { t: "h2", text: "What to prepare" },
    { t: "steps", items: [
      "The models you release and how often they change.",
      "The systems that run them: runtimes, hardware class, connectivity (connected, intermittent or offline).",
      "How a release is approved today, and by whom.",
      "Which evidence you would need afterwards, and who reads it.",
    ] },
    { t: "h2", text: "What Vraelis will never ask for" },
    { t: "ul", items: [
      "Credentials, keys or access to your systems.",
      "Classified material, restricted technical data or sensitive operational information.",
      "Customer data that you do not have permission to share.",
    ] },
    { t: "h2", text: "How access works" },
    { t: "p", text: "There is no self-service account, public API or download. Work with Vraelis directly: describe your release path through the contact form, and a person at Vraelis replies. A conversation does not grant access, and Vraelis does not take inquiries from China, including Hong Kong and Macao." },
    { t: "cards", items: [
      { to: "/contact?topic=contour", title: "Join us", line: "Send your release path and requirements." },
      { to: "/docs/limits", title: "Limits", line: "What exists today, and what does not." },
    ] },
  ],
};

/* ── Products > Reference ───────────────────────────────────────────────────────────────────────── */

const RECORD: Page = {
  tab: "products", section: CONTOUR.name, group: "Reference", slug: "observation-record", title: "Observation record", nav: "Observation record",
  description: "Every field of an observation in the trace, its type and what it means, from the recorded observations.",
  lead: "Field by field, from the recorded trace. The examples are the captured values from observation 02 and observation 04.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Top level" },
    { t: "table", label: "Event fields", head: ["Field", "Type", "Meaning", "Example"], rows: [
      ["`id`", "number", "A positive integer assigned by the capture harness. File order supplies the sequence; the viewer does not enforce unique or consecutive IDs.", "`2`"],
      ["`title`", "string", "A short name for what happened.", "`Update awaiting reload`"],
      ["`action`", "string", "What was done just before this observation.", "`Approved cpu-2. ...`"],
      ["`receivedAt`", "string, ISO 8601 with zone", "When the observation was received. The app refuses a timestamp without an explicit zone.", "`2026-10-10T07:41:29.613Z`"],
      ["`observation`", "object", "The comparison itself, below.", ""],
    ] },
    { t: "h2", text: "observation" },
    { t: "table", label: "Observation fields", head: ["Field", "Type", "Meaning", "Example"], rows: [
      ["`scope`", "string", "Where the loaded report comes from.", "`managed-onnx-session-self-report`"],
      ["`status`", "`matched`, `pending` or `unknown`", "The result of the comparison. See [States and codes](/docs/states-and-codes).", "`pending`"],
      ["`code`", "optional string", "A diagnostic reason code. The captured run uses it for unavailable evidence; a pending observation can also carry a rejected-reload reason.", "`RUNTIME_UNAVAILABLE`"],
      ["`desired`", "object", "The approved release.", ""],
      ["`loaded`", "object or `null`", "What the runtime reports it loaded. `null` when there is no report.", ""],
      ["`loadedEvidence`", "string, only when `loaded` is `null`", "Says the loaded side is missing.", "`unavailable`"],
    ] },
    { t: "h2", text: "desired, and loaded.metadata" },
    { t: "p", text: "Both carry the same identity fields, so they can be compared one by one." },
    { t: "table", label: "Identity fields", head: ["Field", "Meaning"], rows: [
      ["`releaseId`", "The release's name, such as `cpu-2`."],
      ["`generation`", "Its generation number: `cpu-1` is 1, `cpu-2` is 2."],
      ["`modelSha256`", "SHA-256 digest of the model."],
      ["`configurationSha256`", "SHA-256 digest of the configuration. The same in `cpu-1` and `cpu-2` in the captured run."],
      ["`releaseSha256`", "SHA-256 digest of the release."],
      ["`receiptSha256`", "SHA-256 digest of the receipt recorded for the release."],
    ] },
    { t: "h2", text: "loaded.runtime and loaded.sessionId" },
    { t: "table", label: "Runtime fields", head: ["Field", "Meaning", "Checked against the policy"], rows: [
      ["`ortVersion`", "The ONNX Runtime version the session runs.", "Yes: must be exactly `1.23.2`."],
      ["`executionProviders`", "The execution providers in use.", "Yes: must be exactly `CPUExecutionProvider`."],
      ["`pythonVersion`", "The Python version of the worker.", "No: recorded only."],
      ["`sessionId`", "The runtime session that loaded the release.", "No."],
    ] },
    { t: "h2", text: "Supported trace shapes" },
    { t: "p", text: "This reference describes the recorded trace and the evidence app's supported schema, not every observation the backend can produce. The backend can retain a worker report on an unknown observation when it cannot compare that report with authorized desired state. This viewer refuses that shape with `TRACE_LOADED_ON_UNAVAILABLE`; it is not evidence that the backend cannot retain the report. Backend `lastRejection` details are outside the viewer's defined fields and appear only as unvalidated extras in raw JSON and export." },
    { t: "h2", text: "A complete example" },
    { t: "code", label: "observation 02, reload pending", lang: "json", text: OBSERVATION_2 },
  ],
};

const CODES: Page = {
  tab: "products", section: CONTOUR.name, group: "Reference", slug: "states-and-codes", title: "States and codes", nav: "States and codes",
  description: "The recorded trace's statuses and reason code, plus the evidence app's complete import-refusal reference.",
  lead: "The trace uses three statuses and one reason code. The evidence app adds its own reason codes when it refuses a file.",
  updated: UPDATED,
  blocks: [
    { t: "h2", text: "Observation statuses" },
    { t: "capture", name: "crop-observations-list", caption: "The captured run's four observations as the evidence app lists them: Matched, Reload pending, Matched, Evidence unavailable." },
    { t: "table", label: "Statuses", head: ["In the trace", "Shown as", "Meaning"], rows: [
      ["`matched`", "Matched", "Every identity field is equal, and the reported runtime satisfies the policy."],
      ["`pending`", "Reload pending", "The reported identity differs from the approved one; in baseline mode the runtime waits for an explicit reload."],
      ["`unknown`", "Evidence unavailable", "There is no loaded report. The observation carries a reason code and no loaded identity."],
    ] },
    { t: "h2", text: "Reason codes in the trace" },
    { t: "table", label: "Trace reason codes", head: ["Code", "Meaning", "Seen in"], rows: [
      ["`RUNTIME_UNAVAILABLE`", "The runtime did not report; the loaded state cannot be confirmed.", "[Observation 04](/docs/observation-04)"],
    ] },
    { t: "h2", text: "When the evidence app refuses a file" },
    { t: "p", text: "The app checks a trace's structure and consistency when it opens it, and refuses the whole file if any check fails. Every refusal carries a reason code and a readable message, and a refused file leaves the open state exactly as it was." },
    { t: "table", label: "App refusals", head: ["Code", "When"], rows: [
      ["`TRACE_TOO_LARGE`", "The input exceeds the 5,000,000-byte file limit."],
      ["`TRACE_NOT_JSON`", "The input cannot be parsed as JSON."],
      ["`TRACE_UNSUPPORTED`", "The file has an unsupported schema, kind or top-level structure, or its event count is outside 1–1,000."],
      ["`TRACE_TEXT_INVALID`", "Text or an identifier is missing, malformed, too long or contains characters the app does not display."],
      ["`TRACE_UNCHECKED_CLAIM`", "Displayed text claims verification, attestation, authentication, signing, trust or certification that the app cannot check."],
      ["`TRACE_TIMESTAMP_INVALID`", "A timestamp is not a real date and time with an explicit zone."],
      ["`TRACE_POLICY_INVALID`", "The recorded policy or its runtime requirements are missing, malformed or unsupported."],
      ["`TRACE_TOOLCHAIN_INVALID`", "The optional recorded toolchain is malformed."],
      ["`TRACE_OBSERVATION_UNSUPPORTED`", "An event, observation, session identifier or loaded-evidence marker has an unsupported shape or value."],
      ["`TRACE_REASON_CODE_INVALID`", "An observation's reason code is malformed."],
      ["`TRACE_IDENTITY_INVALID`", "Required release identity fields are missing or malformed."],
      ["`TRACE_LOADED_ON_UNAVAILABLE`", "An unknown observation carries a loaded report, which this viewer does not support."],
      ["`TRACE_RUNTIME_MISSING`", "A matched or pending observation has no valid reported runtime."],
      ["`TRACE_STATE_CONTRADICTION`", "The recorded matched or pending status contradicts the desired and loaded identity fields."],
      ["`TRACE_RUNTIME_POLICY_UNSATISFIED`", "The reported ONNX Runtime version or providers do not satisfy the policy contained in the file."],
    ] },
    { t: "p", text: "The app also refuses displayed text that claims verification, attestation, signing or trust, look-alike and control characters in displayed text, and defined fields with malformed values. These import checks establish internal consistency, not authenticity: a self-consistent edited file can pass and remains labelled imported, not verified. Unknown fields are retained as unvalidated extras in raw JSON and export, not rendered as validated facts. Its tests list each case: [The evidence app](/docs/evidence-app)." },
    { t: "h2", text: "Policy fields the runtime checks" },
    { t: "code", label: "policy cpu-lab, version 1", lang: "json", text: POLICY },
  ],
};

export const HELPFUL = { keyConcepts: KEY_CONCEPTS, architecture: ARCHITECTURE, guides: [WALKTHROUGH, REVIEW, EVALUATE], reference: [RECORD, CODES] };

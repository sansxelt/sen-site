import type { ReactNode } from "react";
import { Reveal, PageHero, SectionHead, CTA, EditorialLink, Signal } from "../_system/ui";
import { Code, CopyScript } from "../_system/code";
import { v6meta } from "../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";

// Developers (design 06). How your own tools start a check and read the answer. Every request/response shape
// here is copied from the shipped code (app/api/v1/verifications, cli/vraelis.mjs,
// lib/preflight/webhook-dispatch). Nothing is documented that has not shipped.
//
// THE THINGS TO RE-CHECK BEFORE EDITING ANY SNIPPET HERE:
//   1. A POST with no reviewed_plan_id returns review_required and an approve_url, not a running
//      verification. The page shipped for a while claiming otherwise, and the CI example built on that claim
//      would have hung in a customer's pipeline forever.
//   2. POST /v1/verifications/plans/{id}/approve refuses EVERY API key with 403 plan_requires_human and the
//      approve_url (2026-09-28). A person approves at that link. An earlier version of this page showed a key
//      approving the plan, which stopped being true the day keys started belonging to coding agents.
//   3. POST /v1/verifications/{id}/recheck runs the same approved plan again without a new approval, inside
//      the limits in lib/preflight/recheck.ts: 24 hours from the approval, 10 re-checks, same scheme and host.
// If any of these changes, this page, /agents, /docs and app/rank/app/api/page.tsx all have to move with it.

export const metadata = v6meta({
  title: "Developers",
  description:
    "Start a Vraelis check from your own tools: submit a claim, have a person approve the plan, read an evidence-backed decision, and re-check after a fix, through the API, the CLI, webhooks or MCP.",
  path: "/developers",
});

const BASE = V6_BASE;

/* ---------------------------------------------------------------- sources --- */
// THE FIRST POST DOES NOT START A RUN. app/api/v1/verifications/route.ts answers a submit with no
// reviewed_plan_id with 202 { state: "review_required", reviewed_plan_id, approve_url, requirements }, and
// nothing runs or is charged. Every shape here is read off the route handler.
const CREATE = `# 1. Submit the claim. Vraelis writes a plan and asks a person to approve it before anything runs.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{
    "deployment_url": "https://staging.example.com",
    "claim": "A customer can upgrade to Pro and still have access after signing in again."
  }'`;

const CREATE_RES = `{
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

const APPROVE_RUN = `# 2. A person opens approve_url and approves the plan with one click. A key cannot:
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

const READ = `# 4. Poll until a decision lands. While the run is going, there is no decision yet.
curl https://vraelis.com/api/v1/verifications/vrf_9c1e0f2a41 \\
  -H "x-api-key: $VRAELIS_API_KEY"`;

const READ_RES = `{
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

const RECHECK = `# 5. Deploy the fix, then run the same approved plan again. No new approval inside the window.
curl -X POST https://vraelis.com/api/v1/verifications/vrf_9c1e0f2a41/recheck \\
  -H "x-api-key: $VRAELIS_API_KEY"`;

const RECHECK_RES = `{
  "verification_id": "vrf_4be27d9c10",
  "state": "running",
  "status_url": "/v1/verifications/vrf_4be27d9c10",
  "recheck_of": "vrf_9c1e0f2a41",
  "human_reviewed": true,
  "reviewed_plan_id": "rvp_3c9e26ef",
  "rechecks_left": 9,
  "recheck_window_ends_at": "2026-09-29T18:04:11.000Z"
}`;

const IDEM_ERR = `{
  "error": {
    "code": "idempotency_key_reused",
    "message": "That idempotency key was already used for a different verification. Use a new key, or resend the original request exactly.",
    "request_id": "req_5f3a90"
  }
}`;

const DRY = `# Ask "is this claim provable against this build?" before spending anything.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://staging.example.com",
        "claim": "A customer can upgrade to Pro and keep access after signing in again.",
        "dry_run": true }'`;

const DRY_RES = `{
  "dry_run": true,
  "would_launch": true,
  "requirements": ["Upgrading to Pro grants Pro access immediately", "..."],
  "reviewed_plan_id": "rvp_3c9e26ef",
  "reviewed_plan_expires_at": "2026-09-28T19:04:11.000Z",
  "approval_required": true,
  "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef",
  "human_reviewed": false
}`;

const CLI = `# Install. macOS and Linux:
curl -fsS https://vraelis.com/install | sh
# Windows (PowerShell):
irm https://vraelis.com/install.ps1 | iex

# Sign in once. Paste a key with "Launch runs" access, created at app.vraelis.com/developers.
vraelis login

# Check a claim. Prints the plan and the approval link, opens the link when a person is at the
# terminal, waits for the approval, runs, and exits on the decision.
vraelis verify \\
  --url https://staging.example.com \\
  --claim "A customer can upgrade to Pro and keep access after signing in again" \\
  --wait

# After a fix is deployed: the same approved plan, no new approval inside 24 hours.
vraelis recheck vrf_9c1e0f2a41 --wait

# 0 verified   1 failed   2 blocked or could not run
# --repair-prompt prints only the fix, ready to paste into a coding agent
# --json emits one JSON object instead of human output, for CI and scripts
# Also: result VRF_ID, init, mcp, status, logout`;

const GATE = `// gate.mjs: ship only on "verified". The exit code gates the deploy.
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

const HOOK = `{
  "event": "verification.completed",
  "run_id": "9c1e0f2a41",
  "application_id": "app_5b7d",
  "decision": "failed",
  "flows_total": 4,
  "flows_passed": 3,
  "deployment_url": "https://staging.example.com",
  "completed_at": "2026-09-28T18:04:11.220Z",
  "report_url": "https://app.vraelis.com/systems/app_5b7d/passes/9c1e0f2a41"
}`;

const VERIFY = `// Verify the delivery: HMAC-SHA256 over \`\${timestamp}.\${rawBody}\`.
import { createHmac, timingSafeEqual } from "node:crypto";

const timestamp = req.headers["x-vraelis-timestamp"];
const signature = req.headers["x-vraelis-signature"];   // "sha256=<hex>"
const expected = "sha256=" + createHmac("sha256", process.env.VRAELIS_SECRET_KEY)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex");

const ok = Boolean(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));`;

/* small labelled row used inside the graphite sections */
function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p style={{ margin: "0 0 22px", color: "var(--g-fg-2)", fontSize: 15, lineHeight: 1.62, maxWidth: "62ch" }}>
      <span className="v6-mono" style={{ color: "var(--go-dk)", fontSize: 11.5, marginRight: 10 }}>{label}</span>
      {children}
    </p>
  );
}

const EXITS: [string, string, string][] = [
  ["0", "go", "Verified. The claim held on the live app, with evidence."],
  ["1", "stop", "Failed. The claim did not hold; a repair prompt is attached."],
  ["2", "wait", "Blocked, or the tool could not run at all."],
];

const MONO = { fontFamily: "var(--mono)", color: "var(--g-fg)" } as const;

export default function DevelopersPage() {
  return (
    <>
      <PageHero
        kicker="Developers"
        title="Start a check from your own tools."
        lead="Send a deployment URL and one sentence about what should work. A person approves the plan at a link, the run starts, and you read back Verified, Failed or Blocked with the evidence. Five calls: submit, approve, run, read, re-check."
        cta={<><CTA brand>Create an API key</CTA><EditorialLink href="#api">Read the API</EditorialLink></>}
      />

      {/* framing: four ways in, one check */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Four ways in"
              title="The console, the CLI, the API and MCP run the same check."
              lead="Every channel ends in the same verification API, with the same plan, the same approval rule and the same three answers. This page covers the API, the CLI and webhooks. AI assistants connect over MCP, and their setup has its own page."
            />
          </Reveal>
          <Reveal style={{ marginTop: 24 }}>
            <EditorialLink href={`${BASE}/agents`}>Set up an AI assistant</EditorialLink>
          </Reveal>
        </div>
      </section>

      {/* ── API ── */}
      <section className="v6-sec v6-dark" id="api" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="The API"
              title="Submit, approve, run, read, re-check."
              lead="Authenticate with an API key, POST a deployment and a claim, send the approve_url to a person, resubmit with the approved plan id to start the run, then poll until a decision lands. After a fix, re-check the same plan. Base URL is https://vraelis.com."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(32px,4vw,52px)" }}>
            <Reveal>
              <Note label="Auth">
                Every request carries your key in the <code style={MONO}>x-api-key</code> header. Keys are created in the app, shown once, and stored only as a hash. Launching or re-checking needs a key with launch access, because it spends.
              </Note>
              <Code lang="bash" src={CREATE} />
            </Reveal>
            <Reveal style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 10px", color: "var(--g-fg-3)", fontSize: 13.5 }}>Returns <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>202</span> with <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>state: &ldquo;review_required&rdquo;</span>, the derived requirements, the plan to approve, and the <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>approve_url</span> a person opens. No run started, nothing charged, and no verification id yet. The response also carries <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>contract_id</span> and <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>contract_version</span>.</p>
              <Code lang="json" src={CREATE_RES} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Approve">
                Only a signed-in person approves a plan, with one click at the approve_url. The approval is its own recorded event: who approved which plan, and when. Every API key is refused with <code style={MONO}>403 plan_requires_human</code> and the same link, so the tool that asked for the check can never sign off on it. The run then executes exactly the approved plan, with no re-derivation.
              </Note>
              <Code lang="bash" src={APPROVE_RUN} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Read">
                Poll <code style={MONO}>GET /v1/verifications/{"{id}"}</code>. While running, the body is just the id and state. Once complete, <code style={MONO}>decision</code> is one of <span style={{ color: "var(--go-dk)" }}>verified</span>, <span style={{ color: "var(--stop-dk)" }}>failed</span>, or <span style={{ color: "var(--wait-dk)" }}>blocked</span>. <code style={MONO}>recheck_of</code> names the verification a re-check repeated, or is null.
              </Note>
              <Code lang="bash" src={READ} />
            </Reveal>
            <Reveal style={{ marginTop: 16 }}>
              <Code lang="json" src={READ_RES} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Re-check">
                After a Failed, deploy the fix and call <code style={MONO}>POST /v1/verifications/{"{id}"}/recheck</code>. It runs every journey of the same approved plan again and returns a new verification id; the earlier record is never touched. No new approval is needed within 24 hours of the approval, for at most 10 re-checks, on the same scheme and host. An optional <code style={MONO}>deployment_url</code> may name another path on that same site. Past those limits the API answers <code style={MONO}>recheck_window_closed</code> or <code style={MONO}>recheck_limit_reached</code>, and you start a new verification. Each re-check is billed as one verification.
              </Note>
              <Code lang="bash" src={RECHECK} />
            </Reveal>
            <Reveal style={{ marginTop: 16 }}>
              <Code lang="json" src={RECHECK_RES} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Requirements">
                Every response echoes the requirements Vraelis derived from your claim, and states whether a person approved them in <span className="v6-mono" style={{ color: "var(--g-fg)" }}>human_reviewed</span>. A model reading a claim can misread it; the requirements are what the person is approving, and they are how you catch a confidently wrong verdict before you trust it.
              </Note>
              <Note label="Idempotency">
                Send an <code style={MONO}>idempotency-key</code> header. A retry with the same key, deployment, and claim replays the original verification instead of starting and paying for a second one. The same key with a different claim is refused, so a changed request can never be answered with an earlier run.
              </Note>
              <Code lang="json" src={IDEM_ERR} />
              <p style={{ margin: "12px 0 0", color: "var(--g-fg-3)", fontSize: 13.5 }}>Errors share one envelope: <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>{"{ error: { code, message, request_id } }"}</span>, with the id also on the <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>X-Request-Id</span> header. A claim that cannot be proven returns <span className="v6-mono" style={{ color: "var(--wait-dk)" }}>claim_not_provable</span> (422) with a repair prompt, and nothing is charged.</p>
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="SDK">
                A TypeScript SDK, @vraelis/sdk 0.3.0, wraps these calls as prepare, getPlan, waitForApproval, run, waitForResult, recheck and get. It is built and tested in the repository and is not yet published to npm, so it cannot be installed today.
              </Note>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Review before spend (still the API, still live) ──
          The four dark sections from #api down to #webhooks read as one graphite band, which is why the
          three that follow #api open with paddingTop: 0. That is right for a section nobody can arrive at
          directly and wrong for one that names itself in the URL: #cli and #webhooks are anchor targets, and
          with no top padding their eyebrow (margin: 0) sat flush against the bottom edge of the bar. Those
          two get their padding back below, and the section ABOVE each of them gives up the same amount off
          its bottom, so the gap between any two of these sections is unchanged and the band still reads as
          one run. This one is not an anchor, so it keeps the collapsed top and only pays the bottom. */}
      <section
        className="v6-sec v6-dark"
        data-nav-dark
        style={{ paddingTop: 0, paddingBottom: "calc(var(--sec) - clamp(48px,6vw,88px))" }}
      >
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Ask before you commit"
              title="Find out whether the claim is provable, for nothing."
              lead="A dry run derives the plan, checks it can actually prove the claim, and charges nothing. When it can, it mints the same plan a person approves in step 2 above, with its approve_url. When it cannot, it says so with a repair prompt, and there is nothing to approve."
            />
          </Reveal>
          <Reveal style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <Code lang="bash" src={DRY} />
          </Reveal>
          <Reveal style={{ marginTop: 16 }}>
            <Code lang="json" src={DRY_RES} />
          </Reveal>
        </div>
      </section>

      {/* ── CLI ── An anchor target, so it pays for its own arrival: the eyebrow needs room under the bar.
          It is also the section above #webhooks, so it gives that gap back off its bottom. No
          scroll-margin-top here or anywhere else on this page: globals.css:701-706 records that
          scroll-padding on the scrollport and scroll-margin on the target ADD, and the previous per-element
          offset is what produced the 97px overshoot. The section's own padding is the whole mechanism. */}
      <section
        className="v6-sec v6-dark"
        id="cli"
        data-nav-dark
        style={{ paddingTop: "clamp(48px,6vw,88px)", paddingBottom: "calc(var(--sec) - clamp(48px,6vw,88px))" }}
      >
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="CLI"
              title="One command. The exit code is the interface."
              lead="The vraelis CLI calls the same API. verify prints the plan and the approval link, opens the link when a person is at the terminal, waits for the approval, runs the check and exits on the decision. In CI the exit code is what an if-statement reads."
            />
          </Reveal>
          {/* minmax(0,1fr): without an explicit track the implicit column sizes to the code block's
              max-content and blows past the viewport on mobile (clipped by the global body overflow-x). */}
          <div style={{ marginTop: "clamp(28px,3.4vw,44px)", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 24 }}>
            <Reveal><Code lang="bash" src={CLI} /></Reveal>
            <Reveal>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {EXITS.map(([n, sig, d]) => (
                  <li key={n} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 14, alignItems: "baseline" }}>
                    <span className="v6-mono" style={{ color: `var(--${sig}-dk)`, fontSize: 15, fontWeight: 600 }}>{n}</span>
                    <span style={{ color: "var(--g-fg-2)", fontSize: 14.5, lineHeight: 1.5 }}>{d}</span>
                  </li>
                ))}
              </ul>
              <p style={{ margin: "18px 0 0", color: "var(--g-fg-3)", fontSize: 13.5, lineHeight: 1.6, maxWidth: "62ch" }}>
                The CLI collapses &ldquo;blocked&rdquo; and &ldquo;could not run&rdquo; into 2, because a gate should treat &ldquo;I could not check&rdquo; the same as &ldquo;no verdict.&rdquo; A hand-rolled gate that polls the API can split those out, exiting 3 when no decision is reached in the window.
              </p>
              {/* THE DISCLOSURE THAT USED TO SIT HERE IS RETIRED. It said a first verify stopped at
                  review_required because the CLI neither approved nor waited. The CLI now prints the approval
                  link, waits for a person to approve, and runs, so --wait reaches a decision. What is still
                  true, and said instead: a job with no person at the terminal cannot approve for itself. */}
              <p style={{ margin: "14px 0 0", color: "var(--g-fg-3)", fontSize: 13.5, lineHeight: 1.6, maxWidth: "62ch" }}>
                A CI job has no person at the terminal, and a key cannot approve a plan, so the first check of a claim waits on the link until someone approves it or <span className="v6-mono">--timeout</span> runs out. Re-checks of that approved plan need no new approval within 24 hours. The gate below splits the two cases instead.
              </p>
            </Reveal>
            <Reveal><Code lang="js" src={GATE} /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Webhooks ── The other anchor target, same reason for the same top padding. Its bottom keeps the
          full --sec: the section after it is light, so this is where the graphite band ends. */}
      <section
        className="v6-sec v6-dark"
        id="webhooks"
        data-nav-dark
        style={{ paddingTop: "clamp(48px,6vw,88px)" }}
      >
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Webhooks"
              title="Get the decision pushed to you."
              lead="Connect an endpoint and Vraelis POSTs a signed verification.completed event the moment a verification finalizes. It carries only owner-safe facts: the decision, flow counts, ids, and a link to the evidence. Never a session id, token, credential, or signed artifact URL."
            />
          </Reveal>
          <Reveal style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <Note label="Event">
              One event, <code style={MONO}>verification.completed</code>, delivered with the headers <code style={MONO}>x-vraelis-event</code>, <code style={MONO}>x-vraelis-timestamp</code>, and <code style={MONO}>x-vraelis-signature</code>.
            </Note>
            <Code lang="json" src={HOOK} />
          </Reveal>
          <Reveal style={{ marginTop: 16 }}>
            <Note label="Verify">
              The signature is an HMAC over the raw body prefixed with the timestamp, so recompute over the exact bytes you received before trusting the payload.
            </Note>
            <Code lang="js" src={VERIFY} />
            <p style={{ margin: "16px 0 0", color: "var(--g-fg-3)", fontSize: 13.5, lineHeight: 1.6, maxWidth: "62ch" }}>
              Point the same endpoint at a Slack incoming webhook and the event arrives as a formatted message in your channel instead of raw JSON, with the decision, flows passed, and a link to the evidence.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Ways to use it ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Ways to use it"
              title="API, CLI, webhooks and MCP are the product boundary."
              lead="Start and read a check through the API or the CLI, let an AI assistant call it over MCP, and send signed decisions into the systems you already operate. GitHub Actions, Vercel deployments and Slack are those primitives in use, not the center of Vraelis."
            />
          </Reveal>
          <Reveal style={{ marginTop: 24, display: "flex", gap: 22, flexWrap: "wrap" }}>
            <EditorialLink href={`${BASE}/integrations`}>See all ways to use it</EditorialLink>
          </Reveal>
        </div>
      </section>

      {/* ── Honest status ── */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead eyebrow="Honest about what is live" title="We will not document an endpoint we have not shipped." />
          </Reveal>
          <div className="v6-grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,320px),1fr))" }}>
            <Reveal className="v6-gcard">
              <p style={{ marginBottom: 14 }}><Signal state="go">Live today</Signal></p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 9 }}>
                {[
                  "POST /api/v1/verifications, create, dry-run, or run an approved plan",
                  "GET /api/v1/verifications/plans/{id}, the plan, its approval state, and approve_url while it is pending",
                  "GET /api/v1/verifications/{id}, decision, evidence, repair prompt, recheck_of",
                  "POST /api/v1/verifications/{id}/recheck, the same approved plan after a fix",
                  "POST /api/v1/verifications/plans/{id}/approve, for a signed-in person only; every API key gets 403 plan_requires_human",
                  "The vraelis CLI: verify, recheck, result, init, mcp",
                  "The MCP server, local (vraelis mcp) and hosted (https://vraelis.com/mcp)",
                  "Signed verification.completed webhooks, and Slack delivery",
                ].map((t) => <li key={t} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{t}</li>)}
              </ul>
            </Reveal>
            <Reveal className="v6-gcard" i={1}>
              <p style={{ marginBottom: 14 }}><Signal state="wait">Direction</Signal></p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 9 }}>
                {[
                  "The CLI and the TypeScript SDK on npm. Both are built; neither is published.",
                  "Device-level checks that read a drone or robot directly, its firmware, sensors and telemetry. Not built yet; today a device is checked through its web control panel.",
                  "A new deployment noticed and re-checked without anyone asking",
                  "A repair recorded as its own durable object",
                ].map((t) => <li key={t} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{t}</li>)}
              </ul>
              <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--ink-4)", lineHeight: 1.55 }}>
                When one ships, it appears here with a real example you can run.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <hr className="v6-rule" />
      <section className="v6-sec v6-sec--tight">
        <div className="v6-wrap" style={{ textAlign: "center", maxWidth: 720 }}>
          <Reveal>
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Put the check where you ship from.</h2>
            <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>
              Submit a claim from CI, the CLI or an AI assistant, have a person approve the plan once, gate on the decision, and re-check after a fix. One key, real endpoints, and a record you can open when a run comes back Failed.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Create an API key</CTA>
              <CTA href={`${BASE}/integrations`} ghost lg>Ways to use it</CTA>
            </div>
          </Reveal>
        </div>
      </section>

      <CopyScript />
    </>
  );
}

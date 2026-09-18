import type { ReactNode } from "react";
import { Reveal, PageHero, SectionHead, CTA, EditorialLink, Signal } from "../_system/ui";
import { v6meta } from "../_system/meta";
import { V6_BASE } from "@/lib/v6-routes";

// Developers (design 06). How external systems invoke the verification engine, the one capability inside
// Vraelis oversight that is live and self-serve today. Every request/response shape here is copied from the
// shipped code (app/api/v1/verifications, cli/vraelis.mjs, lib/preflight/webhook-dispatch). Nothing is
// documented that has not shipped; the responsibility / memory / agent APIs are marked Direction, not live.
//
// THE ONE THING TO RE-CHECK BEFORE EDITING ANY SNIPPET HERE: a POST with no reviewed_plan_id returns
// review_required, not a running verification. The page shipped for a while claiming otherwise, and the CI
// example built on that claim would have hung in a customer's pipeline forever. If the route's answer to a
// bare submit ever changes again, this page and app/rank/app/api/page.tsx both have to move with it.

export const metadata = v6meta({
  title: "Developers",
  description:
    "Use the Vraelis API, CLI and webhooks to submit checks, approve plans, read evidence-backed decisions and gate automation.",
  path: "/developers",
});

const BASE = V6_BASE;
/* ------------------------------------------------------------------ code --- */
// A char-exact tokenizer: the final [\s\S] alternative matches every remaining character, so the rendered
// text always equals the source byte for byte and the copy button returns exactly what is shown.
type Seg = string | [string, string];

const RE: Record<string, RegExp> = {
  bash: /#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\B--?[A-Za-z][\w-]*|\b(?:curl|export|npx|vraelis|uuidgen)\b|[\s\S]/g,
  json: /"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[\s\S]/g,
  js: /\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|from|const|let|await|async|for|switch|case|default|return|new|function|process|Boolean|Buffer)\b|[\s\S]/g,
};

function highlight(lang: string, src: string): Seg[] {
  const re = RE[lang];
  if (!re) return [src];
  const out: Seg[] = [];
  const push = (t: string, c?: string) => {
    if (c) out.push([t, c]);
    else if (typeof out[out.length - 1] === "string") out[out.length - 1] = (out[out.length - 1] as string) + t;
    else out.push(t);
  };
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = m[0];
    const first = t[0];
    if (lang === "json") {
      if (first === '"') {
        let k = re.lastIndex;
        while (src[k] === " " || src[k] === "\t") k++;
        push(t, src[k] === ":" ? "p" : "s");
      } else if (/^(?:true|false|null|-?\d)/.test(t)) push(t, "k");
      else push(t);
    } else {
      if (first === "#" || (first === "/" && t[1] === "/")) push(t, "c");
      else if (first === '"' || first === "'" || first === "`") push(t, "s");
      else if (first === "-") push(t, "p");
      else if (/^[A-Za-z]/.test(t) && t.length > 1) push(t, "k");
      else push(t);
    }
  }
  return out;
}

function Code({ lang, src }: { lang: string; src: string }) {
  const segs = highlight(lang, src.replace(/\n+$/, ""));
  return (
    <div className="v6-code">
      <div className="v6-code__bar">
        <span className="v6-code__lang">{lang}</span>
        <button
          type="button"
          data-v6-copy
          aria-label={`Copy ${lang} snippet`}
          style={{
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--g-fg-3)", background: "transparent", border: "1px solid var(--g-line)",
            borderRadius: 6, padding: "4px 11px", minHeight: 28, cursor: "pointer",
          }}
        >
          Copy
        </button>
      </div>
      <pre><code>{segs.map((s, i) => (typeof s === "string" ? s : <span key={i} className={s[1]}>{s[0]}</span>))}</code></pre>
    </div>
  );
}

// Delegated, idempotent copy wiring. Rendered once per page. Reads the block's rendered text (which equals
// the source exactly) and writes it to the clipboard; falls back to execCommand where the async API is absent.
function CopyScript() {
  const js =
    "(function(){if(window.__v6copy)return;window.__v6copy=1;" +
    "document.addEventListener('click',function(e){" +
    "var t=e.target;var b=t&&t.closest&&t.closest('[data-v6-copy]');if(!b)return;" +
    "var box=b.closest('.v6-code');if(!box)return;var code=box.querySelector('code');if(!code)return;" +
    "var text=code.innerText;var prev=b.getAttribute('data-label')||b.textContent;b.setAttribute('data-label',prev);" +
    "var done=function(){b.textContent='Copied';setTimeout(function(){b.textContent=prev;},1400);};" +
    "if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){});}" +
    "else{try{var a=document.createElement('textarea');a.value=text;a.setAttribute('readonly','');a.style.position='absolute';a.style.left='-9999px';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);done();}catch(_){}}" +
    "});})();";
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

/* ---------------------------------------------------------------- sources --- */
// THE FIRST POST DOES NOT START A RUN, and this page used to say it did. CREATE_RES showed
// { verification_id, state: "running" } coming back from a bare submit, which has not been true since human
// review became mandatory: app/api/v1/verifications/route.ts answers a submit with no reviewed_plan_id with
// 202 { state: "review_required", reviewed_plan_id, requirements }, and nothing runs or is charged. The same
// wrong shape had leaked into the CI example below, where destructuring verification_id off that response
// produced undefined and a gate that could never ship. Every shape here is now read off the route handler
// and matches the sequence the signed-in console documents (app/rank/app/api/page.tsx).
const CREATE = `# 1. Submit the claim. Vraelis derives a plan and asks a person to review it before anything runs.
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
  "reviewed_plan_expires_at": "2026-07-24T19:04:11.000Z",
  "human_reviewed": false,
  "message": "Vraelis built a plan that can prove this claim, and no person has reviewed it yet. Approve the reviewed plan, then resubmit with reviewed_plan_id to run exactly what was approved. Nothing was run and nothing was charged."
}`;

const APPROVE_RUN = `# 2. Approve the reviewed plan. A separate, audited event: holding the id is not approval.
curl -X POST https://vraelis.com/api/v1/verifications/plans/rvp_3c9e26ef/approve \\
  -H "x-api-key: $VRAELIS_API_KEY"
#    -> { "reviewed_plan_id": "rvp_3c9e26ef", "approval_state": "approved", "already_approved": false }

# 3. Resubmit the SAME deployment and claim with the approved plan id. This is the call that starts a run,
#    and the first response that carries a verification_id.
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
  "human_reviewed": true
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
  "reviewed_plan_expires_at": "2026-07-24T19:04:11.000Z",
  "approval_required": true,
  "human_reviewed": false
}`;

const CLI = `# One command. The exit code is the interface.
export VRAELIS_API_KEY="<your key>"   # created at app.vraelis.com/api with "Launch runs" access

vraelis verify \\
  --url https://staging.example.com \\
  --claim "A customer can upgrade to Pro and keep access after signing in again" \\
  --wait

# 0 verified   1 failed   2 blocked or could not run
# --repair-prompt prints only the fix package, ready to paste into a coding agent
#
# Direction, not built: a first verify call stops at review_required today. The CLI posts without a
# reviewed_plan_id and does not yet approve or resubmit, so --wait cannot reach a decision on its own.
# Approve the plan in the console's Review queue first.`;

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
const planId = process.env.VRAELIS_REVIEWED_PLAN_ID;
if (!planId) {
  const plan = await (await post(request)).json();
  console.error("Approve this plan before it can run: " + plan.reviewed_plan_id);
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
  "completed_at": "2026-07-24T18:04:11.220Z",
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
      <span className="v6-mono" style={{ color: "var(--go-dk)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 10 }}>{label}</span>
      {children}
    </p>
  );
}

const EXITS: [string, string, string][] = [
  ["0", "go", "Verified. The claim held, with evidence."],
  ["1", "stop", "Failed. The claim did not hold; a repair prompt is attached."],
  ["2", "wait", "Blocked, or the tool could not run at all."],
];

export default function DevelopersPage() {
  return (
    <>
      <PageHero
        kicker="Developers"
        title="Invoke the verification engine from your own systems."
        lead="Send a live app or HTTP API and a claim, approve the plan Vraelis derives, and get back an explainable decision with evidence. Four calls: submit, approve, run, read."
        cta={<><CTA brand>Create an API key</CTA><EditorialLink href="#api">Read the API</EditorialLink></>}
      />

      {/* framing: one capability inside oversight */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="One capability, exposed"
              title="Verification is one capability inside broader oversight."
              lead="A guarantee is one sentence about your software that has to stay true. This API drives the part that is live and self-serve today: submit a claim, approve the plan that would prove it, run it against your deployment, and read the decision. The guarantee, memory, and agent-oversight APIs are direction, and are not documented here until they ship."
            />
          </Reveal>
        </div>
      </section>

      {/* ── API ── */}
      <section className="v6-sec v6-dark" id="api" data-nav-dark>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="The API"
              title="Submit a claim, approve the plan, read the decision."
              lead="Authenticate with an API key, POST a deployment and a claim, approve the plan that comes back, resubmit with the approved plan id to start the run, then poll the status URL until a decision lands. Base URL is https://vraelis.com."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(32px,4vw,52px)" }}>
            <Reveal>
              <Note label="Auth">
                Every request carries your key in the <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>x-api-key</code> header. Keys are created in the app, shown once, and stored only as a hash. Launching a verification needs a key with launch access, because it spends.
              </Note>
              <Code lang="bash" src={CREATE} />
            </Reveal>
            <Reveal style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 10px", color: "var(--g-fg-3)", fontSize: 13.5 }}>Returns <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>202</span> with <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>state: &ldquo;review_required&rdquo;</span>, the derived requirements, and the reviewed plan to approve. No run started, nothing charged, and no verification id yet. The response also carries <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>contract_id</span> and <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>contract_version</span>.</p>
              <Code lang="json" src={CREATE_RES} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Approve">
                A plan is approved as its own event, then run verbatim. The approve call records who approved which plan hash and when, and the run call takes the approved id and executes exactly that plan with no re-derivation. A plan that defines a guarantee can only be approved by a signed-in person, never by a key.
              </Note>
              <Code lang="bash" src={APPROVE_RUN} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Read">
                Poll <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>GET /v1/verifications/{"{id}"}</code>. While running, the body is just the id and state. Once complete, <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>decision</code> is one of <span style={{ color: "var(--go-dk)" }}>verified</span>, <span style={{ color: "var(--stop-dk)" }}>failed</span>, or <span style={{ color: "var(--wait-dk)" }}>blocked</span>.
              </Note>
              <Code lang="bash" src={READ} />
            </Reveal>
            <Reveal style={{ marginTop: 16 }}>
              <Code lang="json" src={READ_RES} />
            </Reveal>
            <Reveal style={{ marginTop: 28 }}>
              <Note label="Requirements">
                Every response echoes the requirements Vraelis derived from your claim, and states whether a person approved them in <span className="v6-mono" style={{ color: "var(--g-fg)" }}>human_reviewed</span>. A model reading a claim can misread it; the requirements are what you are approving, and they are how you catch a confidently wrong verdict before you trust it.
              </Note>
              <Note label="Idempotency">
                Send an <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>idempotency-key</code> header. A retry with the same key, deployment, and claim replays the original verification instead of starting and paying for a second one. The same key with a different claim is refused, so a changed request can never be answered with an earlier run.
              </Note>
              <Code lang="json" src={IDEM_ERR} />
              <p style={{ margin: "12px 0 0", color: "var(--g-fg-3)", fontSize: 13.5 }}>Errors share one envelope: <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>{"{ error: { code, message, request_id } }"}</span>, with the id also on the <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>X-Request-Id</span> header. A claim that cannot be proven returns <span className="v6-mono" style={{ color: "var(--wait-dk)" }}>claim_not_provable</span> (422) with a repair prompt, and nothing is charged.</p>
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
              lead="A dry run derives the plan, checks it can actually prove the claim, and charges nothing. When it can, it mints the same reviewed plan you approve and run in steps 2 and 3 above. When it cannot, it says so with a repair prompt, and there is nothing to approve."
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
              lead="The vraelis CLI wraps the same endpoint for people and pipelines. In CI it is read by an if-statement far more often than by a person, so the exit code carries the verdict and everything else is decoration. It cannot reach a verdict on its own yet, for the reason set out below."
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
              {/* THE SAME DISCLOSURE THE SIGNED-IN CONSOLE CARRIES (app/rank/app/api/cli-section.tsx). The
                  page listed three exit codes as though a single `verify --wait` reached one of them. It
                  cannot: cli/vraelis.mjs posts without a reviewed_plan_id, so the API answers 202
                  review_required, and the CLI neither approves the plan nor resubmits with its id. It reads
                  started.json.verification_id, which is not on that response, and stops. Every public
                  surface that names the CLI has to say this until the CLI submits the approval itself. */}
              <p style={{ margin: "14px 0 0", color: "var(--wait-dk)", fontSize: 13.5, lineHeight: 1.6, maxWidth: "62ch" }}>
                Direction, not built: a first <span className="v6-mono">verify</span> call stops at review_required today. The CLI posts without a reviewed plan id and does not yet approve the plan or resubmit with it, so <span className="v6-mono">--wait</span> cannot reach a decision on its own. Approve the plan in the console&rsquo;s Review queue first. The exit codes above are what the CLI returns once a decision is reachable.
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
              One event, <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>verification.completed</code>, delivered with the headers <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>x-vraelis-event</code>, <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>x-vraelis-timestamp</code>, and <code style={{ fontFamily: "var(--mono)", color: "var(--g-fg)" }}>x-vraelis-signature</code>.
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

      {/* ── Integrations pointer ── */}
      <section className="v6-sec">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Integrations"
              title="API, CLI and webhooks are the product boundary."
              lead="Start and read verification through the API, gate automation with the CLI, and send signed decisions into the systems you already operate. GitHub, Vercel and Slack are examples of those primitives in use, not the center of Vraelis."
            />
          </Reveal>
          <Reveal style={{ marginTop: 24 }}>
            <EditorialLink href={`${BASE}/integrations`}>See all integrations</EditorialLink>
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
                  "POST /api/v1/verifications, create, dry-run, or run a reviewed plan",
                  "GET /api/v1/verifications/{id}, decision, evidence, repair prompt",
                  "POST /api/v1/verifications/plans/{id}/approve, the approval a run consumes",
                  "The vraelis CLI, up to review_required",
                  "Signed verification.completed webhooks",
                  "Vercel and GitHub deployment URLs as verification targets, Slack delivery",
                ].map((t) => <li key={t} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{t}</li>)}
              </ul>
            </Reveal>
            <Reveal className="v6-gcard" i={1}>
              <p style={{ marginBottom: 14 }}><Signal state="wait">Direction</Signal></p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 9 }}>
                {[
                  "A CLI run that submits the approval and reaches a verdict on its own",
                  "Re-verifying a repair from the API, without a person starting the rerun",
                  "Guarantee and assignment APIs",
                  "Agent memory and reliability APIs",
                  "Continuous agent-activity ingestion",
                  "An SDK for native applications, devices and physical systems",
                ].map((t) => <li key={t} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{t}</li>)}
              </ul>
              <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--ink-4)", lineHeight: 1.55 }}>
                These are where oversight is going. When one ships, it appears here with a real example you can run.
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
            <h2 className="v6-dl" style={{ marginInline: "auto" }}>Wire the decision into the place you ship from.</h2>
            <p className="v6-lead" style={{ margin: "18px auto 28px", textAlign: "center" }}>
              Submit a claim from CI, approve the plan, gate on the decision, and get the evidence pushed back. One key, real endpoints, and a record you can open when a run comes back Failed.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <CTA brand lg>Create an API key</CTA>
              <CTA href={`${BASE}/integrations`} ghost lg>See integrations</CTA>
            </div>
          </Reveal>
        </div>
      </section>

      <CopyScript />
    </>
  );
}

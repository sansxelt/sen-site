import type { ReactNode } from "react";
import { Reveal, PageHero, SectionHead, CTA, EditorialLink, Signal } from "../_system/ui";
import { v6meta } from "../_system/meta";

// Developers (design 06). How external systems invoke the verification engine — the one capability inside
// Vraelis oversight that is live and self-serve today. Every request/response shape here is copied from the
// shipped code (app/api/v1/verifications, cli/vraelis.mjs, lib/preflight/webhook-dispatch). Nothing is
// documented that has not shipped; the responsibility / memory / agent APIs are marked Direction, not live.

export const metadata = v6meta({
  title: "Developers",
  description:
    "Drive Vraelis verification from your own systems. Create a verification with a deployment and a claim over the API, read an explainable decision with evidence, gate CI on the exit code, and receive signed verification.completed webhooks.",
  path: "/developers",
});

const BASE = "/dev-preview/v6";

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
const CREATE = `# Create a verification: send the deployment and the claim.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{
    "deployment_url": "https://staging.example.com",
    "claim": "A customer can upgrade to Pro and still have access after signing in again."
  }'`;

const CREATE_RES = `{
  "verification_id": "vrf_9c1e0f2a41",
  "state": "running",
  "status_url": "/v1/verifications/vrf_9c1e0f2a41",
  "claim": "A customer can upgrade to Pro and still have access after signing in again.",
  "requirements": [
    "Upgrading to Pro grants Pro access immediately",
    "Pro access is still present after signing out and back in"
  ],
  "human_reviewed": false
}`;

const READ = `# Poll until a decision lands. While the run is going, there is no decision yet.
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
  "human_reviewed": false
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

const APPROVE = `# 1. Approve the reviewed plan. A separate, audited event: holding the id is not approval.
curl -X POST https://vraelis.com/api/v1/verifications/plans/rvp_3c9e26ef/approve \\
  -H "x-api-key: $VRAELIS_API_KEY"
#    -> { "reviewed_plan_id": "rvp_3c9e26ef", "approval_state": "approved", "already_approved": false }

# 2. Run exactly what was reviewed. The paid run consumes the approved plan verbatim.
curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://staging.example.com",
        "claim": "A customer can upgrade to Pro and keep access after signing in again.",
        "reviewed_plan_id": "rvp_3c9e26ef" }'
#    -> the response carries "human_reviewed": true`;

const CLI = `# One command. The exit code is the interface.
export VRAELIS_API_KEY="<your key>"   # created at app.vraelis.com/api with "Launch runs" access

vraelis verify \\
  --url https://staging.example.com \\
  --claim "A customer can upgrade to Pro and keep access after signing in again" \\
  --wait

# 0 verified   1 failed   2 blocked or could not run
# --repair-prompt prints only the fix package, ready to paste into a coding agent`;

const GATE = `// gate.mjs — ship only on "verified". The exit code gates the deploy.
// 0 verified   1 failed   2 blocked   3 no decision reached
import { randomUUID } from "node:crypto";

const API = "https://vraelis.com/api/v1/verifications";
const headers = {
  "content-type": "application/json",
  "x-api-key": process.env.VRAELIS_API_KEY,
  "idempotency-key": randomUUID(),
};

const created = await fetch(API, {
  method: "POST",
  headers,
  body: JSON.stringify({ deployment_url: process.env.PREVIEW_URL, claim: process.env.VRAELIS_CLAIM }),
});
const { verification_id } = await created.json();

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
  "report_url": "https://app.vraelis.com/applications/app_5b7d/passes/9c1e0f2a41"
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
        lead="Send a deployment and a claim, get back an explainable decision with evidence. One call to start, one to read the result, and one exit code to gate a release on. Every shape below is copied from the shipped API."
        cta={<><CTA brand>Create an API key</CTA><EditorialLink href="#api">Read the API</EditorialLink></>}
      />

      {/* framing: one capability inside oversight */}
      <section className="v6-sec v6-sec--sunk">
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="One capability, exposed"
              title="Verification is one capability inside broader oversight."
              lead="Vraelis follows agent work from assigned responsibility to trusted completion. This API drives the part that is live and self-serve today: when something claims to be done, Vraelis proves the running software against the claim. The responsibility, memory, and agent-oversight APIs are direction, and are not documented here until they ship."
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
              title="Create a verification, read the decision."
              lead="Two calls. Authenticate with an API key, POST a deployment and a claim, then poll the status URL until a decision lands. Base URL is https://vraelis.com."
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
              <p style={{ margin: "0 0 10px", color: "var(--g-fg-3)", fontSize: 13.5 }}>Returns <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>202</span> with the id, the derived requirements, and <span className="v6-mono" style={{ color: "var(--g-fg-2)" }}>human_reviewed: false</span>.</p>
              <Code lang="json" src={CREATE_RES} />
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
                Every response echoes the requirements Vraelis derived from your claim, and states <span className="v6-mono" style={{ color: "var(--g-fg)" }}>human_reviewed: false</span> plainly. A model reading a claim can misread it; the requirements are how you catch a confidently wrong verdict before you trust it.
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

      {/* ── Review before spend (still the API, still live) ── */}
      <section className="v6-sec v6-dark" data-nav-dark style={{ paddingTop: 0 }}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="Review before you spend"
              title="Put a human decision before a paid run."
              lead="A dry run synthesizes the plan, checks it can prove the claim, and charges nothing. When it can, it mints a reviewed plan you approve as a separate audited event. The paid run then executes exactly what was approved, and comes back marked human_reviewed."
            />
          </Reveal>
          <Reveal style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
            <Code lang="bash" src={DRY} />
          </Reveal>
          <Reveal style={{ marginTop: 16 }}>
            <Code lang="json" src={DRY_RES} />
          </Reveal>
          <Reveal style={{ marginTop: 16 }}>
            <Code lang="bash" src={APPROVE} />
          </Reveal>
        </div>
      </section>

      {/* ── CLI ── */}
      <section className="v6-sec v6-dark" id="cli" data-nav-dark style={{ paddingTop: 0 }}>
        <div className="v6-wrap">
          <Reveal>
            <SectionHead
              eyebrow="CLI"
              title="One command. The exit code is the interface."
              lead="The vraelis CLI wraps the same endpoint for people and pipelines. In CI it is read by an if-statement far more often than by a person, so the exit code carries the verdict and everything else is decoration."
            />
          </Reveal>
          <div style={{ marginTop: "clamp(28px,3.4vw,44px)", display: "grid", gap: 24 }}>
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
            </Reveal>
            <Reveal><Code lang="js" src={GATE} /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Webhooks ── */}
      <section className="v6-sec v6-dark" id="webhooks" data-nav-dark style={{ paddingTop: 0 }}>
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
              title="GitHub, Vercel, and Slack, from the same primitives."
              lead="Run the CLI in GitHub Actions to gate a deploy, point a verification at a Vercel preview or production URL, and route the result into Slack. Each one is the API, the CLI, or a webhook wired to a place you already work, not a separate product."
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
                  "POST /api/v1/verifications — create, dry-run, or run a reviewed plan",
                  "GET /api/v1/verifications/{id} — decision, evidence, repair prompt",
                  "Reviewed-plan approval before a paid run",
                  "The vraelis verify CLI and its CI exit codes",
                  "Signed verification.completed webhooks",
                  "GitHub Actions, Vercel deployment URLs, Slack",
                ].map((t) => <li key={t} style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-3)" }}>{t}</li>)}
              </ul>
            </Reveal>
            <Reveal className="v6-gcard" i={1}>
              <p style={{ marginBottom: 14 }}><Signal state="wait">Direction</Signal></p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 9 }}>
                {[
                  "Responsibility and assignment APIs",
                  "Agent memory and reliability APIs",
                  "Continuous agent-activity ingestion",
                  "IDE, desktop, and MCP surfaces",
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
              Start a verification from CI, gate on the exit code, and get the evidence pushed back. One key, real endpoints, no dashboard to watch.
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

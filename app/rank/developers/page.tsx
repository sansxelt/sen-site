import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers: the AI output check API",
  description: "The AI output check API for AI teams. POST your output to /api/v1/check and get per-criterion scores, the recommended version, and line-level flags with fixes. Validate on real people through the same platform, with signed webhooks and JSON/CSV export. Sandbox before you spend.",
  path: "/developers",
});

// One small, honest preview: exact SDK/curl flows live in the signed-in console.
const PREVIEW = `const check = await vraelis.checks.create({ outputType, candidates })
check.recommended.label       // "B"
check.flags[0].fix            // "add a caveat before the claim"`;

const EMBED = `<script async src="https://vraelis.com/embed.js"
        data-vraelis-test="YOUR_TEST_ID"></script>`;

// CI/CD quality-gate snippets. Written to match the real /api/v1/check contract:
// send a `threshold`, branch on `passed`. Kept backtick-free inside (string concat, not
// template literals) so they sit safely inside these template-literal consts.
const GATE_YML = `# .github/workflows/ai-quality-gate.yml
name: AI output quality gate
on: [pull_request]
jobs:
  vraelis-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/check-output.mjs
        env:
          VRAELIS_API_KEY: \${{ secrets.VRAELIS_API_KEY }}`;

const GATE_NODE = `// scripts/check-output.mjs -- block the deploy when output is below the bar
const res = await fetch("https://vraelis.com/api/v1/check", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": process.env.VRAELIS_API_KEY },
  body: JSON.stringify({
    output_type: "support_reply",
    candidates: [generatedReply],                    // the output you're about to ship
    threshold: { overall: 75, criteria: { accuracy: 80 } },
  }),
});
const out = await res.json();
if (!res.ok) { console.error("check error:", out.error && out.error.message); process.exit(1); }
if (!out.passed) {
  console.error("Blocked: version " + out.gate.evaluated.label + " is below the bar.");
  out.gate.criteria.filter(c => !c.passed)
    .forEach(c => console.error("  " + c.label + ": " + c.score + " < " + c.min));
  out.flags.filter(f => f.severity === "high")
    .forEach(f => console.error("  fix: " + f.fix));
  process.exit(1);
}
console.log("passed the quality gate");`;

const GATE_PY = `# check_output.py -- fail CI when generated output is below the bar
import os, sys, requests

r = requests.post(
    "https://vraelis.com/api/v1/check",
    headers={"x-api-key": os.environ["VRAELIS_API_KEY"]},
    json={
        "output_type": "marketing_copy",
        "candidates": [generated_copy],
        "threshold": {"overall": 75},
    },
)
data = r.json()
if not r.ok:
    print("check error:", data.get("error", {}).get("message")); sys.exit(1)
if not data["passed"]:
    print("Blocked by the Vraelis quality gate:")
    for c in data["gate"]["criteria"]:
        if not c["passed"]:
            print("  " + c["label"] + ": " + str(c["score"]) + " < " + str(c["min"]))
    sys.exit(1)
print("passed")`;


function Code({ children, label = "shell" }: { children: string; label?: string }) {
  return (
    <div>
      <div className="codebar"><i /><i /><i /><span>{label}</span></div>
      <pre className="codeblock"><code>{children}</code></pre>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(28px, 4vw, 44px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Quality gate for AI output</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 880, margin: "0 auto 16px" }}>The <span className="em">quality gate</span> for your AI output.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 14px", textAlign: "center", maxWidth: 720 }}>POST the output your app generates and get a structured check back in one call: <strong style={{ color: "var(--fg-1)" }}>per-criterion scores</strong>, the version to ship, and <strong style={{ color: "var(--fg-1)" }}>line-level flags with fixes</strong>. Set a <strong style={{ color: "var(--fg-1)" }}>threshold</strong> and it returns <code style={{ fontFamily: "var(--font-code, monospace)" }}>passed: true|false</code>, so you can catch bad output in CI before it ships. Calibrated against real humans, the part an observability tool structurally can&apos;t give you.</p>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", margin: "0 auto 22px" }}>POST /api/v1/check + threshold → passed + scores + flags → block the deploy or apply fixes → (optional) validate on real people</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/sandbox" className="btn btn--lg">Open sandbox console</Link>
            <Link href="/schemas/decision-package-v2.json" className="btn btn--ghost btn--lg">Decision Package schema</Link>
            <Link href="/enterprise" className="btn btn--ghost btn--lg">Enterprise &amp; security</Link>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-5)", marginTop: 14 }}>Sign in to test the API: full SDK and curl examples live in the signed-in sandbox console.</p>
        </div>
      </section>

      {/* CI/CD quality gate — the reposition, up front with copy-paste snippets */}
      <section id="quality-gate" className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <p className="eyebrow">CI/CD quality gate</p>
            <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Fail the build when the AI output is bad.</h2>
            <p>Send a <code style={{ fontFamily: "var(--font-code, monospace)" }}>threshold</code> and the check returns <code style={{ fontFamily: "var(--font-code, monospace)" }}>passed: true|false</code> alongside the scores and flags. Wire it into a GitHub Action or a pre-deploy step and block the release when generated output scores below your bar. One call, no dashboard to watch.</p>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>1 · GitHub Action</div>
              <Code label="yaml">{GATE_YML}</Code>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>2 · Node pre-deploy script</div>
              <Code label="node">{GATE_NODE}</Code>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>or · Python pre-deploy script</div>
              <Code label="python">{GATE_PY}</Code>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "16px 0 0", lineHeight: 1.7 }}>Gate a whole release at once: POST <code style={{ fontFamily: "var(--font-code, monospace)" }}>{"{ items: [ ... ] }"}</code> with up to 10 outputs and get a <code style={{ fontFamily: "var(--font-code, monospace)" }}>passed</code> per item plus a batch-level verdict. It&apos;s 1 credit per output, and you&apos;re never charged for a check that fails to run. For a hard gate, require <code style={{ fontFamily: "var(--font-code, monospace)" }}>passed !== false</code> and <code style={{ fontFamily: "var(--font-code, monospace)" }}>ok_count === count</code>.</p>
        </div>
      </section>

      {/* Platform flow */}
      <section className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 22 }}><p className="eyebrow">The platform</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>One call to check. A human-eval pipeline behind it.</h2><p>The check returns instantly from one API call. When you want to be sure, the same platform routes the output to real people and returns a governed Decision Package.</p></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {["POST output", "Instant AI check", "Scores + flags + fixes", "Apply fixes", "Validate on real people (optional)", "Signed webhook", "Export"].map((s, i, a) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="chip" style={{ fontSize: 12.5 }}>{s}</span>
                {i < a.length - 1 && <span style={{ color: "var(--fg-5)" }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Infrastructure surfaces */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 24 }}><p className="eyebrow">Infrastructure surfaces</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Access layers over one platform.</h2><p>The API, SDK, webhooks, and embed are how you reach the platform. The primary output is the check; human validation returns a Decision Package.</p></div>
          <div className="tile-grid cols-3">
            {[
              ["Check API", "POST output to /api/v1/check for an instant result. Create human validation runs, fetch, and export. Per-key rate limits, stable error envelopes."],
              ["TypeScript SDK", "A typed client for create / fetch / export / webhook verification, matching the schema. In the repo today."],
              ["Signed webhooks", "An HMAC-signed completion webhook fires the moment an evaluation fills: retried, idempotent, no polling."],
              ["Sandbox", "Exercise the whole flow at 0 credits / 0 quota, isolated from production, before you spend."],
              ["Embedded validation surface", "One optional way to collect human signal. It calibrates a check; the primary output is the check result."],
              ["Decision Package schema", "A public JSON Schema for the human-validation result, for typed integrations. Not a raw tally."],
              ["Audit events", "Governance actions recorded as a safe, exportable trail: no secrets, tokens, or ids."],
              ["Governed access", "Organizations, verified domains, OIDC SSO, and role-separated, client-safe sharing."],
            ].map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}><div className="acard__t">{t}</div><div className="acard__d">{d}</div></div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>The AI output check, calibrated on real people. Not a polling or survey widget, and not a traffic or ad network. The primary output is the check; human validation returns a governed Decision Package.</p>
        </div>
      </section>

      {/* Decision Package + preview */}
      <section id="decision-package" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Decision Package v2</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>A structured result your product can use.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>Every evaluation returns a typed <code style={{ fontFamily: "var(--font-code, monospace)" }}>decision_package</code>: the recommended output, preference margin, directional confidence, signal quality, evaluation health, audience fit, and source quality, plus the next action. It&apos;s <strong style={{ color: "var(--fg-1)" }}>backed by a public JSON Schema</strong> for typed integrations.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/schemas/decision-package-v2.json" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Decision Package v2 JSON Schema →</Link>
                <Link href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Preview one in the console →</Link>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Preview</div>
              <Code label="typescript">{PREVIEW}</Code>
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 10, lineHeight: 1.6 }}>Directional confidence from qualified human signal, not a guarantee of conversion lift, and not a substitute for statistical or legal research.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sandbox */}
      <section id="sandbox" className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Sandbox</p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Test the full flow before spending credits.</h2>
          <p className="lead-copy" style={{ marginBottom: 16 }}>Create a sandbox evaluation to exercise create → decision package → export → signed webhook end-to-end. Sandbox evaluations <strong style={{ color: "var(--fg-1)" }}>charge 0 credits, use 0 quota</strong>, and never appear in your production analytics; they&apos;re clearly separated from real evaluations and labeled <code style={{ fontFamily: "var(--font-code, monospace)" }}>mode: sandbox</code>. Production uses real qualified human signal.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/app/sandbox" className="btn">Open sandbox console</Link>
            <Link href="/app/api-keys" className="btn btn--ghost">Create API key</Link>
          </div>
        </div>
      </section>

      {/* First integration: action-oriented numbered flow */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">First integration</p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>From zero to a passing check in a few steps.</h2>
          <p className="lead-copy" style={{ marginBottom: 22 }}>No contract and no sales call: just an API key and one POST. Human validation is available on the same platform when you want to calibrate a check against real people.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              ["Get an API key", "Create a key in the console. Authenticate with X-Api-Key or Authorization: Bearer on every call."],
              ["POST your output to /api/v1/check", "Send the AI output plus its type and, optionally, your quality threshold. 1 credit per output, and you're never charged for a check that fails to run."],
              ["Read the result", "Get per-criterion scores, flagged issues, and line-level fixes back instantly, plus passed when you set a threshold, so you can gate a deploy on it."],
              ["Batch a whole release", "POST { items: [ ... ] } with up to 10 outputs for one passed per item and a batch-level verdict. Same call, same envelope."],
              ["Calibrate on real people (optional)", "When a check matters, route the output to qualified human validators on the same platform and get a governed Decision Package back over a signed webhook."],
            ].map(([title, desc], i) => (
              <div key={title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
                <div style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "50%", background: "var(--acc)", color: "#fff", fontWeight: 700, fontSize: 13, flex: "none" }}>{i + 1}</div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, color: "var(--fg-1)" }}>{title}</h3>
                  <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "20px 0 0", lineHeight: 1.6 }}>The check is one POST to <code style={{ fontFamily: "var(--font-code, monospace)" }}>/api/v1/check</code>; a curl example is above. The SDK also wraps the human-validation flow: <code style={{ fontFamily: "var(--font-code, monospace)" }}>evaluations.create / get / exportJson / exportCsv</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>webhooks.verifySignature</code>. Full SDK and curl examples live in the signed-in sandbox console.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <Link href="/app/api-keys" className="btn">Get an API key</Link>
            <Link href="/app/sandbox" className="btn btn--ghost">Open sandbox console</Link>
          </div>
        </div>
      </section>

      {/* Webhooks + Exports (prose, no code dump) */}
      <section id="webhooks" className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Signed webhooks</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Know the moment a result is ready.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>A signed completion webhook (event <code style={{ fontFamily: "var(--font-code, monospace)" }}>test.completed</code>) delivers a compact Decision Package the instant an evaluation fills. Each delivery is HMAC-SHA256 signed (timestamp + body), retried with backoff on transient failures, and idempotent by delivery id. Verify it with the SDK helper or your own HMAC check.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/app/api-keys#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Add an endpoint →</Link>
                <Link href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Send a test event →</Link>
              </div>
            </div>
            <div>
              <p className="eyebrow">Exports</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Pull results into your stack.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>Export any completed evaluation as <strong style={{ color: "var(--fg-1)" }}>tiered JSON</strong> (summary, standard, or scale; each carrying the decision package) or a stable <strong style={{ color: "var(--fg-1)" }}>CSV</strong> breakdown. Owner or API-key auth. Exports never include account email, participant identities, or raw IP/device data.</p>
              <Link href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Test exports in the console →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quality controls: the moat, only what the code does */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <div className="sec-head" style={{ marginBottom: 22 }}>
            <p className="eyebrow">Quality controls</p>
            <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>You get signal, not raw responses.</h2>
            <p>The reason human-eval data is painful isn&apos;t collecting it; it&apos;s trusting it. Vraelis rejects low-quality and gamed responses automatically, on every judgment, before they ever reach your Decision Package.</p>
          </div>
          <div className="tile-grid cols-3">
            {[
              ["Time-on-task floor", "Responses faster than a real consideration are rejected."],
              ["Gibberish & spam filtering", "Low-effort and nonsense reasoning is dropped automatically."],
              ["IP velocity limits", "Cross-evaluation vote-stuffing from one source is capped."],
              ["Per-device caps", "Embedded collection enforces a per-device daily limit."],
              ["Reputation gating", "Evaluators whose responses are mostly rejected get gated out."],
              ["Pre-judgment screening", "Qualify who judges with screening questions before they answer."],
            ].map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}><div className="acard__t">{t}</div><div className="acard__d">{d}</div></div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>Every run reports valid-vs-filtered counts and filter reasons, so you can audit signal quality programmatically. Rejected responses are recorded for transparency but never count toward your result, and you&apos;re never charged for them.</p>
        </div>
      </section>

      {/* Data warehouse and ML integrations (future) */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Data warehouse &amp; ML platform integrations <span className="pill" style={{ marginLeft: 8, fontSize: 10.5 }}>future direction</span></p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Route decisions into your analytics and ML stack.</h2>
          <p className="lead-copy" style={{ marginBottom: 12 }}>Teams can route Decision Package outputs into internal analytics, ML evaluation, or data warehouse systems. Native integrations with data warehouses and ML platforms are planned after the core API and governance layer are stable.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.7 }}>Today, export to JSON or CSV, or consume the Decision Package via signed webhooks, enough to pipe decisions into your own warehouse or pipeline now. Databricks-style warehouse and ML workflows are a future integration direction, not live yet.</p>
        </div>
      </section>

      {/* SDK starter */}
      <section id="sdk" className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">TypeScript SDK <span className="pill" style={{ marginLeft: 8, fontSize: 10.5 }}>SDK starter · coming soon to npm</span></p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>A typed client for the whole flow.</h2>
          <p className="lead-copy" style={{ marginBottom: 14 }}>Create sandbox evaluations, fetch typed Decision Packages, export results, and verify webhooks, with TypeScript types that match the JSON Schema. The SDK starter is <strong style={{ color: "var(--fg-1)" }}>available in the repository</strong> today and <strong style={{ color: "var(--fg-1)" }}>not on npm yet</strong>.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 16, lineHeight: 1.6 }}>Methods: <code style={{ fontFamily: "var(--font-code, monospace)" }}>evaluations.create / get / exportJson / exportCsv</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>credits.get</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>webhooks.verifySignature</code>. Coming soon: <code style={{ fontFamily: "var(--font-code, monospace)" }}>npm install @vraelis/sdk</code>. Full SDK and curl examples live in the signed-in sandbox console.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/app/sandbox" className="btn">Open sandbox console</Link>
            <Link href="/schemas/decision-package-v2.json" className="btn btn--ghost">JSON Schema</Link>
          </div>
        </div>
      </section>

      {/* Security / privacy */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Security &amp; privacy</p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Safe by design.</h2>
          <p className="lead-copy" style={{ marginBottom: 12 }}>API keys are server-side secrets, shown once and stored only as a hash. Errors use a stable envelope with a request id, never secrets or stack traces. Per-key rate limiting protects the API. Results and webhooks never include account email, participant identities, raw IP/device data, share tokens, or private fields.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6 }}>Decision Package v2 is backed by a public JSON Schema for typed integrations. Source, audience, and signal quality are captured privacy-safely: channel and hostname only, never full referrers or personal data.</p>
        </div>
      </section>

      {/* Enterprise readiness */}
      <section id="enterprise" className="section">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <div className="sec-head" style={{ marginBottom: 28 }}>
            <p className="eyebrow">Enterprise readiness</p>
            <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Built for governed decision workflows.</h2>
            <p>Decision infrastructure for teams that need accountability, not just an answer.</p>
          </div>
          <div className="tile-grid cols-2">
            {[
              ["Role-based workspace access", "Admin, Editor, Viewer, and client roles scope exactly what each person can see and do."],
              ["Client-safe report sharing", "Share decision reports with clients by token; private controls, costs, and participant data never leak."],
              ["Workspace activity log", "A read-only audit trail of member, project-access, billing, and ownership changes for accountability."],
              ["Billing admin separation", "Delegate billing to an admin without handing over workspace ownership or data."],
              ["Signed webhooks & API keys", "HMAC-signed deliveries and hashed, server-side keys for reliable, secure integration."],
              ["Project-level access control", "Grant access per project, so collaborators and clients only see the decisions they should."],
            ].map(([t, d]) => (
              <div key={t} className="acard">
                <h3 style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", marginBottom: 6 }}>{t}</h3>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "22px 0 0", lineHeight: 1.7, textAlign: "center" }}>SSO-ready organizations with verified domains and audited provisioning. OIDC single sign-on is available for verified organization domains today; SAML configuration is in preview and SCIM is on the roadmap. <Link href="/contact" style={{ color: "var(--acc-deep)" }}>Contact us for enterprise SSO requirements →</Link></p>
        </div>
      </section>

      {/* Embed (compact) */}
      <section id="embed" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Embedded evaluation surface: one collection option</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Collect signal anywhere. The output is the Decision Package.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>The embed is one way to collect qualified human signal, alongside the web console and the API. Whatever the channel, the platform output is the same governed Decision Package. Low-quality responses are filtered automatically.</p>
              <Code label="html">{EMBED}</Code>
            </div>
            <div className="win">
              <div className="win__bar"><div className="win__dots"><i /><i /><i /></div><span className="win__addr">your-site.com</span></div>
              <div style={{ padding: 18, background: "var(--bg-1)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Which candidate should ship?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ aspectRatio: "1/1", borderRadius: 10, border: "2px solid var(--acc)", background: "linear-gradient(135deg, var(--acc-soft), #fff)" }} />
                  <div style={{ aspectRatio: "1/1", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)" }} />
                </div>
                <div style={{ padding: "10px", borderRadius: 8, background: "var(--acc)", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 13 }}>Submit judgment</div>
                <div style={{ textAlign: "center", marginTop: 8, fontSize: 10.5, color: "var(--acc-deep)", fontWeight: 600 }}>Powered by Vraelis</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases + CTA */}
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap">
          <p className="eyebrow">Use cases</p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Integrate the check into your build and ship loop.</h2>
          <p className="lead-copy" style={{ maxWidth: 640, marginBottom: 26 }}>POST the output your app, model, or pipeline generates. Vraelis returns scores, the version to ship, and line-level fixes; run it in CI, in-product, or on a review step, and validate on real people whenever a call is worth confirming.</p>
          <div className="cols-3" style={{ gap: 14, marginBottom: 28 }}>
            {[
              ["Gate in CI", "POST generated output with a threshold and fail the build when passed is false. Catch a regression before it ships."],
              ["In-product checks", "Score and fix output before your app shows it to a user, in one call."],
              ["Validate the gate", "Route the same output to real people and track how often they agree with the check over time."],
            ].map(([t, d]) => (
              <div key={t} className="card"><h3 style={{ fontSize: 16, marginBottom: 6 }}>{t}</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</p></div>
            ))}
          </div>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/sandbox" className="btn btn--lg">Open sandbox console →</Link>
            <Link href="/app/api-keys" className="btn btn--ghost btn--lg">Create an API key</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

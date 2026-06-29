import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers — API-native human signal for AI evaluation",
  description: "The human-evaluation API for AI teams. Submit candidate model outputs, collect quality-filtered human judgment, and retrieve a structured Decision Package v2 — through API, SDK, signed webhooks, or JSON/CSV export. Sandbox before you spend. Backed by a public JSON Schema.",
  path: "/developers",
});

// One small, honest preview — exact SDK/curl flows live in the signed-in console.
const PREVIEW = `const result = await vraelis.evaluations.get(id)
result.decision_package.decision.recommended_output  // "B"`;

const EMBED = `<script async src="https://vraelis.com/embed.js"
        data-vraelis-test="YOUR_TEST_ID"></script>`;


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
          <p className="eyebrow" style={{ justifyContent: "center" }}>Developer platform</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 880, margin: "0 auto 16px" }}>API-native human signal for <span className="em">AI evaluation workflows</span>.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 14px", textAlign: "center", maxWidth: 720 }}>Submit candidate model outputs, define the judgment, collect <strong style={{ color: "var(--fg-1)" }}>quality-filtered human judgment</strong>, and return a typed <strong style={{ color: "var(--fg-1)" }}>Decision Package</strong> — through API, SDK, signed webhooks, or JSON/CSV export. Built to live inside an eval pipeline, not a browser tab.</p>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", margin: "0 auto 22px" }}>submit candidates → define judgment → collect filtered signal → Decision Package → webhook / export</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/sandbox" className="btn btn--lg">Open sandbox console</a>
            <a href="/schemas/decision-package-v2.json" className="btn btn--ghost btn--lg">Decision Package schema</a>
            <a href="/security" className="btn btn--ghost btn--lg">Enterprise trust</a>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-5)", marginTop: 14 }}>Sign in to test the API — full SDK and curl examples live in the signed-in sandbox console.</p>
        </div>
      </section>

      {/* Platform flow */}
      <section className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 22 }}><p className="eyebrow">The platform</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>An eval pipeline, not a request/response toy.</h2><p>Every evaluation flows through the same governed pipeline — submit, define the judgment, collect, filter, decide — whatever surface you call it from.</p></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {["Submit candidates", "Define judgment", "Collect qualified signal", "Filter low-quality responses", "Assess readiness", "Receive Decision Package", "Webhook / export"].map((s, i, a) => (
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
          <div className="sec-head" style={{ marginBottom: 24 }}><p className="eyebrow">Infrastructure surfaces</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Access layers over one platform.</h2><p>The API, SDK, webhooks, and embed are how you reach the platform — the output is always the Decision Package.</p></div>
          <div className="tile-grid cols-3">
            {[
              ["REST API", "Submit candidates, fetch the Decision Package, export results. Per-key rate limits, stable error envelopes."],
              ["TypeScript SDK", "A typed client for create / fetch / export / webhook verification, matching the schema. In the repo today."],
              ["Signed webhooks", "An HMAC-signed completion webhook fires the moment an evaluation fills — retried, idempotent, no polling."],
              ["Sandbox", "Exercise the whole flow at 0 credits / 0 quota, isolated from production — before you spend."],
              ["Embedded evaluation surface", "One way to collect signal among several. The product output is always the Decision Package."],
              ["Decision Package schema", "A public JSON Schema for typed integrations. The platform output, not a raw tally."],
              ["Audit events", "Governance actions recorded as a safe, exportable trail — no secrets, tokens, or ids."],
              ["Governed access", "Organizations, verified domains, OIDC SSO, and role-separated, client-safe sharing."],
            ].map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}><div className="acard__t">{t}</div><div className="acard__d">{d}</div></div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>A human-evaluation layer for AI and creative decisions — not a polling or survey widget, and not a traffic or ad network. The embed is one collection surface; the product output is the Decision Package and the governed decision record.</p>
        </div>
      </section>

      {/* Decision Package + preview */}
      <section id="decision-package" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Decision Package v2</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>A structured result your product can use.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>Every evaluation returns a typed <code style={{ fontFamily: "var(--font-code, monospace)" }}>decision_package</code>: the recommended output, preference margin, directional confidence, signal quality, evaluation health, audience fit, and source quality — plus the next action. It&apos;s <strong style={{ color: "var(--fg-1)" }}>backed by a public JSON Schema</strong> for typed integrations.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/schemas/decision-package-v2.json" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Decision Package v2 JSON Schema →</a>
                <a href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Preview one in the console →</a>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Preview</div>
              <Code label="typescript">{PREVIEW}</Code>
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 10, lineHeight: 1.6 }}>Directional confidence from qualified human signal — not a guarantee of conversion lift, and not a substitute for statistical or legal research.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sandbox */}
      <section id="sandbox" className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Sandbox</p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Test the full flow before spending credits.</h2>
          <p className="lead-copy" style={{ marginBottom: 16 }}>Create a sandbox evaluation to exercise create → decision package → export → signed webhook end-to-end. Sandbox evaluations <strong style={{ color: "var(--fg-1)" }}>charge 0 credits, use 0 quota</strong>, and never appear in your production analytics — they&apos;re clearly separated from real evaluations and labeled <code style={{ fontFamily: "var(--font-code, monospace)" }}>mode: sandbox</code>. Production uses real qualified human signal.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/app/sandbox" className="btn">Open sandbox console</a>
            <a href="/app/api-keys" className="btn btn--ghost">Create API key</a>
          </div>
        </div>
      </section>

      {/* Webhooks + Exports (prose, no code dump) */}
      <section id="webhooks" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Signed webhooks</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Know the moment a result is ready.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>A signed evaluation-completed webhook delivers a compact Decision Package the instant an evaluation fills. Each delivery is HMAC-SHA256 signed (timestamp + body), retried with backoff on transient failures, and idempotent by delivery id. Verify it with the SDK helper or your own HMAC check.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/app/api-keys#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Add an endpoint →</a>
                <a href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Send a test event →</a>
              </div>
            </div>
            <div>
              <p className="eyebrow">Exports</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Pull results into your stack.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>Export any completed evaluation as <strong style={{ color: "var(--fg-1)" }}>tiered JSON</strong> (summary, standard, or scale — each carrying the decision package) or a stable <strong style={{ color: "var(--fg-1)" }}>CSV</strong> breakdown. Owner or API-key auth. Exports never include account email, participant identities, or raw IP/device data.</p>
              <a href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Test exports in the console →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Quality controls — the moat, only what the code does */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <div className="sec-head" style={{ marginBottom: 22 }}>
            <p className="eyebrow">Quality controls</p>
            <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>You get signal, not raw responses.</h2>
            <p>The reason human-eval data is painful isn&apos;t collecting it — it&apos;s trusting it. Vraelis rejects low-quality and gamed responses automatically, on every judgment, before they ever reach your Decision Package.</p>
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
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", lineHeight: 1.6, textAlign: "center" }}>Every run reports valid-vs-filtered counts and filter reasons, so you can audit signal quality programmatically. Rejected responses are recorded for transparency but never count toward your result — and you&apos;re never charged for them.</p>
        </div>
      </section>

      {/* Data warehouse and ML integrations (future) */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Data warehouse &amp; ML platform integrations <span className="pill" style={{ marginLeft: 8, fontSize: 10.5 }}>future direction</span></p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Route decisions into your analytics and ML stack.</h2>
          <p className="lead-copy" style={{ marginBottom: 12 }}>Teams can route Decision Package outputs into internal analytics, ML evaluation, or data warehouse systems. Native integrations with data warehouses and ML platforms are planned after the core API and governance layer are stable.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.7 }}>Today, export to JSON or CSV, or consume the Decision Package via signed webhooks — enough to pipe decisions into your own warehouse or pipeline now. Databricks-style warehouse and ML workflows are a future integration direction, not live yet.</p>
        </div>
      </section>

      {/* SDK starter */}
      <section id="sdk" className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">TypeScript SDK <span className="pill" style={{ marginLeft: 8, fontSize: 10.5 }}>SDK starter · coming soon to npm</span></p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>A typed client for the whole flow.</h2>
          <p className="lead-copy" style={{ marginBottom: 14 }}>Create sandbox evaluations, fetch typed Decision Packages, export results, and verify webhooks — with TypeScript types that match the JSON Schema. The SDK starter is <strong style={{ color: "var(--fg-1)" }}>available in the repository</strong> today and <strong style={{ color: "var(--fg-1)" }}>not on npm yet</strong>.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 16, lineHeight: 1.6 }}>Methods: <code style={{ fontFamily: "var(--font-code, monospace)" }}>evaluations.create / get / exportJson / exportCsv</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>credits.get</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>webhooks.verifySignature</code>. Coming soon: <code style={{ fontFamily: "var(--font-code, monospace)" }}>npm install @vraelis/sdk</code>. Full SDK and curl examples live in the signed-in sandbox console.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/app/sandbox" className="btn">Open sandbox console</a>
            <a href="/schemas/decision-package-v2.json" className="btn btn--ghost">JSON Schema</a>
          </div>
        </div>
      </section>

      {/* Security / privacy */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Security &amp; privacy</p>
          <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Safe by design.</h2>
          <p className="lead-copy" style={{ marginBottom: 12 }}>API keys are server-side secrets, shown once and stored only as a hash. Errors use a stable envelope with a request id — never secrets or stack traces. Per-key rate limiting protects the API. Results and webhooks never include account email, participant identities, raw IP/device data, share tokens, or private fields.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6 }}>Decision Package v2 is backed by a public JSON Schema for typed integrations. Source, audience, and signal quality are captured privacy-safely — channel and hostname only, never full referrers or personal data.</p>
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
              ["Client-safe report sharing", "Share decision reports with clients by token — private controls, costs, and participant data never leak."],
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
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "22px 0 0", lineHeight: 1.7, textAlign: "center" }}>SSO-ready organizations with verified domains and audited provisioning. OIDC single sign-on is available for verified organization domains today; SAML configuration is in preview and SCIM is on the roadmap. <a href="mailto:nishanth.d1021@gmail.com?subject=Vraelis%20enterprise%20SSO" style={{ color: "var(--acc-deep)" }}>Contact us for enterprise SSO requirements →</a></p>
        </div>
      </section>

      {/* Embed (compact) */}
      <section id="embed" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Embedded evaluation surface — one collection option</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Collect signal anywhere. The output is the Decision Package.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>The embed is one way to collect qualified human signal — alongside the web console and the API. Whatever the channel, the platform output is the same governed Decision Package. Low-quality responses are filtered automatically.</p>
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
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Integrate human evaluation into your decision workflows.</h2>
          <p className="lead-copy" style={{ maxWidth: 640, marginBottom: 26 }}>Submit candidate outputs from your app, model, or pipeline. Vraelis runs the routing, quality filtering, readiness, Decision Packages, webhooks, and exports — you get a structured, audit-ready decision record back, ready to store or route into your own systems.</p>
          <div className="cols-3" style={{ gap: 14, marginBottom: 28 }}>
            {[
              ["Model & agent evaluation", "Compare responses from your model, prompt, or agent — pairwise preference, quality-filtered."],
              ["RLHF & preference data", "Collect human preference judgments on response pairs, exportable into your training pipeline."],
              ["Generative product apps", "Let users pick the best generation in-product, and route the signal back through the API."],
            ].map(([t, d]) => (
              <div key={t} className="card"><h3 style={{ fontSize: 16, marginBottom: 6 }}>{t}</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</p></div>
            ))}
          </div>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/sandbox" className="btn btn--lg">Open sandbox console →</a>
            <a href="/app/api-keys" className="btn btn--ghost btn--lg">Create an API key</a>
          </div>
        </div>
      </section>
    </div>
  );
}

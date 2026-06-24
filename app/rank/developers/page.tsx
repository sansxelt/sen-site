import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers",
  description: "The human-evaluation API for creative and AI outputs. Create sandbox evaluations, retrieve a structured Decision Package v2, export JSON/CSV, and receive signed webhooks. Backed by a public JSON Schema and a TypeScript SDK starter.",
  path: "/developers",
});

// One small, honest preview — exact SDK/curl flows live in the signed-in console.
const PREVIEW = `const result = await vraelis.evaluations.get(id)
result.decision_package.decision.recommended_output  // "B"`;

const EMBED = `<script async src="https://vraelis.com/embed.js"
        data-vraelis-test="YOUR_TEST_ID"></script>`;

const CAPS: [string, string][] = [
  ["Human evaluation API", "Send candidates, get a structured result — recommendation, quality filtering, and confidence — in one authenticated call. No evaluation pipeline to build."],
  ["Decision Package v2", "A typed, portable result: recommended output, preference margin, directional confidence, signal quality, evaluation health, audience fit, and source quality."],
  ["Sandbox mode", "Exercise the whole integration with sample data — 0 credits, 0 quota, never in your production analytics. Labeled mode: sandbox everywhere."],
  ["Signed webhooks", "A signed test.completed fires the moment an evaluation fills — HMAC-verified, retried with backoff, idempotent by delivery id. No polling."],
  ["JSON & CSV exports", "Pull qualified human signal into dashboards, training pipelines, or your product. Tiered JSON or a stable CSV breakdown."],
  ["Source, audience & signal quality", "Privacy-safe channel quality, audience-fit screening, and automatic low-quality response filtering — built into every result."],
  ["TypeScript SDK starter", "A typed client for create, fetch, export, and webhook verification, matching the Decision Package schema. Coming soon to npm."],
  ["Public JSON Schema", "Decision Package v2 is backed by a public JSON Schema, so you can validate and type your integration directly."],
];

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
          <p className="eyebrow" style={{ justifyContent: "center" }}>Developers</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 840, margin: "0 auto 16px" }}>The <span className="em">human evaluation API</span> for creative and AI outputs.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 14px", textAlign: "center" }}>Send candidates to Vraelis and receive a structured <strong style={{ color: "var(--fg-1)" }}>decision package</strong> built from qualified human signal — a recommendation, quality filtering, audience fit, and confidence your product can act on. Test the whole flow in sandbox before spending a credit.</p>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", margin: "0 auto 22px" }}>Create sandbox evaluation → fetch Decision Package → receive signed webhook</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/sandbox" className="btn btn--lg">Open sandbox console</a>
            <a href="/schemas/decision-package-v2.json" className="btn btn--ghost btn--lg">View JSON Schema</a>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-5)", marginTop: 14 }}>Sign in to test the API — full SDK and curl examples live in the signed-in sandbox console.</p>
        </div>
      </section>

      {/* Capabilities */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head"><p className="eyebrow">Platform</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Structured human signal, built for products.</h2></div>
          <div className="tile-grid cols-3">
            {CAPS.map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
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
              <p className="lead-copy" style={{ marginBottom: 12 }}>A signed <code style={{ fontFamily: "var(--font-code, monospace)" }}>test.completed</code> webhook delivers a compact Decision Package the instant an evaluation fills. Each delivery is HMAC-SHA256 signed (timestamp + body), retried with backoff on transient failures, and idempotent by delivery id. Verify it with the SDK helper or your own HMAC check.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/app/api-keys#webhooks" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Add an endpoint →</a>
                <a href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Send a test event →</a>
              </div>
            </div>
            <div>
              <p className="eyebrow">Exports</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Pull results into your stack.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>Export any completed evaluation as <strong style={{ color: "var(--fg-1)" }}>tiered JSON</strong> (summary, standard, or scale — each carrying the decision package) or a stable <strong style={{ color: "var(--fg-1)" }}>CSV</strong> breakdown. Owner or API-key auth. Exports never include account email, voter identities, or raw IP/device data.</p>
              <a href="/app/sandbox" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Test exports in the console →</a>
            </div>
          </div>
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
          <p className="lead-copy" style={{ marginBottom: 12 }}>API keys are server-side secrets, shown once and stored only as a hash. Errors use a stable envelope with a request id — never secrets or stack traces. Per-key rate limiting protects the API. Results and webhooks never include account email, voter identities, raw IP/device data, share tokens, or private fields.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6 }}>Decision Package v2 is backed by a public JSON Schema for typed integrations. Source, audience, and signal quality are captured privacy-safely — channel and hostname only, never full referrers or personal data.</p>
        </div>
      </section>

      {/* Embed (compact) */}
      <section id="embed" className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Embeddable evaluation widget</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>One line. Human signal anywhere.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>Drop a Vraelis evaluation into your site, app, or community with one script tag and collect qualified judgments. Low-quality responses are filtered automatically.</p>
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
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Make human evaluation a feature your users pay for.</h2>
          <p className="lead-copy" style={{ maxWidth: 640, marginBottom: 26 }}>Add an &ldquo;evaluate with real people&rdquo; action to your app. Vraelis runs the routing, quality filtering, decision packages, webhooks, and exports — you offer it as a premium feature and get structured preference data back.</p>
          <div className="cols-3" style={{ gap: 14, marginBottom: 28 }}>
            {[
              ["AI image tools", "Let users pick the best generation before download. Learn which styles win."],
              ["Copy & content apps", "Test headline, hook, or caption variants with real readers."],
              ["Design & brand platforms", "Validate logos, palettes, and layouts with an audience, in-product."],
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

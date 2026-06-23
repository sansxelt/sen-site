import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers",
  description: "Human evaluation API for creative and AI outputs. Create evaluation runs, collect human signal, receive signed webhooks, and pull schema-versioned results.",
  path: "/developers",
});

const CURL = `curl https://vraelis.com/api/v1/tests \\
  -H "X-Api-Key: vr_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Which thumbnail wins?",
    "category": "thumbnail",
    "votes": 100,
    "options": [
      { "image_url": "https://cdn.you/a.jpg" },
      { "image_url": "https://cdn.you/b.jpg" }
    ]
  }'`;

const POLL = `curl https://vraelis.com/api/v1/tests/{id} \\
  -H "X-Api-Key: vr_live_..."
# → { status, votes_valid, winner, ranked, report }`;

const EMBED = `<script async src="https://vraelis.com/embed.js"
        data-vraelis-test="YOUR_TEST_ID"></script>`;

const EXPORT_CURL = `curl "https://vraelis.com/api/v1/tests/{id}/export?format=json" \\
  -H "X-Api-Key: vr_live_..."
# CSV breakdown: ?format=csv`;

const WEBHOOK_PAYLOAD = `POST https://your-app.com/webhooks/vraelis
X-Vraelis-Event: test.completed
X-Vraelis-Signature: sha256=…
X-Vraelis-Timestamp: 1718…
X-Vraelis-Delivery: <uuid>

{
  "event": "test.completed",
  "delivery_id": "…",
  "test": {
    "id": "…", "title": "Which thumbnail?",
    "status": "completed",
    "votes_valid": 100, "votes_filtered": 8,
    "winner": { "option": "B", "pct": 67 }
  },
  "decision_package": {
    "schema_version": "v2", "mode": "production",
    "recommended_output": "B", "directional_confidence": "Strong",
    "signal_quality": "Clean signal", "evaluation_health": "Ready to decide",
    "audience_fit": "Strong fit"
  },
  "links": {
    "export_json": "https://vraelis.com/api/v1/tests/{id}/export?format=json",
    "export_csv":  "https://vraelis.com/api/v1/tests/{id}/export?format=csv"
  }
}`;

const WEBHOOK_VERIFY = `import crypto from "crypto";

// X-Vraelis-Timestamp + raw request body
const expected = "sha256=" + crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex");

const ok = crypto.timingSafeEqual(
  Buffer.from(expected), Buffer.from(signature));
// then GET links.export_json with your X-Api-Key.`;

const EXPORT_SHAPE = `{
  "test_id": "…", "title": "Which thumbnail?",
  "status": "complete",
  "votes_valid": 122, "votes_filtered": 14,
  "winner": { "option": "B", "pct": 61 },
  "options": [ { "option": "A", "votes": 47, "pct": 39 }, … ],
  "comments": [ { "option": "B", "reason": "cleaner" } ],
  "analysis": { "summary": "…", "confidence": "high" },
  "quality": { "valid": 122, "filtered": 14,
    "filtered_reasons": { "too_fast": 9, "spam_comment": 5 } }
}`;

const DECISION_PKG = `{
  "decision_package": {
    "schema_version": "v2",
    "test_id": "…",
    "decision": {
      "recommended_output": "B",
      "winner_label": "Hero B",
      "preference_margin": 26,
      "directional_confidence": "Strong",
      "signal_quality": "Clean signal",
      "evaluation_health": "Ready to decide",
      "action_recommendation": "Ship Option B."
    },
    "counts": { "valid_judgments": 240, "filtered_responses": 31, "filter_rate": 11 },
    "audience": { "screening_enabled": true, "qualification_rate": 82, "audience_fit": "Strong fit" },
    "source_quality": [
      { "source": "instagram", "valid_judgments": 140, "filter_rate": 8 },
      { "source": "discord", "valid_judgments": 100, "filter_rate": 19 }
    ]
  }
}`;

const SANDBOX_CURL = `# Create a SANDBOX evaluation — no credits, sample decision package.
curl https://vraelis.com/api/v1/tests \\
  -H "X-Api-Key: vr_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Sandbox hero test",
    "category": "landing",
    "sandbox": true,
    "options": [ { "text": "Hero A" }, { "text": "Hero B" } ]
  }'
# → { "id": "…", "status": "complete", "sandbox": true, "mode": "sandbox", "credits_charged": 0 }

# Then fetch the sample decision package (same endpoints as production):
curl https://vraelis.com/api/v1/tests/{id} -H "X-Api-Key: vr_live_..."
curl "https://vraelis.com/api/v1/tests/{id}/export?format=json" -H "X-Api-Key: vr_live_..."`;

const TS_TYPES = `export type DecisionConfidence = "Strong" | "Moderate" | "Tentative" | "None";
export type SignalQuality = "Clean signal" | "Limited signal" | "Needs more signal";
export type EvaluationHealth =
  | "Collecting" | "Ready to decide" | "Needs more judgments"
  | "Noisy signal" | "Too close to call" | "Low-quality traffic";
export type AudienceFit = "Strong fit" | "Mixed fit" | "Limited fit" | "Not screened";

export interface SourceQualityBreakdown {
  source: string; label?: string;
  total_responses: number; valid_judgments: number;
  filtered_responses: number; filter_rate: number; clean_signal_percent: number;
}

export interface DecisionPackageV2 {
  schema_version: "v2";
  mode: "production" | "sandbox";
  test_id: string;
  decision: {
    recommended_output: string | null;
    winner_label: string | null;
    preference_margin: number | null;
    directional_confidence: DecisionConfidence;
    signal_quality: SignalQuality | null;
    evaluation_health: EvaluationHealth;
    action_recommendation: string | null;
  };
  counts: { valid_judgments: number; filtered_responses: number; total_responses: number; filter_rate: number };
  options: { option_id: string; label: string | null; count: number; share: number; rank: number }[];
  audience?: { screening_enabled: boolean; qualification_rate: number | null; audience_fit: AudienceFit };
  source_quality?: SourceQualityBreakdown[];
}`;

const ERROR_EXAMPLE = `{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid API key.",
    "request_id": "req_9f2a3c…"
  }
}`;

const ERROR_CODES: [string, string, string][] = [
  ["unauthorized", "401", "Missing or invalid API key."],
  ["forbidden", "403", "Plan or scope doesn't allow this."],
  ["validation_error", "400", "The request body was invalid."],
  ["insufficient_credits", "402", "Not enough credits for this evaluation."],
  ["not_found", "404", "No resource with that id."],
  ["rate_limited", "429", "Too many requests; retry after the window."],
  ["internal_error", "500", "Something went wrong on our side."],
];

const QUICKSTART: [string, string, string][] = [
  ["1", "Create an API key", "On the API keys page. Store it server-side only."],
  ["2", "Create an evaluation run", "POST /api/v1/tests with your candidate options."],
  ["3", "Collect human signal", "Share or embed the run; real people evaluate it."],
  ["4", "Receive a webhook", "A signed test.completed fires when it fills."],
  ["5", "Fetch the result", "GET the test, or export JSON/CSV."],
  ["6", "Use the recommendation", "Read recommended_output and the intelligence fields in your app."],
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
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(28px, 4vw, 44px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Developers</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 820, margin: "0 auto 16px" }}>The <span className="em">human evaluation API</span> for creative and AI outputs.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 24px", textAlign: "center" }}>Instead of building a human-evaluation pipeline from scratch, send candidates to Vraelis and receive a structured result your app can use — a recommendation, quality filtering, reasoning, and confidence. One API call or an embed widget.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/api-keys" className="btn btn--lg">Create an API key</a>
            <a href="#embed" className="btn btn--ghost btn--lg">Embed widget</a>
          </div>
        </div>
      </section>

      {/* Quickstart + Authentication */}
      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <div className="sec-head"><p className="eyebrow">Quickstart</p><h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>From key to recommendation in six steps.</h2></div>
          <div className="tile-grid cols-3">
            {QUICKSTART.map(([n, t, d]) => (
              <div key={n} className="acard" style={{ gap: 6 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--acc-deep)" }}>{n}</div>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 18 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Authentication</div>
            <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}>Send your key as <code style={{ fontFamily: "var(--font-code, monospace)" }}>X-Api-Key: vr_live_…</code> or <code style={{ fontFamily: "var(--font-code, monospace)" }}>Authorization: Bearer vr_live_…</code>. Keep keys <strong style={{ color: "var(--fg-1)" }}>server-side only</strong> — never ship them in frontend code. The full secret is shown once at creation; after that only the prefix is shown and logged. Rotate or revoke a key immediately if it leaks. Keys carry scopes (<code style={{ fontFamily: "var(--font-code, monospace)" }}>tests:write</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>tests:read</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>credits:read</code>) enforced per endpoint.</p>
          </div>
        </div>
      </section>

      {/* API */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">REST API</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 14 }}>Send candidates, get a structured result.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Authenticate with an API key, POST your creative candidates (image URLs or text), and poll for the structured result and report. Built for AI image tools, copy generators, and creative platforms.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {["X-Api-Key auth (vr_live_…)", "Create + launch an evaluation in one call", "Poll status, the recommended output & report", "No eval pipeline to build — filtering, reasoning, exports & webhooks included"].map((x) => <li key={x} style={{ display: "flex", gap: 9, fontSize: 14.5, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</li>)}
              </ul>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 14, lineHeight: 1.6 }}>Each evaluation is a <code style={{ fontFamily: "var(--font-code, monospace)" }}>/tests</code> resource in the API (kept stable for compatibility); conceptually it&apos;s an evaluation run: submit candidates, collect human signal, get a recommendation.</p>
              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="pill">API access on Scale</span>
                <a href="#sandbox" className="pill" style={{ textDecoration: "none" }}>Sandbox mode</a>
                <a href="/schemas/decision-package-v2.json" className="pill" style={{ textDecoration: "none" }}>JSON Schema</a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Create a test</div><Code>{CURL}</Code></div>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Get the result</div><Code>{POLL}</Code></div>
            </div>
          </div>
        </div>
      </section>

      {/* Errors */}
      <section id="errors" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Errors</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Predictable error responses.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>Every <code style={{ fontFamily: "var(--font-code, monospace)" }}>/api/v1</code> error uses the same envelope: a stable <code style={{ fontFamily: "var(--font-code, monospace)" }}>error.code</code>, a human message, and a <code style={{ fontFamily: "var(--font-code, monospace)" }}>request_id</code> for support. Branch on the code, not the message.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                {ERROR_CODES.map(([code, status, desc]) => (
                  <li key={code} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--fg-2)", alignItems: "baseline" }}>
                    <code style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12.5, color: "var(--acc-deep)", minWidth: 150 }}>{code}</code>
                    <span style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12, color: "var(--fg-4)" }}>{status}</span>
                    <span style={{ color: "var(--fg-3)" }}>{desc}</span>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 14, lineHeight: 1.6 }}>Rate limit: 120 requests per 60 seconds per key. A <code style={{ fontFamily: "var(--font-code, monospace)" }}>429</code> includes a <code style={{ fontFamily: "var(--font-code, monospace)" }}>Retry-After</code> header. Errors never include secrets, keys, or stack traces.</p>
            </div>
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Error shape</div><Code label="json">{ERROR_EXAMPLE}</Code></div>
          </div>
        </div>
      </section>

      {/* Export */}
      <section id="export" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 660, marginBottom: "clamp(20px, 3vw, 32px)" }}>
            <p className="eyebrow">Preference data exports</p>
            <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Pull preference data into your product.</h2>
            <p className="lead-copy">Pull results into dashboards, training pipelines, analytics, or your product. JSON or CSV. Owner or API key auth.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, alignItems: "start" }} className="cols-stack">
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Export JSON or CSV</div><Code>{EXPORT_CURL}</Code></div>
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Response shape</div><Code>{EXPORT_SHAPE}</Code></div>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 14, maxWidth: 720 }}>Includes the winner, judgment breakdown, percentages, <strong style={{ color: "var(--fg-2)" }}>valid vs filtered</strong> response quality, comments, and the AI analysis. Never includes account email, voter identities, or raw IP/device data.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 10, maxWidth: 720 }}><strong style={{ color: "var(--fg-2)" }}>Export tiers.</strong> Add <code style={{ fontFamily: "var(--font-code, monospace)" }}>tier=summary</code> for a basic result, <code style={{ fontFamily: "var(--font-code, monospace)" }}>tier=standard</code> (the default) for the full report, or <code style={{ fontFamily: "var(--font-code, monospace)" }}>tier=scale</code> for the developer export (adds quality detail, this test&apos;s webhook and export counts, and a machine-readable <code style={{ fontFamily: "var(--font-code, monospace)" }}>schema_version</code>). JSON always carries <code style={{ fontFamily: "var(--font-code, monospace)" }}>schema_version</code>; CSV is the same option-row breakdown across tiers. Account-level and governed cohort datasets are Enterprise (contact sales).</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 10, maxWidth: 720 }}><strong style={{ color: "var(--fg-2)" }}>Evaluation intelligence.</strong> Every JSON export carries an <code style={{ fontFamily: "var(--font-code, monospace)" }}>intelligence</code> object you can act on directly: <code style={{ fontFamily: "var(--font-code, monospace)" }}>decision_summary</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>recommended_output</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>preference_margin</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>directional_confidence</code>, <code style={{ fontFamily: "var(--font-code, monospace)" }}>signal_quality</code>, and <code style={{ fontFamily: "var(--font-code, monospace)" }}>action_recommendation</code>.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 10, maxWidth: 720 }}>Exports never include raw API keys, key hashes, webhook secrets, raw voter IP/device signals, billing internals, or private owner fields.</p>
        </div>
      </section>

      {/* Decision Package */}
      <section id="decision-package" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Decision Package</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>A structured result your product can use.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>Every JSON export and the <code style={{ fontFamily: "var(--font-code, monospace)" }}>GET /api/v1/tests/&#123;id&#125;</code> response carry a <code style={{ fontFamily: "var(--font-code, monospace)" }}>decision_package</code> (schema_version <code style={{ fontFamily: "var(--font-code, monospace)" }}>v2</code>): the recommendation, directional confidence, preference margin, signal quality, evaluation health, audience fit, source quality, and the next action — ready to act on in your app.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {["recommended_output + winner_label + preference_margin", "directional_confidence + signal_quality + evaluation_health", "audience qualification (qualification_rate, audience_fit)", "source/channel quality breakdown", "action_recommendation — what to do next"].map((x) => <li key={x} style={{ display: "flex", gap: 9, fontSize: 14.5, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</li>)}
              </ul>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 14, lineHeight: 1.6 }}>Directional confidence from qualified human signal — not a guarantee of conversion lift, and not a substitute for statistical or legal research. The package never includes emails, raw IP/device data, share tokens, or raw screening answers. Summary and Standard tiers carry a trimmed package; Scale adds source quality and collection-link stats.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>decision_package (excerpt)</div><Code label="json">{DECISION_PKG}</Code></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/schemas/decision-package-v2.json" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Decision Package v2 JSON Schema →</a>
                <a href="#types" className="btn btn--ghost" style={{ fontSize: 12.5 }}>TypeScript types →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sandbox */}
      <section id="sandbox" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 720, marginBottom: "clamp(20px, 3vw, 32px)" }}>
            <p className="eyebrow">Sandbox</p>
            <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Test the full flow before spending credits.</h2>
            <p className="lead-copy">Create a <strong style={{ color: "var(--fg-1)" }}>sandbox evaluation</strong> to exercise the whole integration — create, decision package, export, webhook — with a deterministic <em>sample</em> decision package. Sandbox evaluations <strong style={{ color: "var(--fg-1)" }}>don&apos;t use credits</strong>, don&apos;t collect real human signal, and never appear in your analytics or reports. They&apos;re labeled <code style={{ fontFamily: "var(--font-code, monospace)" }}>mode: &quot;sandbox&quot;</code> everywhere.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Sandbox flow</div><Code>{SANDBOX_CURL}</Code></div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Full integration test</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                <li>Create a sandbox evaluation (<code style={{ fontFamily: "var(--font-code, monospace)" }}>sandbox: true</code>) — returns a complete eval, no credits.</li>
                <li>Fetch its decision package: <code style={{ fontFamily: "var(--font-code, monospace)" }}>GET /api/v1/tests/&#123;id&#125;</code>.</li>
                <li>Export JSON to wire up parsing: <code style={{ fontFamily: "var(--font-code, monospace)" }}>?format=json</code>.</li>
                <li>Send a test webhook from <a href="/app/api-keys">API keys</a> — a signed <code style={{ fontFamily: "var(--font-code, monospace)" }}>test.completed</code> with a sample package.</li>
                <li>Switch to production: drop <code style={{ fontFamily: "var(--font-code, monospace)" }}>sandbox</code>, add <code style={{ fontFamily: "var(--font-code, monospace)" }}>votes</code> + real options. Production uses real qualified human signal.</li>
              </ol>
              <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 14, lineHeight: 1.6 }}>Sandbox uses sample data for integration testing only. Sandbox creation needs the same API access (Scale) and <code style={{ fontFamily: "var(--font-code, monospace)" }}>tests:write</code> scope as production.</p>
            </div>
          </div>

          {/* TypeScript types */}
          <div id="types" style={{ marginTop: "clamp(28px, 4vw, 44px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <h3 className="display" style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)" }}>TypeScript types</h3>
              <a href="/schemas/decision-package-v2.json" style={{ fontSize: 12.5, color: "var(--acc-deep)" }}>JSON Schema ↗</a>
            </div>
            <Code label="typescript">{TS_TYPES}</Code>
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section id="webhooks" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 660, marginBottom: "clamp(20px, 3vw, 32px)" }}>
            <p className="eyebrow">Webhooks</p>
            <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Get notified the moment a test completes.</h2>
            <p className="lead-copy"><strong style={{ color: "var(--fg-1)" }}>Webhooks push</strong> a signed <code style={{ fontFamily: "var(--font-code, monospace)", fontSize: 14 }}>test.completed</code> event to your app; <strong style={{ color: "var(--fg-1)" }}>exports let you pull</strong> the structured results. No polling. Add an endpoint in <a href="/app/api-keys" style={{ color: "var(--acc-deep)" }}>API keys</a>.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: 18, alignItems: "start" }} className="cols-stack">
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Event payload</div><Code>{WEBHOOK_PAYLOAD}</Code></div>
            <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Verify the signature</div><Code>{WEBHOOK_VERIFY}</Code></div>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 14, maxWidth: 760 }}>Sign base: <code style={{ fontFamily: "var(--font-code, monospace)" }}>{"`${X-Vraelis-Timestamp}.${rawBody}`"}</code>, HMAC-SHA256 with your endpoint secret, compared to <code style={{ fontFamily: "var(--font-code, monospace)" }}>X-Vraelis-Signature</code>. Check the timestamp is recent to prevent replay. Payloads never include account email, API keys, or private data. Events: <code style={{ fontFamily: "var(--font-code, monospace)" }}>test.completed</code> (more soon).</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 10, maxWidth: 760 }}><strong style={{ color: "var(--fg-2)" }}>Retries.</strong> Return a <code style={{ fontFamily: "var(--font-code, monospace)" }}>2xx</code> within 6s. Transient failures (timeout, 5xx, 429) are retried automatically with backoff, up to 5 attempts over about 6 hours. <code style={{ fontFamily: "var(--font-code, monospace)" }}>4xx</code> and unsafe URLs aren&apos;t retried. Every attempt reuses the same <code style={{ fontFamily: "var(--font-code, monospace)" }}>X-Vraelis-Delivery</code> id, so <strong style={{ color: "var(--fg-2)" }}>dedupe on it</strong> to stay idempotent. Disabled endpoints stop retrying; you can also re-send by hand from the dashboard.</p>
        </div>
      </section>

      {/* Embed */}
      <section id="embed" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Embeddable evaluation widget</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 14 }}>One line. Human signal anywhere.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Drop a Vraelis evaluation into your site, app, docs, or community and collect valid judgments. One script tag, no other code. The widget is a responsive iframe.</p>
              <Code>{EMBED}</Code>
              <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 12 }}>Get the snippet for any active evaluation on its report page. Low-quality responses are filtered automatically, so the result feeds a cleaner decision report.</p>
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
          <p className="lead-copy" style={{ maxWidth: 640, marginBottom: 26 }}>Add an &ldquo;evaluate with real people&rdquo; action to your app. Vraelis runs the routing, quality filtering, reports, webhooks, and exports — you offer it as a premium feature and get structured preference data back. No human-evaluation infrastructure to build or maintain.</p>
          <div className="cols-3" style={{ gap: 14, marginBottom: 28 }}>
            {[
              ["AI image tools", "Let users pick the best generation before download. Learn which styles win."],
              ["Copy & content apps", "Test headline, hook, or caption variants with real readers."],
              ["Design & brand platforms", "Validate logos, palettes, and layouts with an audience, in-product."],
            ].map(([t, d]) => (
              <div key={t} className="card"><h3 style={{ fontSize: 16, marginBottom: 6 }}>{t}</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</p></div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}><a href="/app/api-keys" className="btn btn--lg">Create your API key →</a></div>
        </div>
      </section>
    </div>
  );
}

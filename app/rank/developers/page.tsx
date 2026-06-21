import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers",
  description: "Add human feedback to your app. Create tests by API, collect votes, receive webhooks, and export results.",
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
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 820, margin: "0 auto 16px" }}>Add <span className="em">“Test with Vraelis”</span> to your app.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 24px", textAlign: "center" }}>Your users generate options. Vraelis tells you which one real people prefer. Use one API call or an embed widget.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/api-keys" className="btn btn--lg">Create an API key</a>
            <a href="#embed" className="btn btn--ghost btn--lg">Embed widget</a>
          </div>
        </div>
      </section>

      {/* API */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">REST API</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 14 }}>Send options, get a ranked result.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Authenticate with an API key, POST your creative options (image URLs or text), and poll for the result + report. Built for AI image tools, copy generators, and creative platforms.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {["X-Api-Key auth (vr_live_…)", "Create + launch in one call", "Poll status, votes, winner & report", "Quality-filtered votes (anti-abuse built in)"].map((x) => <li key={x} style={{ display: "flex", gap: 9, fontSize: 14.5, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</li>)}
              </ul>
              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="pill">API access on Scale</span>
                <span className="pill">SDKs (coming soon)</span>
                <span className="pill">Discord bot (coming soon)</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Create a test</div><Code>{CURL}</Code></div>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Get the result</div><Code>{POLL}</Code></div>
            </div>
          </div>
        </div>
      </section>

      {/* Export */}
      <section id="export" className="section" style={{ background: "var(--bg-2)" }}>
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
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 14, maxWidth: 720 }}>Includes the winner, vote breakdown, percentages, <strong style={{ color: "var(--fg-2)" }}>valid vs filtered</strong> vote quality, comments, and the AI analysis. Never includes account email, voter identities, or raw IP/device data.</p>
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
              <p className="eyebrow">Embeddable widget</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 14 }}>One line. Votes anywhere.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Drop a Vraelis test into your site, docs, or community and collect real votes. One script tag, no other code. The widget is a responsive iframe.</p>
              <Code>{EMBED}</Code>
              <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 12 }}>Get the snippet for any active test on its report page. Votes are quality-filtered (too-fast, duplicate, and spam votes are rejected automatically).</p>
            </div>
            <div className="win">
              <div className="win__bar"><div className="win__dots"><i /><i /><i /></div><span className="win__addr">your-site.com</span></div>
              <div style={{ padding: 18, background: "var(--bg-1)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Which cover do you prefer?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ aspectRatio: "1/1", borderRadius: 10, border: "2px solid var(--acc)", background: "linear-gradient(135deg, var(--acc-soft), #fff)" }} />
                  <div style={{ aspectRatio: "1/1", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)" }} />
                </div>
                <div style={{ padding: "10px", borderRadius: 8, background: "var(--acc)", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 13 }}>Submit vote</div>
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

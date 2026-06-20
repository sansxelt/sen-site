import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers — Vraelis API & embed",
  description: "Add human preference testing to your app. Send generated options to the Vraelis API or drop in the embeddable “Test with Vraelis” widget and get back what real users prefer.",
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

function Code({ children }: { children: string }) {
  return <pre style={{ fontFamily: "var(--font-code, monospace)", fontSize: 12.5, color: "var(--fg-1)", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 10, padding: "14px 16px", overflowX: "auto", lineHeight: 1.55, margin: 0 }}><code>{children}</code></pre>;
}

export default function DevelopersPage() {
  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 72px)", paddingBottom: "clamp(28px, 4vw, 44px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Developers</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 820, margin: "0 auto 16px" }}>Add <span className="em">“Test with Vraelis”</span> to your app.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 24px", textAlign: "center" }}>Your users generate options. Vraelis tells you which one real people prefer — via one API call or an embeddable widget. The feedback becomes a data layer you own.</p>
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
                <span className="pill">SDKs — coming soon</span>
                <span className="pill">Discord bot — coming soon</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Create a test</div><Code>{CURL}</Code></div>
              <div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>Get the result</div><Code>{POLL}</Code></div>
            </div>
          </div>
        </div>
      </section>

      {/* Embed */}
      <section id="embed" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Embeddable widget</p>
              <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 14 }}>One line. Votes anywhere.</h2>
              <p className="lead-copy" style={{ marginBottom: 16 }}>Drop a Vraelis test into your site, docs, or community and collect real votes — no code beyond one script tag. The widget is a responsive, self-resizing iframe.</p>
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
              ["AI image tools", "Let users pick the best of N generations before download — and learn which styles win."],
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

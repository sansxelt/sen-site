import type { VOption, VReport } from "@/lib/v-db";
import { ogMeta } from "@/lib/og-meta";
import { ReportBody } from "@/app/rank/app/tests/[id]/report-body";

export const metadata = ogMeta({
  title: "Sample decision report",
  description: "An example Vraelis decision report — recommended output, preference margin, confidence, and reasoning signals. Built from demo data.",
  path: "/demo",
});

// Seeded sample. NOT real users — clearly labeled as demo data throughout. No DB,
// no auth, no billing: a static render of the real ReportBody so a first-time
// visitor sees the exact decision output a real evaluation produces.
const CANDIDATES: { id: string; label: string; blurb: string }[] = [
  { id: "a", label: "Hero A", blurb: "Benefit-led headline — leads with the outcome the visitor gets." },
  { id: "b", label: "Hero B", blurb: "Social-proof headline — leads with customer logos and trust." },
  { id: "c", label: "Hero C", blurb: "Product-screenshot — leads with a shot of the app UI." },
];

const options: VOption[] = CANDIDATES.map((c, i) => ({ id: c.id, test_id: "demo", position: i, asset_url: null, label: c.label }));

const results: VReport["results"] = {
  total: 240,
  filtered: 31,
  winner_option_id: "a",
  ranked: [
    { id: "a", position: 0, label: "Hero A", votes: 132, pct: 55 },
    { id: "b", position: 1, label: "Hero B", votes: 70, pct: 29 },
    { id: "c", position: 2, label: "Hero C", votes: 38, pct: 16 },
  ],
  comments: [
    { option_id: "a", reason: "The headline told me exactly what I'd get in one line." },
    { option_id: "a", reason: "Clear value — I knew what to do immediately." },
    { option_id: "a", reason: "The call to action stood out and felt low-risk." },
    { option_id: "a", reason: "Felt the most credible and modern of the three." },
    { option_id: "a", reason: "Benefit-first copy beat the clever wording." },
    { option_id: "b", reason: "The logos build trust, but the headline is vague." },
    { option_id: "b", reason: "Good social proof — I just wasn't sure what the product does." },
    { option_id: "c", reason: "The screenshot looks busy before I understand the value." },
  ],
  recommendation: "Option A",
};

export default function DemoReport() {
  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      {/* demo banner — honest labeling, repeated where it matters */}
      <div className="card" style={{ marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-start", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>
        <span aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-2)", color: "var(--fg-3)", display: "grid", placeItems: "center", fontSize: 16 }}>◴</span>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Sample evaluation</span>
            <span className="pill" style={{ color: "var(--fg-4)" }}>Demo data</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>This is an <strong style={{ color: "var(--fg-1)" }}>example decision report</strong> built from demo data — not judged by real users. Run your own evaluation to get a real one.</p>
        </div>
      </div>

      <p className="eyebrow">Example decision report</p>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.5rem)", marginBottom: 8 }}>Which landing page hero should ship?</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginBottom: 14, lineHeight: 1.55 }}>A sample comparison of three landing-page hero candidates for a general audience. It shows the exact decision output Vraelis returns — recommended output, preference margin, directional confidence, signal quality, and reasoning signals. <strong style={{ color: "var(--fg-2)" }}>All figures below are illustrative demo data, not real judgments.</strong></p>
      <p style={{ fontSize: 14.5, color: "var(--fg-1)", marginBottom: 24, lineHeight: 1.55, fontWeight: 600 }}>This is the kind of decision package Vraelis returns after an evaluation — a recommendation you can act on, not a poll result.</p>

      {/* the candidates being evaluated */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>The candidates</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 26 }}>
        {CANDIDATES.map((c, i) => (
          <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: 8, background: "var(--acc-soft)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{String.fromCharCode(65 + i)}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{c.label}</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>{c.blurb}</p>
          </div>
        ))}
      </div>

      <ReportBody results={results} options={options} votesTarget={250} />

      {/* share / export / API-ready framing */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "8px 0 12px" }}>On a real report, you can</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 30 }}>
        {[
          ["Share", "Publish a read-only public link anyone can open — no account needed."],
          ["Export", "Download the full result as JSON or CSV, with the decision summary included."],
          ["Use the API", "Pull the recommendation and intelligence into your own tools via the Vraelis API."],
        ].map(([t, d]) => (
          <div key={t} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t}</div>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>{d}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="card" style={{ textAlign: "center", borderColor: "var(--acc-line)", background: "var(--acc-soft)", padding: "clamp(24px, 4vw, 36px)" }}>
        <div className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", marginBottom: 8 }}>Run this on your own creative.</div>
        <p style={{ fontSize: 14.5, color: "var(--fg-2)", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.55 }}>Submit your candidates, collect valid human judgments, and get a decision report like this one.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/app/new" className="btn btn--lg">Start an evaluation →</a>
          <a href="/pricing" className="btn btn--ghost btn--lg">View pricing</a>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 16, marginBottom: 0 }}>Building something? Read the <a href="/developers" style={{ color: "var(--acc-deep)" }}>API docs</a>.</p>
      </div>
    </div>
  );
}

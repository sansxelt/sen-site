import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "How it works",
  description: "Send options, collect valid votes, and see what wins.",
  path: "/how-it-works",
});

const STEPS: [string, string, string][] = [
  ["1", "Create a test", "Upload your options or create a test by API. Choose how many valid judgments you want."],
  ["2", "People vote", "Real people choose, rank, or explain their preference. Low-quality votes are filtered out."],
  ["3", "Get the result", "See the winner, the vote breakdown, comments, and confidence."],
  ["4", "Use the data", "Share the report, export results, or receive a webhook."],
];

export default function HowItWorks() {
  return (
    <>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(20px, 3vw, 32px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>How it works</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.4vw, 3.4rem)", marginBottom: 14 }}>How Vraelis works</h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>Send options, collect valid votes, and see what wins.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vw, 36px)" }}>
        <div className="wrap">
          <div className="tile-grid cols-2">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
                <div className="acard__icon" style={{ width: 42, height: 42, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{n}</div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.3rem)", marginBottom: 7 }}>{t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", marginBottom: 16 }}>Ready to test?</h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Run your first test free with 25 credits.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start a test</a>
            <a href="/pricing" className="btn btn--ghost btn--lg">View pricing</a>
            <a href="/developers" className="btn btn--ghost btn--lg">Developers</a>
          </div>
        </div>
      </section>
    </>
  );
}

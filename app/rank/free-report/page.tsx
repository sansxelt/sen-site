import { ogMeta } from "@/lib/og-meta";
import { TallyEmbed } from "./tally-embed";

// Branded on-site intake page. The free-report CTAs point here (via FREE_REPORT_URL
// in lib/links.ts) so people stay on vraelis.com inside our nav and theme, then fill
// out the embedded Tally form in place. Copy + one embed only; no backend.
export const metadata = ogMeta({
  title: "Get a free QA report",
  description: "Send 2 to 8 versions of your AI output and get a free QA report: real people judge which one to ship, and why. Human QA for AI output.",
  path: "/free-report",
});

export default function FreeReportPage() {
  return (
    <section style={{ position: "relative" }}>
      <div className="glow glow--soft glow--bleed" />
      <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(40px, 5vw, 72px)", paddingBottom: "clamp(40px, 6vw, 80px)", maxWidth: 760 }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(20px, 3vw, 32px)" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Human QA for AI output</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.4vw, 3rem)", margin: "6px auto 12px", maxWidth: 620 }}>Get a free QA report.</h1>
          <p className="lead-copy" style={{ margin: "0 auto", maxWidth: 560, textAlign: "center" }}>Send 2 to 8 versions of what your app generates. Real people judge which one to ship, and you get a clear report on the winner, and why. Your first report is free.</p>
        </div>
        <div className="card" style={{ padding: "clamp(8px, 1.5vw, 16px)", background: "var(--bg-1)" }}>
          <TallyEmbed />
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-5)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          We only use this to prepare your report. No spam, and no account required.
        </p>
      </div>
    </section>
  );
}

import { ogMeta } from "@/lib/og-meta";
import { TallyEmbed } from "./tally-embed";

// Branded on-site intake page: site nav + footer wrap the embedded Tally form. Our
// heading overlaps the form's transparent top space (which is otherwise empty), so
// the context sits in that white space instead of leaving a gap or a doubled title.
// pointerEvents:none keeps the form fully clickable through the overlap. Copy + one
// embed only; no backend.
export const metadata = ogMeta({
  title: "Get a free QA report",
  description: "Get a free human QA report on your AI output: real people judge which version to ship, and why. Human QA for AI output.",
  path: "/free-report",
});

export default function FreeReportPage() {
  return (
    <section style={{ position: "relative" }}>
      <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(20px, 3vw, 40px)", paddingBottom: "clamp(40px, 6vw, 80px)", maxWidth: 720 }}>
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", pointerEvents: "none" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Human QA for AI output</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", margin: "6px auto 8px", maxWidth: 560 }}>Get a free QA report.</h1>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 520, margin: "0 auto", lineHeight: 1.55 }}>Send a few versions of what your app generates. Real people judge which one to ship, and why.</p>
        </div>
        <div style={{ position: "relative", zIndex: 1, marginTop: "clamp(-72px, -8vw, -40px)" }}>
          <TallyEmbed />
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-5)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
          We only use this to prepare your report. No spam, and no account required.
        </p>
      </div>
    </section>
  );
}

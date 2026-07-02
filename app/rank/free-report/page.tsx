import { ogMeta } from "@/lib/og-meta";
import { TallyEmbed } from "./tally-embed";

// Branded on-site intake page: site nav + footer wrap the embedded Tally form, with
// the site's ambient glow + grid so it doesn't read as a bare form. Our heading
// overlaps the form's transparent top space (which is otherwise empty), so the
// context fills that white space instead of leaving a gap or a doubled title.
// pointerEvents:none keeps the form fully clickable through the overlap. Copy + one
// embed only; no backend.
export const metadata = ogMeta({
  title: "Validate your AI output on real people",
  description: "Put the output your app generates in front of real people. They judge which version to ship, and why, so you can trust the call. This is the human validation behind the AI check.",
  path: "/free-report",
});

export default function FreeReportPage() {
  return (
    <section style={{ position: "relative" }}>
      <div className="glow glow--soft glow--bleed" />
      <div className="grid-faint" />
      <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(24px, 3.5vw, 48px)", paddingBottom: "clamp(40px, 6vw, 80px)", maxWidth: 720 }}>
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", pointerEvents: "none" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>Human validation</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(1.9rem, 3.8vw, 2.7rem)", margin: "8px auto 10px", maxWidth: 560 }}>Validate your output on <span className="em">real people</span>.</h1>
          <p className="rise" data-d="3" style={{ fontSize: 14.5, color: "var(--fg-3)", maxWidth: 520, margin: "0 auto", lineHeight: 1.55 }}>Send a few versions of what your app generates. Real people judge which one to ship, and why. Use it to confirm an AI check, or on its own when the call really matters.</p>
        </div>
        <div className="rise" data-d="4" style={{ position: "relative", zIndex: 1, marginTop: "clamp(-72px, -8vw, -40px)" }}>
          <TallyEmbed />
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-5)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
          We only use this to prepare your report. No spam, and no account required.
        </p>
      </div>
    </section>
  );
}

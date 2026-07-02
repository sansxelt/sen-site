import { ogMeta } from "@/lib/og-meta";
import { TallyEmbed } from "./tally-embed";

// Branded on-site intake page: site nav + footer wrap the embedded Tally form. The
// form carries its OWN title and description, so this page stays minimal (no
// duplicate heading) and tight to the top. Copy + one embed only; no backend.
export const metadata = ogMeta({
  title: "Get a free QA report",
  description: "Get a free human QA report on your AI output: real people judge which version to ship, and why. Human QA for AI output.",
  path: "/free-report",
});

export default function FreeReportPage() {
  return (
    <section style={{ position: "relative" }}>
      <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(8px, 1.5vw, 20px)", paddingBottom: "clamp(40px, 6vw, 80px)", maxWidth: 720 }}>
        <TallyEmbed />
        <p style={{ fontSize: 12, color: "var(--fg-5)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
          We only use this to prepare your report. No spam, and no account required.
        </p>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { GUIDES } from "@/lib/rank-guides";

export const metadata = ogMeta({
  title: "AI Output QA Guides | Vraelis",
  description: "Practical guides for reviewing AI-generated output before it ships: what to score, the failure modes to catch, and a pre-ship checklist for each type of output.",
  path: "/guides",
});

export default function GuidesIndex() {
  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(28px, 4vw, 56px)", paddingBottom: 80 }}>
      <p className="eyebrow">Guides</p>
      <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: "8px 0 14px", lineHeight: 1.1 }}>AI output QA, by the type of thing you ship</h1>
      <p className="lead-copy" style={{ fontSize: 16.5, color: "var(--fg-2)", lineHeight: 1.7, maxWidth: 620, marginBottom: 8 }}>
        AI writes fast and sounds confident, which is exactly why bad output slips through. Each guide covers what to score, the mistakes AI makes on that kind of output, and a checklist to run before it reaches anyone.
      </p>

      {GUIDES.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--fg-4)", marginTop: 24 }}>Guides are on the way.</p>
      ) : (
        <div className="tile-grid cols-2" style={{ gap: 14, marginTop: 30 }}>
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="acard" style={{ gap: 8, textDecoration: "none", padding: "clamp(16px, 2.2vw, 22px)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>{g.outputType.replace(/_/g, " ")}</div>
              <div className="acard__t" style={{ fontSize: 16 }}>{g.content.metaTitle}</div>
              <div className="acard__d">{g.cardBlurb}</div>
              <div style={{ fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 2 }}>Read the guide →</div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 40, textAlign: "center", paddingTop: 28, borderTop: "1px solid var(--line-1)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, color: "var(--fg-1)", marginBottom: 8 }}>Skip the manual review</div>
        <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 auto 16px", maxWidth: 440 }}>
          Vraelis runs the whole checklist for you: paste any AI output and get scores, the version to ship, and line-level fixes in about 20 seconds.
        </p>
        <Link href="/r/check" className="btn btn--lg">Run a free check <span aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

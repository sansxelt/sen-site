import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { GUIDES } from "@/lib/rank-guides";

// This "AI output QA" guides section is content for the RETIRED AI-output-checker product. The route now
// redirects to /how-it-works (see proxy.ts) and is removed from the sitemap; this neutral, noindexed metadata
// is a backstop so no retired title/OG can be indexed or previewed even if the page is reached directly.
export const metadata = ogMeta({
  title: "Vraelis",
  description: "Production verification for AI-built applications and systems.",
  path: "/guides",
  index: false,
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
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, color: "var(--fg-1)", marginBottom: 8 }}>The copy is the easy part</div>
        <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 auto 16px", maxWidth: 440 }}>
          Vraelis runs your AI-built app like production, in a real browser, and returns a launch decision with the exact blockers to fix.
        </p>
        <Link href="/how-it-works" className="btn btn--lg">See how Vraelis works <span aria-hidden>→</span></Link>
      </div>
    </div>
  );
}

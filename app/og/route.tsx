import { ImageResponse } from "next/og";

// 1200x630 social card for Vraelis. Rendered on the fly with next/og (Satori), NO remote
// font fetch (system sans-serif) so it can't fail at runtime, and cached hard so scrapers
// and the CDN get a fast, stable image instead of re-rendering on every hit. og:image points
// here, versioned (?v=) in the meta tags so new shares pick up a changed card (already-cached
// pages need a PAGE-URL bump or a platform re-scrape; see lib/og-meta.ts).
export const contentType = "image/png";

// Long CDN cache + stale-while-revalidate: the card is effectively static, and OG scrapers
// have short timeouts, so serving a cached copy (not a fresh render) is what keeps previews
// reliable. Cache-bust by bumping the ?v= on the og:image URL in the meta tags.
const CACHE = "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "sans-serif",
          color: "#ffffff",
          background: "#07070c",
        }}
      >
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#16C081" }} />
          <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, letterSpacing: "-0.02em" }}>Vraelis</div>
        </div>

        {/* headline + subline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <div style={{ display: "flex", fontSize: "96px", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.0 }}>
            QA for AI output
          </div>
          <div style={{ display: "flex", width: "132px", height: "6px", borderRadius: "3px", background: "#16C081" }} />
          <div style={{ display: "flex", fontSize: "41px", fontWeight: 500, color: "rgba(255,255,255,0.66)", letterSpacing: "-0.01em" }}>
            Scores and line-level fixes in ~20s
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "24px", color: "rgba(255,255,255,0.42)" }}>
          <div style={{ display: "flex" }}>Catch your AI&apos;s bad output before your users do.</div>
          <div style={{ display: "flex" }}>vraelis.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": CACHE },
    },
  );
}

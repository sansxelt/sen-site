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
          <svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 5 H19 V19 H13 V11 H5 Z" fill="#16C081" /></svg>
          <div style={{ display: "flex", fontSize: "40px", fontWeight: 700, letterSpacing: "-0.02em" }}>Vraelis</div>
        </div>

        {/* headline + subline — matches the site hero voice */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", fontSize: "72px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02, maxWidth: "1040px" }}>
            AI can build it. Nobody checked it.
          </div>
          <div style={{ display: "flex", width: "132px", height: "6px", borderRadius: "3px", background: "#16C081" }} />
          <div style={{ display: "flex", fontSize: "36px", fontWeight: 500, color: "rgba(255,255,255,0.66)", letterSpacing: "-0.01em", maxWidth: "1000px", lineHeight: 1.25 }}>
            Vraelis runs the flows you approve against your deployed app, and shows what broke.
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "24px", color: "rgba(255,255,255,0.42)" }}>
          <div style={{ display: "flex" }}>Checks that AI-built software actually works.</div>
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

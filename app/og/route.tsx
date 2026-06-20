import { ImageResponse } from "next/og";

// 1200×630 social card for Vraelis. Generated at the edge of the request so we
// never ship a binary asset; cached aggressively. og:image points here.
export const contentType = "image/png";

export function GET() {
  const pill = { display: "flex", padding: "9px 18px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.82)" } as const;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          fontFamily: "sans-serif",
          color: "#fff",
          background: "linear-gradient(135deg, #06140E 0%, #0B2418 52%, #0A7B54 145%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#16C081" }} />
          <div style={{ fontSize: "38px", fontWeight: 700, letterSpacing: "-0.02em" }}>Vraelis</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div style={{ fontSize: "72px", fontWeight: 800, lineHeight: 1.03, letterSpacing: "-0.035em", maxWidth: "880px" }}>
            Test generated content with real users.
          </div>
          <div style={{ fontSize: "33px", color: "rgba(255,255,255,0.72)" }}>
            Learn what wins before you launch.
          </div>
        </div>

        <div style={{ display: "flex", gap: "14px", fontSize: "23px" }}>
          <div style={pill}>Real-user voting</div>
          <div style={pill}>AI report</div>
          <div style={pill}>Embed &amp; API</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

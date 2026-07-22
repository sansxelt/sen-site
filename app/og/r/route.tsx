import { ImageResponse } from "next/og";

// 1200×630 social card for shared links under /r/<token>. The former human-evaluation report product this
// card served is RETIRED, so the card no longer renders any per-report voting data (judgments, winners, vote
// counts) or retired "real people evaluate" positioning. It now always shows the on-brand Vraelis production-
// validation card — safe for any scraper, and it never reveals whether a private token exists.
export const contentType = "image/png";

const BG = "linear-gradient(135deg, #06140E 0%, #0B2418 52%, #0A7B54 150%)";
const SIZE = { width: 1200, height: 630 };

function Card({ eyebrow, title, verdict }: { eyebrow: string; title: string; verdict: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "sans-serif", color: "#fff", background: BG }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#16C081" }} />
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>Vraelis</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontSize: 22, color: "#16C081", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600 }}>{eyebrow}</div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 1010 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{verdict}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
        <div style={{ display: "flex" }}>The independent verification layer for work performed by AI.</div>
        <div style={{ display: "flex" }}>vraelis.com</div>
      </div>
    </div>
  );
}

const brandCard = () => (
  <Card
    eyebrow="Vraelis"
    title="AI says it is done. Vraelis proves it."
    verdict="Verifies software built with AI actually works."
  />
);

export async function GET() {
  // Always the on-brand production-validation card. No retired voting data is read or rendered.
  return new ImageResponse(brandCard(), { ...SIZE, headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
}

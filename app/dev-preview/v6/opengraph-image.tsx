import { ImageResponse } from "next/og";

// The new public link-preview image (Discord / Slack / X / LinkedIn / browser). 1200x630, graphite, with the
// new category statement and a responsibility -> oversight -> trusted-completion flow. No checkout, no
// verification card, no Production Pass, no dashboard, no fake customer. Next merges this across all v6 routes.
export const runtime = "nodejs";
export const alt = "Vraelis, oversight for AI software agents, from assigned responsibility to trusted completion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#EEF1F5";
const MUT = "#95A0B0";
const GRAPH = "#0F1319";
const EMER = "#34D399";
const AMBER = "#F0B44A";

function Node({ label, tone }: { label: string; tone: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 12, height: 12, borderRadius: 999, background: tone }} />
      <div style={{ fontSize: 26, color: tone === MUT ? MUT : INK, letterSpacing: -0.5 }}>{label}</div>
    </div>
  );
}

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: `radial-gradient(1100px 500px at 82% -8%, rgba(52,211,153,0.14), transparent 60%), ${GRAPH}`,
          padding: "76px 80px", color: INK, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.6 }}>Vraelis</div>
          <div style={{ fontSize: 20, color: MUT, letterSpacing: 2, textTransform: "uppercase" }}>Oversight for AI software agents</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 940 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2.4, color: INK }}>
            Give AI agents responsibility without giving up control.
          </div>
          <div style={{ fontSize: 27, color: MUT, lineHeight: 1.4, maxWidth: 820 }}>
            Independent oversight across planning, execution, review, repair, and trusted completion.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Node label="Assigned responsibility" tone={MUT} />
          <div style={{ width: 46, height: 2, background: "rgba(255,255,255,0.22)" }} />
          <Node label="Oversight" tone={AMBER} />
          <div style={{ width: 46, height: 2, background: "rgba(255,255,255,0.22)" }} />
          <Node label="Trusted completion" tone={EMER} />
        </div>
      </div>
    ),
    { ...size }
  );
}

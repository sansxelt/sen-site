import type { CSSProperties } from "react";

// Shared loading skeleton for the signed-in app segment (dashboard shape): a header
// bar, three stat placeholders, two list-row placeholders. Pure server component,
// no data. The opacity pulse is local to this file and is disabled entirely under
// prefers-reduced-motion (the bars stay as a static tint).
function Bar({ w, h, style }: { w: number | string; h: number; style?: CSSProperties }) {
  return <div className="vskel" style={{ width: w, height: h, ...style }} />;
}

export default function AppLoading() {
  return (
    <div className="wrap" style={{ maxWidth: 1040, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }} role="status" aria-label="Loading">
      <style>{`
        .vskel { background: var(--bg-2); border-radius: 10px; animation: vskel-pulse 1.6s ease-in-out infinite; }
        @keyframes vskel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) { .vskel { animation: none; } }
      `}</style>
      <div aria-hidden="true">
        {/* header */}
        <Bar w={104} h={11} />
        <Bar w={260} h={32} style={{ marginTop: 12, maxWidth: "70%" }} />

        {/* stats */}
        <div className="tile-grid cols-3" style={{ marginTop: 28 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Bar w={72} h={10} />
              <Bar w={48} h={24} />
            </div>
          ))}
        </div>

        {/* list rows */}
        <div style={{ display: "grid", gap: 8, marginTop: 26 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)" }}>
              <Bar w={64} h={16} style={{ flex: "none" }} />
              <Bar w="40%" h={13} />
              <Bar w={72} h={11} style={{ marginLeft: "auto", flex: "none" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

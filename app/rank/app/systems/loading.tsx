import type { CSSProperties } from "react";

// Loading skeleton matching the Applications page layout: header with an action
// placeholder, a row of stat chips, then the application-cards grid. Pure server
// component, no data. The pulse is disabled under prefers-reduced-motion.
function Bar({ w, h, style }: { w: number | string; h: number; style?: CSSProperties }) {
  return <div className="vskel" style={{ width: w, height: h, ...style }} />;
}

export default function ApplicationsLoading() {
  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }} role="status" aria-label="Loading">
      <style>{`
        .vskel { background: var(--bg-2); border-radius: 10px; animation: vskel-pulse 1.6s ease-in-out infinite; }
        @keyframes vskel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) { .vskel { animation: none; } }
      `}</style>
      <div aria-hidden="true">
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <Bar w={104} h={11} />
            <Bar w={220} h={28} style={{ margin: "12px 0 10px" }} />
            <Bar w={320} h={13} style={{ maxWidth: "100%" }} />
          </div>
          <Bar w={150} h={40} style={{ flex: "none" }} />
        </div>

        {/* stat chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "11px 16px", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-1)", minWidth: 92 }}>
              <Bar w={34} h={20} />
              <Bar w={62} h={9} />
            </div>
          ))}
        </div>

        {/* app cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Bar w="60%" h={15} />
                  <Bar w="80%" h={11} style={{ marginTop: 8 }} />
                </div>
                <Bar w={64} h={18} style={{ flex: "none" }} />
              </div>
              <Bar w={120} h={12} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

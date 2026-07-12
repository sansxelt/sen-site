import type { CSSProperties } from "react";

// Loading skeleton matching the application-detail layout: breadcrumb, title, URL
// line, the tab bar, then the Production-status hero panel. Pure server component,
// no data. The pulse is disabled under prefers-reduced-motion.
function Bar({ w, h, style }: { w: number | string; h: number; style?: CSSProperties }) {
  return <div className="vskel" style={{ width: w, height: h, ...style }} />;
}

export default function ApplicationDetailLoading() {
  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }} role="status" aria-label="Loading">
      <style>{`
        .vskel { background: var(--bg-2); border-radius: 10px; animation: vskel-pulse 1.6s ease-in-out infinite; }
        @keyframes vskel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) { .vskel { animation: none; } }
      `}</style>
      <div aria-hidden="true">
        {/* breadcrumb */}
        <Bar w={180} h={12} style={{ marginBottom: 16 }} />

        {/* title + URL line */}
        <Bar w={280} h={28} style={{ maxWidth: "70%" }} />
        <Bar w={220} h={12} style={{ marginTop: 12, maxWidth: "55%" }} />

        {/* tab bar */}
        <div style={{ display: "flex", gap: 14, borderBottom: "1px solid var(--line-1)", marginTop: 24, marginBottom: 20, paddingBottom: 11, overflow: "hidden" }}>
          {[64, 58, 52, 48, 56, 82, 58].map((w, i) => (
            <Bar key={i} w={w} h={13} style={{ flex: "none" }} />
          ))}
        </div>

        {/* hero: the Production-status verdict panel */}
        <div style={{ borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-1)", padding: "clamp(22px, 3.2vw, 34px)" }}>
          <Bar w={130} h={10} />
          <Bar w={240} h={36} style={{ marginTop: 14, maxWidth: "60%" }} />
          <Bar w="75%" h={13} style={{ marginTop: 16 }} />
        </div>

        {/* a hint of the sections below the hero */}
        <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 }}>
          <Bar w={140} h={10} />
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-1)" }}>
                <Bar w={9} h={9} style={{ borderRadius: "50%", flex: "none" }} />
                <Bar w="35%" h={13} />
                <Bar w={72} h={16} style={{ marginLeft: "auto", flex: "none" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

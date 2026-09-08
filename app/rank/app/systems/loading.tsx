import type { CSSProperties } from "react";
import { Page } from "@/app/rank/_components/page-header";

// Loading skeleton matching the Systems page layout: header with an action
// placeholder, a row of stat chips, then the system-cards grid. Pure server
// component, no data. The pulse is disabled under prefers-reduced-motion.
//
// A skeleton at a different measure than the page it stands in for produces a visible sideways jump the
// moment the real content arrives, so it takes its column from the same <Page> that page does rather than
// repeating the number and hoping the two stay equal.
function Bar({ w, h, style }: { w: number | string; h: number; style?: CSSProperties }) {
  return <div className="vskel" style={{ width: w, height: h, ...style }} />;
}

export default function ApplicationsLoading() {
  return (
    <Page>
      {/* role="status" moves off the .wrap and onto the content, because <Page> owns the wrapper now. It
          has to stay OUTSIDE the aria-hidden block, or the live region would announce nothing. */}
      <div role="status" aria-label="Loading" style={{ paddingBottom: 80 }}>
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
    </Page>
  );
}

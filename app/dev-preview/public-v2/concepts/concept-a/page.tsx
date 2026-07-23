import type { Metadata } from "next";
import "../concepts.css";
import { RECORDS, AGENT_CLAIM } from "../../fixtures";

export const metadata: Metadata = { title: "Concept A — interception ring", robots: { index: false, follow: false } };

// Concept A: a large gapped proof-ring intercepts the agent's completion claim. Obligations pip the
// circumference; the ring holds emerald, then BREAKS red at the failing obligation, and a callout pulls the
// contradiction (expected vs observed) out of the fracture. Radial, ring-dominant. Representative frozen frame.
const N = 7;
const R = 40, CX = 50, CY = 50;
const C = 2 * Math.PI * R;
const HELD = 3 / N; // obligations 1-3 held; the 4th breaks
const ang = (i: number) => ((-90 + (i * 360) / N) * Math.PI) / 180;
const px = (i: number) => CX + R * Math.cos(ang(i));
const py = (i: number) => CY + R * Math.sin(ang(i));

export default function ConceptA() {
  const rec = RECORDS[0];
  return (
    <div className="scene">
      <div className="scene-wrap">
        <div className="ins-top">
          <span className="mk"><Mark />Vraelis</span>
          <span className="sep" />
          <span>verification {rec.id}</span>
          <span className="ins-live">running</span>
        </div>

        <div className="ca-grid">
          <div className="ca-copy">
            <span className="eyebrow">The agent said it was done</span>
            <h1 className="thesis ca-thesis">Vraelis checked.<br /><span className="lo">The evidence said</span> otherwise.</h1>
            <div>
              <div className="verdict verdict--failed ca-verdict">Failed</div>
              <div className="verdict-sub">Pro access did not persist &middot; on the checked workflow</div>
            </div>
          </div>

          <div className="ca-stage">
            <div className="ca-ring">
              <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(180,196,220,0.12)" strokeWidth={0.7} />
                {/* held arc (emerald, glowing) */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#5CE5D5" strokeWidth={1.4} strokeLinecap="round"
                  strokeDasharray={`${HELD * C} ${C}`} transform={`rotate(-90 ${CX} ${CY})`} style={{ filter: "drop-shadow(0 0 3px rgba(92,229,213,0.7))" }} />
                {/* the break (red, offset gap) */}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#FF5A6E" strokeWidth={1.4} strokeLinecap="round"
                  strokeDasharray={`${0.045 * C} ${C}`} strokeDashoffset={`${-HELD * C}`} transform={`rotate(-90 ${CX} ${CY})`} style={{ filter: "drop-shadow(0 0 4px rgba(255,90,110,0.8))" }} />
                {/* pips */}
                {RECORDS[0].steps.map((s, i) => {
                  const held = i < 3, broke = i === 3;
                  return (
                    <g key={i}>
                      <circle cx={px(i)} cy={py(i)} r={held ? 1.9 : broke ? 2.6 : 1.5} fill={held ? "#5CE5D5" : broke ? "#FF5A6E" : "none"} stroke={broke ? "#FF5A6E" : held ? "none" : "rgba(180,196,220,0.3)"} strokeWidth={0.7}
                        style={broke ? { filter: "drop-shadow(0 0 5px rgba(255,90,110,0.9))" } : held ? { filter: "drop-shadow(0 0 3px rgba(92,229,213,0.6))" } : undefined} />
                      {broke ? <path d={`M${px(i) - 1} ${py(i) - 1}l2 2M${px(i) + 1} ${py(i) - 1}l-2 2`} stroke="#0B0F17" strokeWidth={0.7} strokeLinecap="round" /> : null}
                    </g>
                  );
                })}
                {/* callout line from the break */}
                <path d={`M${px(3)} ${py(3)} L ${px(3) + 20} ${py(3) + 16}`} stroke="rgba(255,90,110,0.5)" strokeWidth={0.6} strokeDasharray="1.5 1.5" />
              </svg>

              {/* the agent's claim, at the center of the ring */}
              <div className="ca-claim">
                <div className="pkt" style={{ width: "100%" }}>
                  <div className="pkt-h"><span className="who">coding agent</span><span>deploy {rec.commit}</span><span className="stamp">DONE</span></div>
                  <div className="pkt-b">{AGENT_CLAIM}</div>
                </div>
              </div>
            </div>

            {/* the contradiction pulled from the fracture */}
            <div className="ca-callout">
              <div className="pkt" style={{ borderColor: "rgba(255,90,110,0.35)" }}>
                <div className="pkt-h"><span className="who" style={{ color: "#FF5A6E" }}>contradiction</span><span>{rec.evidence.atObligation}</span></div>
                <div style={{ padding: "13px 16px", display: "grid", gap: 12 }}>
                  <div className="eo"><span className="eo-k">Expected</span><span className="eo-v">{rec.evidence.expected}</span></div>
                  <div className="eo"><span className="eo-k">Observed</span><span className="eo-v eo-v--obs">{rec.evidence.observed}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lin" style={{ marginTop: "clamp(20px,3vw,44px)" }}>
          {RECORDS.map((r) => (
            <div key={r.id} className="lin-rec" data-v={r.conclusion}>
              <span className="n">{r.id}</span>
              <span className="l">{r.label}</span>
              <span className="v" data-v={r.conclusion}>{r.conclusion === "verified" ? "Verified" : "Failed"}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="study-tag">Concept A · interception ring</span>
    </div>
  );
}

function Mark() {
  const R = 7, C = 2 * Math.PI * R;
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r={R} stroke="#EEF1F6" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill="#5CE5D5" />
    </svg>
  );
}

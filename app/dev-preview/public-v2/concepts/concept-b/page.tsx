import type { Metadata } from "next";
import "../concepts.css";
import { RECORDS, AGENT_CLAIM, OBLIGATIONS } from "../../fixtures";

export const metadata: Metadata = { title: "Concept B — signal break", robots: { index: false, follow: false } };

// Concept B: a full-width proof trace runs like an oscilloscope reading of the agent's claim. It holds emerald
// through the passing obligations, then DROPS red at the failing one, and the page fractures at that point into
// EXPECTED (what should have happened) vs OBSERVED (what did). Linear, split-at-the-break.
const N = 7;
const W = 1000, MID = 66;
const X0 = 40, X1 = 720;
const px = (i: number) => X0 + (i * (X1 - X0)) / (N - 1);
const BREAK = 3; // obligation 4 fails

export default function ConceptB() {
  const rec = RECORDS[0];
  const heldPath = `M0 ${MID} L${px(0)} ${MID} ` + [0, 1, 2, 3].map((i) => `L${px(i)} ${MID}`).join(" ");
  return (
    <div className="scene">
      <div className="scene-wrap">
        <div className="ins-top">
          <span className="mk"><Mark />Vraelis</span>
          <span className="sep" />
          <span>verification {rec.id} &middot; deploy {rec.commit}</span>
          <span className="ins-live">running</span>
        </div>

        <div className="cb-head">
          <h1 className="thesis cb-thesis">The agent reported done.<br /><span className="lo">Vraelis read the live product.</span></h1>
          <div className="cb-verdict-wrap">
            <div className="verdict verdict--failed cb-verdict">Failed</div>
            <div className="verdict-sub">the claim did not hold</div>
          </div>
        </div>

        {/* the trace */}
        <div style={{ position: "relative", marginBottom: 4 }}>
          <div className="pkt" style={{ position: "absolute", top: -6, left: 0, width: "min(340px, 46%)", zIndex: 2 }}>
            <div className="pkt-h"><span className="who">coding agent</span><span className="stamp">DONE</span></div>
            <div className="pkt-b" style={{ fontSize: 13.5 }}>{AGENT_CLAIM}</div>
          </div>
          <svg viewBox={`0 0 ${W} 132`} width="100%" height="132" preserveAspectRatio="none" aria-hidden style={{ display: "block", overflow: "visible" }}>
            {/* faint unproven continuation after the break */}
            <path d={`M${px(BREAK)} ${MID + 46} L${W} ${MID + 46}`} stroke="rgba(180,196,220,0.18)" strokeWidth={1} strokeDasharray="3 4" fill="none" />
            {/* held (emerald, glow) */}
            <path d={heldPath} stroke="#5CE5D5" strokeWidth={2} fill="none" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px rgba(92,229,213,0.6))" }} />
            {/* the drop / break (red) */}
            <path d={`M${px(BREAK)} ${MID} L${px(BREAK) + 14} ${MID} L${px(BREAK) + 20} ${MID + 46} L${px(BREAK) + 40} ${MID + 46}`} stroke="#FF5A6E" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 5px rgba(255,90,110,0.8))" }} />
            {/* obligation pips */}
            {OBLIGATIONS.map((o, i) => {
              const held = i < BREAK, broke = i === BREAK;
              return <circle key={o.id} cx={px(i)} cy={MID} r={held ? 4 : broke ? 5.5 : 3.5} fill={held ? "#5CE5D5" : broke ? "#FF5A6E" : "#0E1421"} stroke={broke ? "#FF5A6E" : held ? "none" : "rgba(180,196,220,0.3)"} strokeWidth={1.4}
                style={broke ? { filter: "drop-shadow(0 0 6px rgba(255,90,110,0.9))" } : undefined} />;
            })}
          </svg>
          {/* obligation labels under held pips */}
          <div style={{ display: "flex", gap: 0, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--fgz-4)", marginTop: 4 }}>
            {OBLIGATIONS.slice(0, BREAK + 1).map((o, i) => (
              <span key={o.id} style={{ position: "absolute", left: `${(px(i) / W) * 100}%`, transform: "translateX(-50%)", color: i === BREAK ? "#FF5A6E" : "var(--fgz-4)", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{o.short}</span>
            ))}
          </div>
        </div>

        {/* the fracture: expected vs observed */}
        <div className="cb-trace" style={{ marginTop: 34 }}>
          <div className="cb-split">
            <div className="cb-half cb-half--exp">
              <span className="eo-k">Expected &middot; {rec.evidence.atObligation}</span>
              <p className="big">{rec.evidence.expected}</p>
            </div>
            <div className="cb-half cb-half--obs">
              <span className="eo-k" style={{ color: "#FF5A6E" }}>Observed</span>
              <p className="big">{rec.evidence.observed}</p>
            </div>
          </div>
        </div>

        <div className="cb-foot">
          <div className="lin">
            {RECORDS.map((r) => (
              <div key={r.id} className="lin-rec" data-v={r.conclusion}>
                <span className="n">{r.id}</span>
                <span className="l">{r.label}</span>
                <span className="v" data-v={r.conclusion}>{r.conclusion === "verified" ? "Verified" : "Failed"}</span>
              </div>
            ))}
          </div>
          <div className="verdict-sub" style={{ maxWidth: 260 }}>Each attempt is a separate, preserved record. A later Verified never overwrites an earlier failure.</div>
        </div>
      </div>
      <span className="study-tag">Concept B · signal break</span>
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

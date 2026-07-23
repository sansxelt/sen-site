import type { Metadata } from "next";
import "../concepts.css";
import { RECORDS, AGENT_CLAIM } from "../../fixtures";

export const metadata: Metadata = { title: "Concept C — records stack", robots: { index: false, follow: false } };

// Concept C: the three preserved records staged in receding depth. The front slab (Failed) shows the
// contradiction; the incomplete repair and the final Verified recede behind, connected as one lineage. The
// composition IS the evolving history. Stacked-depth, sequence-dominant.
export default function ConceptC() {
  const [r1, r2, r3] = RECORDS;
  return (
    <div className="scene">
      <div className="scene-wrap">
        <div className="ins-top">
          <span className="mk"><Mark />Vraelis</span>
          <span className="sep" />
          <span>3 preserved records &middot; one claim</span>
          <span className="ins-live">running</span>
        </div>

        <div className="cc-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span className="eyebrow">The agent said it was done</span>
            <h1 className="thesis cc-thesis">Two failures,<br />then <span style={{ color: "#5CE5D5", textShadow: "0 0 30px rgba(92,229,213,0.4)" }}>proof</span>.<br /><span className="lo">All three kept.</span></h1>
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.6, color: "var(--fgz-3)", maxWidth: "34ch" }}>
              {AGENT_CLAIM} Vraelis checked it three times against the live product. A later Verified never
              overwrites an earlier failure.
            </p>
          </div>

          <div className="cc-stack">
            {/* record 3 — Verified, furthest back */}
            <div className="cc-slab cc-slab--3" data-v={r3.conclusion}>
              <div className="sh"><span>{r3.id}</span><span>{r3.label}</span><span className="sv">Verified</span></div>
              <div className="cc-out cc-out--verified">{r3.outcome}</div>
            </div>
            {/* record 2 — Failed, middle */}
            <div className="cc-slab cc-slab--2" data-v={r2.conclusion}>
              <div className="sh"><span>{r2.id}</span><span>{r2.label}</span><span className="sv">Failed</span></div>
              <div className="cc-out cc-out--failed">{r2.outcome}</div>
            </div>
            {/* record 1 — Failed, front + active */}
            <div className="cc-slab cc-slab--1" data-v={r1.conclusion}>
              <div className="sh"><span>{r1.id}</span><span>{r1.label}</span><span className="sv">Failed</span></div>
              <div className="cc-claim">{AGENT_CLAIM}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
                <div className="eo"><span className="eo-k">Expected</span><span className="eo-v">{r1.evidence.expected}</span></div>
                <div className="eo"><span className="eo-k">Observed</span><span className="eo-v eo-v--obs">{r1.evidence.observed}</span></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                <div className="verdict verdict--failed" style={{ fontSize: "2.2rem" }}>Failed</div>
                <span className="verdict-sub">on the checked workflow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="study-tag">Concept C · records stack</span>
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

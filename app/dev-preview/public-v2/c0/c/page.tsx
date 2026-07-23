import type { Metadata } from "next";
import "../c0.css";
import { Wordmark, Seal, StudyTag } from "../parts";
import { RECORDS } from "../../fixtures";

export const metadata: Metadata = { title: "0C · C — expected vs observed split", robots: { index: false } };
const rec = RECORDS[0];
const REQUIREMENT = "A customer who upgrades to Pro keeps it after signing out and back in.";

export default function ConceptC() {
  return (
    <div className="c0">
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "0 clamp(24px,3.5vw,52px)" }}>
        <div className="c0-top">
          <Wordmark />
          <a className="c0-top-cta" href="#">Request a verification</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end", paddingTop: 8, paddingBottom: 22 }}>
          <div>
            <span className="c0-label">AI builds. Vraelis proves.</span>
            <h1 className="c0-thesis" style={{ fontSize: "clamp(2.3rem,4.4vw,4rem)", margin: "10px 0 0" }}>Where the promise <span className="g">meets the product.</span></h1>
          </div>
          <p className="c0-sub" style={{ fontSize: 14.5, maxWidth: "30ch", paddingBottom: 6 }}>{REQUIREMENT}</p>
        </div>

        {/* the split */}
        <div style={{ position: "relative", borderRadius: 6, overflow: "hidden", boxShadow: "0 40px 90px -44px rgba(23,20,13,0.5)" }}>
          <div className="c0-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 520 }}>
            {/* EXPECTED — the bright promise */}
            <div style={{ background: "linear-gradient(180deg, #FEFDFB, #F3F0E6)", padding: "clamp(28px,3vw,48px)", borderRight: "1px solid var(--line-2)", display: "flex", flexDirection: "column" }}>
              <span className="c0-label c0-label--green">What the business requires</span>
              <p style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: "clamp(22px,2.5vw,34px)", letterSpacing: "-0.025em", lineHeight: 1.12, color: "var(--ink)", margin: "18px 0 0", textWrap: "balance" }}>{rec.evidence.expected}</p>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12, paddingTop: 26 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <span style={{ fontSize: 14.5, color: "var(--ink-2)", fontWeight: 500 }}>the agent reported this as done</span>
              </div>
            </div>
            {/* OBSERVED — the dark reality */}
            <div className="c0-chamber" style={{ borderRadius: 0, padding: "clamp(28px,3vw,48px)", display: "flex", flexDirection: "column", boxShadow: "none" }}>
              <span className="c0-label" style={{ color: "#FF8A7C" }}>What Vraelis observed on the live system</span>
              <p style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: "clamp(22px,2.5vw,34px)", letterSpacing: "-0.025em", lineHeight: 1.12, color: "#FF9385", margin: "18px 0 0", textWrap: "balance" }}>{rec.evidence.observed}</p>
              <div style={{ marginTop: "auto", paddingTop: 26 }}>
                <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: "clamp(28px,3vw,42px)", letterSpacing: "-0.03em", color: "#FF6551", lineHeight: 0.9 }}>Release rejected</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.05em", color: "var(--chamber-ink-2)", marginTop: 10 }}>broke at obligation 4 of 7 · evidence preserved · vrf-3c9e26ef</div>
              </div>
            </div>
          </div>
          {/* the seal straddling the fault line */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 4 }}>
            <div style={{ background: "var(--paper-2)", borderRadius: "50%", padding: 8, boxShadow: "0 20px 50px -18px rgba(23,20,13,0.6)" }}><Seal verdict="rejected" size={128} rotate={-6} /></div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
          <span className="c0-label">Also proven, the same way</span>
          {["tenant isolation", "agent approval gates", "inventory reserved before an order confirms"].map((t) => (
            <span key={t} className="c0-inv"><span className="t" />{t}</span>
          ))}
        </div>
      </div>
      <StudyTag>Concept C · expected vs observed split</StudyTag>
    </div>
  );
}

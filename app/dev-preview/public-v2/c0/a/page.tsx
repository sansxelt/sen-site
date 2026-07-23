import type { Metadata } from "next";
import "../c0.css";
import { Wordmark, Seal, StudyTag } from "../parts";
import { OBLIGATIONS, RECORDS } from "../../fixtures";

export const metadata: Metadata = { title: "0C · A — editorial + proof chamber", robots: { index: false } };
const rec = RECORDS[0];
const REQUIREMENT = "A customer who upgrades to Pro keeps it after signing out and back in.";

export default function ConceptA() {
  return (
    <div className="c0">
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "0 clamp(24px,3.5vw,52px)" }}>
        <div className="c0-top">
          <Wordmark />
          <a className="c0-top-cta" href="#">Request a verification</a>
        </div>

        {/* thesis in the bright company world */}
        <div className="c0-cols" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 40, alignItems: "end", paddingTop: 10, paddingBottom: 26 }}>
          <div>
            <span className="c0-label">The independent bureau of proof for AI-built software</span>
            <h1 className="c0-thesis" style={{ fontSize: "clamp(3rem,6.2vw,5.6rem)", margin: "14px 0 0" }}>AI builds.<br /><span className="g">Vraelis proves.</span></h1>
          </div>
          <p className="c0-sub" style={{ fontSize: 16, maxWidth: "34ch", paddingBottom: 8 }}>
            Vraelis independently proves that AI-built software still does what the business requires — on the real,
            deployed system, with the evidence on file.
          </p>
        </div>

        {/* the dark proof chamber, cutting across the page */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", right: 26, top: -46, zIndex: 3 }}><Seal verdict="rejected" size={150} /></div>
          <div className="c0-chamber">
            <div className="c0-chamber-h"><span className="live" />Proof chamber · verifying deployment northwind-store · a41d0c2</div>
            <div className="c0-cols" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 0 }}>
              {/* left: requirement + obligations */}
              <div style={{ padding: "22px 24px", borderRight: "1px solid rgba(241,238,228,0.1)" }}>
                <div className="c0-label" style={{ color: "var(--chamber-ink-2)" }}>Submitted requirement</div>
                <p style={{ fontFamily: "var(--disp)", fontWeight: 600, fontSize: "clamp(19px,1.7vw,26px)", letterSpacing: "-0.02em", lineHeight: 1.18, color: "var(--chamber-ink)", margin: "12px 0 20px", textWrap: "balance" }}>{REQUIREMENT}</p>
                <div className="c0-oblig" style={{ margin: "0 -24px" }}>
                  {OBLIGATIONS.map((o, i) => {
                    const st = rec.steps[i].state;
                    const cls = st === "pass" ? "c0-ob--pass" : st === "fail" ? "c0-ob--fail" : "";
                    return (
                      <div key={o.id} className={`c0-ob ${cls}`}>
                        <span className="mk">{st === "pass" ? <Chk /> : st === "fail" ? <Ex /> : <Dot />}</span>
                        <span className="tx">{o.short}</span>
                        <span className="st">{st === "pass" ? "held" : st === "fail" ? "broke" : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* right: the contradiction + verdict */}
              <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, background: "rgba(176,49,34,0.05)" }}>
                <div>
                  <div className="c0-label" style={{ color: "var(--chamber-ink-2)" }}>Expected</div>
                  <p style={{ fontFamily: "var(--disp)", fontWeight: 500, fontSize: "clamp(16px,1.4vw,21px)", lineHeight: 1.2, color: "var(--chamber-ink)", margin: "8px 0 0" }}>{rec.evidence.expected}</p>
                </div>
                <div>
                  <div className="c0-label" style={{ color: "#FF7D6E" }}>Observed on the live system</div>
                  <p style={{ fontFamily: "var(--disp)", fontWeight: 500, fontSize: "clamp(16px,1.4vw,21px)", lineHeight: 1.2, color: "#FF9385", margin: "8px 0 0" }}>{rec.evidence.observed}</p>
                </div>
                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(241,238,228,0.12)" }}>
                  <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: "clamp(30px,3.4vw,46px)", letterSpacing: "-0.03em", color: "#FF6551", lineHeight: 0.9 }}>Release rejected</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "var(--chamber-ink-2)", marginTop: 10 }}>the claim did not hold · evidence preserved · record vrf-3c9e26ef</div>
                </div>
              </div>
            </div>
          </div>
          {/* breadth line under the chamber */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
            <span className="c0-label">Also proven</span>
            {["No tenant can read another tenant's data", "An agent cannot act without approval", "No order confirms unless inventory was reserved"].map((t) => (
              <span key={t} className="c0-inv"><span className="t" />{t}</span>
            ))}
          </div>
        </div>
      </div>
      <StudyTag>Concept A · editorial + proof chamber</StudyTag>
    </div>
  );
}

function Chk() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Ex() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /></svg>; }
function Dot() { return <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden><circle cx="3" cy="3" r="3" fill="currentColor" /></svg>; }

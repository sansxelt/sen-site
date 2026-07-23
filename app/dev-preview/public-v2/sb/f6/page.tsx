import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 6 — evidence freezes", robots: { index: false } };
const PINS = [
  { k: "authenticated as", v: "User A · Organization A", bad: false },
  { k: "record retrieved", v: "Q3 Financials.xlsx", bad: true },
  { k: "record owner", v: "Organization B", bad: true },
  { k: "API response", v: "200 · body scoped to org_b", bad: true },
  { k: "browser DOM", v: "rendered Org B data to User A", bad: true },
];

export default function Frame6() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 06 / 10 · frozen at the violation</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "clamp(24px,3vw,60px)", alignItems: "center", marginTop: "clamp(24px,4vh,52px)" }} className="sb-cap sb-scene">
          <div>
            <span className="sb-eyebrow" style={{ color: "var(--breach)" }}>The contradiction is not an opinion</span>
            <h1 className="sb-thesis" style={{ fontSize: "clamp(2.2rem,3.7vw,3.5rem)", margin: "14px 0 0" }}>Five independent sources.<br />One conclusion.</h1>
            <p className="sb-say" style={{ marginTop: 18, maxWidth: "38ch" }}>
              Vraelis freezes the system at the instant of the violation and reconciles every source. They agree:
              an Organization&nbsp;A user held an Organization&nbsp;B record.
            </p>
          </div>

          {/* the frozen contradiction with evidence pinned around it */}
          <div style={{ position: "relative", padding: "10px 6px" }}>
            {/* the record at the center of the freeze */}
            <div style={{ position: "relative", zIndex: 2, borderRadius: 10, background: "var(--surface)", color: "var(--surface-ink)", boxShadow: "0 0 0 1px rgba(255,68,56,0.5), 0 0 70px -10px var(--breach-glow)", overflow: "hidden", maxWidth: 460, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--surface-line)" }}>
                <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--orgA)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>A</span>
                <span style={{ fontWeight: 650, fontSize: 13.5 }}>User A&rsquo;s screen</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--breach)" }}>frozen</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: 12, alignItems: "center", padding: "18px 16px", background: "linear-gradient(90deg, rgba(255,68,56,0.14), rgba(255,68,56,0.04))" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--breach)" }} />
                <span style={{ fontSize: "clamp(15px,1.4vw,19px)", fontWeight: 650, color: "var(--breach)" }}>Q3 Financials.xlsx</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--breach)" }}>OWNER: ORG_B</span>
              </div>
            </div>
            {/* evidence pins */}
            <div style={{ display: "grid", gap: 8, marginTop: 16, maxWidth: 460, marginInline: "auto" }}>
              {PINS.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 15ch 1fr", gap: 12, alignItems: "baseline", fontFamily: "var(--mono)", fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.bad ? "var(--breach)" : "var(--vr)", alignSelf: "center" }} />
                  <span style={{ color: "var(--ink-lo)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{p.k}</span>
                  <span style={{ color: p.bad ? "var(--breach)" : "var(--ink-hi)", fontWeight: 600 }}>{p.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <StudyTag>Frame 06 · evidence freezes</StudyTag>
    </div>
  );
}

import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, ChangePacket, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 7 — release rejected", robots: { index: false } };

export default function Frame7() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 07 / 10 · the release is stopped</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(24px,3vw,64px)", alignItems: "center", marginTop: "clamp(40px,8vh,110px)" }} className="sb-cap sb-scene">
          {/* the change, held at the gate */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "min(48vh,420px)" }}>
            <div style={{ transform: "translateX(-6%) rotate(-3deg)", filter: "grayscale(0.3) brightness(0.85)" }}>
              <ChangePacket claim="Tenant permissions fixed." ref_="deploy 9f2a11c" />
            </div>
            {/* the gate / barrier the release cannot pass */}
            <div aria-hidden style={{ position: "absolute", right: "18%", top: "8%", bottom: "8%", width: 4, background: "linear-gradient(180deg, transparent, var(--breach), transparent)", boxShadow: "0 0 30px var(--breach-glow)" }} />
            <div aria-hidden style={{ position: "absolute", right: "14%", top: "50%", transform: "translateY(-50%)", width: 54, height: 54, borderRadius: "50%", border: "2px solid var(--breach)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px -6px var(--breach-glow)", background: "rgba(255,68,56,0.08)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12" stroke="var(--breach)" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="12" r="10" stroke="var(--breach)" strokeWidth="2" /></svg>
            </div>
          </div>

          {/* the verdict */}
          <div>
            <span className="sb-eyebrow" style={{ color: "var(--breach)" }}>Release decision</span>
            <h1 className="sb-verdict sb-verdict--rej" style={{ fontSize: "clamp(3.2rem,6vw,5.6rem)", margin: "14px 0 0" }}>Release<br />rejected.</h1>
            <p className="sb-say" style={{ marginTop: 20, maxWidth: "34ch", color: "var(--ink-hi)" }}>This change does not ship. Cross-tenant access was observed on the live system.</p>
            <div style={{ marginTop: 18, fontFamily: "var(--mono)", fontSize: 12, letterSpacing: "0.04em", color: "var(--ink-lo)" }}>invariant: users only access their own organization&rsquo;s data · evidence: 5 sources · record vrf-tn-0091</div>
          </div>
        </div>
      </div>
      <StudyTag>Frame 07 · release rejected</StudyTag>
    </div>
  );
}

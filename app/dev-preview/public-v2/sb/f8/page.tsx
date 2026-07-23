import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, ProofRecord, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 8 — kept in history", robots: { index: false } };

export default function Frame8() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 08 / 10 · the failure is preserved</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "clamp(24px,3vw,60px)", alignItems: "center", marginTop: "clamp(30px,6vh,90px)" }} className="sb-cap sb-scene">
          <div>
            <span className="sb-eyebrow">Preserved on file</span>
            <h1 className="sb-thesis" style={{ fontSize: "clamp(2.4rem,4vw,3.8rem)", margin: "14px 0 0" }}>Nothing is<br />overwritten.</h1>
            <p className="sb-say" style={{ marginTop: 20, maxWidth: "38ch" }}>
              The rejected release becomes a permanent record — the claim, the challenge, the evidence, the
              decision. A later pass never erases an earlier failure.
            </p>
          </div>

          {/* the record drops into a dimensional ledger */}
          <div style={{ position: "relative", perspective: 1400, height: "min(52vh, 440px)" }}>
            {/* faint slots for future records */}
            <div aria-hidden style={{ position: "absolute", left: "8%", right: "8%", top: "18%", height: 62, border: "1px dashed rgba(244,239,227,0.12)", borderRadius: 8, transform: "rotateX(24deg) translateZ(-40px)" }} />
            <div aria-hidden style={{ position: "absolute", left: "6%", right: "6%", top: "34%", height: 62, border: "1px dashed rgba(244,239,227,0.14)", borderRadius: 8, transform: "rotateX(20deg) translateZ(-20px)" }} />
            {/* the new rejected record, landing */}
            <div style={{ position: "absolute", left: "4%", right: "4%", top: "50%", transform: "rotateX(16deg)", zIndex: 3 }}>
              <ProofRecord verdict="rejected" n="record vrf-tn-0091 · 2026-07-21 14:07 UTC" label="Tenant isolation — cross-tenant access observed" />
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-lo)", letterSpacing: "0.04em" }}>
                <span>claim &amp; deploy</span><span>challenge &amp; identities</span><span>5 evidence sources</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StudyTag>Frame 08 · kept in history</StudyTag>
    </div>
  );
}

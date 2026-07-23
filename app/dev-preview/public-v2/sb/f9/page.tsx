import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, ChangePacket, ProofRecord, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 9 — the repair", robots: { index: false } };

export default function Frame9() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 09 / 10 · the agent tries again</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1.1fr", gap: "clamp(20px,3vw,54px)", alignItems: "center", marginTop: "clamp(44px,9vh,120px)" }} className="sb-cap sb-scene">
          {/* history — the preserved failure */}
          <div style={{ opacity: 0.72, transform: "scale(0.94)" }}>
            <span className="sb-eyebrow">On file</span>
            <div style={{ marginTop: 14 }}><ProofRecord verdict="rejected" n="record vrf-tn-0091" label="Cross-tenant access observed" /></div>
          </div>

          <svg width="80" height="30" viewBox="0 0 80 30" fill="none" aria-hidden style={{ overflow: "visible" }}>
            <path d="M0 15h64" stroke="var(--law)" strokeWidth="1.6" strokeDasharray="3 5" style={{ filter: "drop-shadow(0 0 5px rgba(235,199,119,0.5))" }} />
            <path d="M60 9l8 6-8 6" stroke="var(--law)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* the repair enters */}
          <div>
            <span className="sb-eyebrow" style={{ color: "var(--law)" }}>The agent submits a repair</span>
            <div style={{ marginTop: 16 }}><ChangePacket repair claim="Scope every record query to the caller's organization." ref_="deploy c73e05a" /></div>
            <p className="sb-say" style={{ marginTop: 18, maxWidth: "36ch" }}>
              Vraelis will not re-run the same trace. A fix that only satisfies the last test is not a fix — so the
              next challenge uses new identities and a different valid path.
            </p>
          </div>
        </div>
      </div>
      <StudyTag>Frame 09 · the repair</StudyTag>
    </div>
  );
}

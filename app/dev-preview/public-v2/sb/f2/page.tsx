import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, ChangePacket, InvariantLaw, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 2 — the claim vs the promise", robots: { index: false } };

export default function Frame2() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 02 / 10 · the claim meets the requirement</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1.1fr", gap: "clamp(20px,3vw,54px)", alignItems: "center", marginTop: "clamp(40px,9vh,120px)" }} className="sb-cap sb-scene">
          {/* the agent's change — its word */}
          <div>
            <span className="sb-eyebrow">The agent&rsquo;s word</span>
            <div style={{ marginTop: 16 }}><ChangePacket claim="Tenant permissions fixed." ref_="deploy 9f2a11c" /></div>
            <p className="sb-say" style={{ marginTop: 16, maxWidth: "26ch" }}>The agent changed the code and reported completion. That is a claim, not proof.</p>
          </div>

          {/* the flow between */}
          <svg width="80" height="30" viewBox="0 0 80 30" fill="none" aria-hidden style={{ overflow: "visible" }}>
            <path d="M0 15h64" stroke="var(--vr)" strokeWidth="1.6" strokeDasharray="3 5" style={{ filter: "drop-shadow(0 0 5px var(--vr-glow))" }} />
            <path d="M60 9l8 6-8 6" stroke="var(--vr)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* the promise Vraelis already holds */}
          <div>
            <span className="sb-eyebrow"><span className="v">Vraelis</span> holds the promise</span>
            <div style={{ marginTop: 16 }}>
              <InvariantLaw>Users can only access data belonging to their own organization.</InvariantLaw>
            </div>
            <p className="sb-say" style={{ marginTop: 16, maxWidth: "34ch" }}>
              The requirement lives outside the code, on file before this change existed. Vraelis will hold the new
              deployment to it — whatever the agent says.
            </p>
          </div>
        </div>
      </div>
      <StudyTag>Frame 02 · claim vs promise</StudyTag>
    </div>
  );
}

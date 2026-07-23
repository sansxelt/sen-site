import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, OrgWorld, IdentityToken, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 3 — the challenge is built", robots: { index: false } };

export default function Frame3() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 03 / 10 · Vraelis builds the challenge</span></div>

        <div style={{ maxWidth: "50ch", marginTop: "clamp(24px,4vh,48px)" }} className="sb-cap">
          <span className="sb-eyebrow"><span className="v">Vraelis</span> builds its own challenge</span>
          <h1 className="sb-thesis" style={{ fontSize: "clamp(1.9rem,3.2vw,3rem)", margin: "12px 0 0" }}>Fresh identities. Separate organizations. Nothing the agent supplied.</h1>
        </div>

        {/* two worlds, freshly created, with an intact boundary between them */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(40px,6vw,120px)", alignItems: "start", marginTop: "clamp(26px,4vh,52px)" }} className="sb-cap sb-scene">
          {/* the intact tenant boundary */}
          <div className="sb-boundary-line" style={{ left: "50%", top: "-10px", bottom: "-10px", width: 3, transform: "translateX(-50%)", zIndex: 3 }} aria-hidden />
          <div style={{ position: "absolute", left: "50%", top: -34, transform: "translateX(-50%)", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--law)", whiteSpace: "nowrap", zIndex: 4 }}>tenant boundary · must hold</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, transform: "perspective(1500px) rotateY(6deg)", transformOrigin: "left center" }}>
            <IdentityToken initials="A" name="User A" org="fresh · session s-4471" color="var(--orgA)" />
            <OrgWorld org="A" orgName="Organization A" color="var(--orgA)" userInitials="A" userName="User A"
              rows={[{ name: "Onboarding checklist", owner: "org_a" }, { name: "Team roster", owner: "org_a" }, { name: "Billing settings", owner: "org_a" }]} foot="seeded · isolated from Organization B" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, transform: "perspective(1500px) rotateY(-6deg)", transformOrigin: "right center" }}>
            <IdentityToken initials="B" name="User B" org="fresh · session s-8820" color="var(--orgB)" />
            <OrgWorld org="B" orgName="Organization B" color="var(--orgB)" userInitials="B" userName="User B"
              rows={[{ name: "Q3 Financials.xlsx", owner: "org_b" }, { name: "Board deck — Series B", owner: "org_b" }, { name: "Customer contracts", owner: "org_b" }]} foot="seeded · isolated from Organization A" />
          </div>
        </div>
      </div>
      <StudyTag>Frame 03 · the challenge</StudyTag>
    </div>
  );
}

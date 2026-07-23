import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, OrgWorld, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 4 — parallel execution", robots: { index: false } };
const CHALLENGES = [
  ["User A", "reads own records", "allowed"],
  ["User B", "reads own records", "allowed"],
  ["User A", "requests Org B record", "under test"],
  ["cross-session", "token replay", "under test"],
];

export default function Frame4() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 04 / 10 · parallel challenge running</span></div>

        <div style={{ maxWidth: "46ch", marginTop: "clamp(20px,3.5vh,44px)" }} className="sb-cap">
          <span className="sb-eyebrow"><span className="v">Vraelis</span> drives the real product from every side</span>
          <h1 className="sb-thesis" style={{ fontSize: "clamp(1.8rem,3vw,2.8rem)", margin: "12px 0 0" }}>Two identities. Live browser and API. All at once.</h1>
        </div>

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 0.9fr 1fr", gap: "clamp(20px,3vw,56px)", alignItems: "center", marginTop: "clamp(24px,4vh,50px)" }} className="sb-cap sb-scene">
          <div style={{ transform: "perspective(1500px) rotateY(7deg)", transformOrigin: "left center" }}>
            <OrgWorld org="A" orgName="Organization A" color="var(--orgA)" userInitials="A" userName="User A · executing"
              rows={[{ name: "Onboarding checklist", owner: "org_a" }, { name: "Team roster", owner: "org_a" }, { name: "Billing settings", owner: "org_a" }]} foot="live browser · request in flight" />
          </div>

          {/* the Vraelis challenge engine, mid-run */}
          <div style={{ border: "1px solid rgba(22,224,140,0.28)", borderRadius: 12, background: "linear-gradient(180deg, rgba(22,224,140,0.06), rgba(11,9,6,0.4))", padding: "16px 16px 12px", boxShadow: "0 0 50px -20px var(--vr-glow)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--vr)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--vr)", boxShadow: "0 0 10px var(--vr-glow)" }} />executing 4 challenges
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {CHALLENGES.map(([who, what, st], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "baseline", fontFamily: "var(--mono)", fontSize: 11.5 }}>
                  <span style={{ color: "var(--ink-hi)", fontWeight: 600 }}>{who}</span>
                  <span style={{ color: "var(--ink-lo)" }}>{what}</span>
                  <span style={{ color: st === "allowed" ? "var(--vr)" : "var(--law)", letterSpacing: "0.04em" }}>{st}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ transform: "perspective(1500px) rotateY(-7deg)", transformOrigin: "right center" }}>
            <OrgWorld org="B" orgName="Organization B" color="var(--orgB)" userInitials="B" userName="User B · executing"
              rows={[{ name: "Q3 Financials.xlsx", owner: "org_b" }, { name: "Board deck — Series B", owner: "org_b" }, { name: "Customer contracts", owner: "org_b" }]} foot="live browser · request in flight" />
          </div>

          {/* the boundary under load */}
          <div className="sb-boundary-line" style={{ left: "50%", top: "-4%", bottom: "-4%", width: 3, transform: "translateX(-50%)", zIndex: 0, opacity: 0.5 }} aria-hidden />
        </div>
      </div>
      <StudyTag>Frame 04 · parallel execution</StudyTag>
    </div>
  );
}

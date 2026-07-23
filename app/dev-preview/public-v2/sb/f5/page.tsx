import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, InvariantLaw, OrgWorld, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 5 — the breach", robots: { index: false } };

export default function Frame5() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top">
          <Wordmark />
          <span className="sb-frameid">Frame 05 / 10 · the boundary is crossed</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.18fr", gap: "clamp(24px,3vw,56px)", alignItems: "center", marginTop: "clamp(20px,3vw,44px)" }} className="sb-cap sb-scene">
          {/* left: the law, the violation, the verdict */}
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <InvariantLaw>Users can only access data belonging to their own organization.</InvariantLaw>
            <div>
              <span className="sb-eyebrow" style={{ color: "var(--breach)" }}>Vraelis observed on the live system</span>
              <h1 className="sb-thesis" style={{ fontSize: "clamp(2.1rem,3.5vw,3.3rem)", margin: "14px 0 0" }}>
                User&nbsp;A opened a record<br />owned by <span style={{ color: "var(--breach)", textShadow: "0 0 40px var(--breach-glow)" }}>Organization&nbsp;B.</span>
              </h1>
            </div>
            {/* the evidence that converges */}
            <div style={{ display: "grid", gap: 9 }}>
              {[
                ["authenticated identity", "User A · Organization A"],
                ["record owner", "Organization B", true],
                ["retrieved via", "account API + live browser"],
              ].map(([k, v, bad], i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, fontFamily: "var(--mono)", fontSize: 12.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: bad ? "var(--breach)" : "var(--vr)", boxShadow: bad ? "0 0 10px var(--breach-glow)" : "0 0 10px var(--vr-glow)", flex: "none", alignSelf: "center" }} />
                  <span style={{ color: "var(--ink-lo)", letterSpacing: "0.06em", textTransform: "uppercase", minWidth: "15ch" }}>{k}</span>
                  <span style={{ color: bad ? "var(--breach)" : "var(--ink-hi)", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="sb-verdict sb-verdict--rej" style={{ fontSize: "clamp(1.7rem,2.6vw,2.5rem)" }}>Cross-tenant access observed</div>
              <div className="sb-verdict-note" style={{ marginTop: 10 }}>the invariant did not hold · release will be rejected</div>
            </div>
          </div>

          {/* right: two organization worlds at depth, the boundary broken between them */}
          <div style={{ position: "relative", height: "min(64vh, 560px)", perspective: 1600 }}>
            {/* Org B — behind, dimmer */}
            <div style={{ position: "absolute", right: 0, top: "6%", width: "62%", transform: "rotateY(-16deg) rotateX(3deg) scale(0.92)", transformOrigin: "right center", filter: "brightness(0.82)" }}>
              <OrgWorld org="B" orgName="Organization B" color="var(--orgB)" userInitials="—" userName="no session" foot="records · owned by Organization B"
                rows={[
                  { name: "Q3 Financials.xlsx", owner: "org_b" },
                  { name: "Board deck — Series B", owner: "org_b" },
                  { name: "Customer contracts", owner: "org_b" },
                ]} />
            </div>
            {/* the tenant boundary, now broken */}
            <div className="sb-boundary-line sb-boundary-line--broken" style={{ left: "52%", top: "2%", bottom: "10%", width: 3, zIndex: 2 }} />
            {/* the reach across the boundary */}
            <svg style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", overflow: "visible" }} aria-hidden>
              <defs>
                <marker id="bh" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto"><path d="M0 0l7 4.5L0 9z" fill="var(--breach)" /></marker>
              </defs>
              <path d="M 42% 62% C 55% 62%, 55% 30%, 72% 30%" stroke="var(--breach)" strokeWidth="2.5" fill="none" strokeDasharray="2 5" markerEnd="url(#bh)" style={{ filter: "drop-shadow(0 0 6px var(--breach-glow))" }} />
            </svg>
            {/* Org A — front, User A's real screen showing the foreign record */}
            <div style={{ position: "absolute", left: 0, bottom: "2%", width: "72%", transform: "rotateY(10deg) rotateX(2deg)", transformOrigin: "left center", zIndex: 4 }}>
              <OrgWorld org="A" orgName="Organization A" color="var(--orgA)" userInitials="A" userName="User A · signed in"
                foot="what User A can see — one row does not belong here"
                rows={[
                  { name: "Onboarding checklist", owner: "org_a" },
                  { name: "Team roster", owner: "org_a" },
                  { name: "Q3 Financials.xlsx", owner: "OWNER: ORG_B", foreign: true },
                  { name: "Meeting notes", owner: "org_a" },
                ]} />
            </div>
          </div>
        </div>
      </div>
      <StudyTag>Frame 05 · the breach</StudyTag>
    </div>
  );
}

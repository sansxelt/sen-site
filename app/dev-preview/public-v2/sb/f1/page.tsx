import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, OrgWorld, ChangePacket, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 1 — AI builds. Vraelis proves.", robots: { index: false } };

export default function Frame1() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top">
          <Wordmark />
          <span className="sb-frameid">Frame 01 / 10 · a change is in motion</span>
        </div>

        {/* the arena is already alive behind the thesis */}
        <div style={{ position: "absolute", right: "-4%", top: "12%", width: "48%", transform: "rotateY(-18deg) rotateX(4deg) scale(0.98)", transformOrigin: "right center", filter: "brightness(0.7)", opacity: 0.85, zIndex: 1 }} className="sb-cap sb-float sb-float-hide-m">
          <OrgWorld org="A" orgName="Organization A" color="var(--orgA)" userInitials="A" userName="live session"
            rows={[{ name: "Onboarding checklist", owner: "org_a" }, { name: "Team roster", owner: "org_a" }, { name: "Billing settings", owner: "org_a" }, { name: "Meeting notes", owner: "org_a" }]} />
        </div>
        {/* a change packet arriving from the agent */}
        <div style={{ position: "absolute", right: "6%", bottom: "16%", zIndex: 3, transform: "rotate(-2deg)" }} className="sb-cap sb-float">
          <ChangePacket claim="Tenant permissions fixed." ref_="deploy 9f2a11c" />
          <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-lo)", textAlign: "right" }}>entering verification →</div>
        </div>

        <div style={{ position: "relative", zIndex: 4, marginTop: "clamp(60px,12vh,150px)", maxWidth: "62%" }} className="sb-cap sb-hero-copy">
          <span className="sb-eyebrow">The independent proof engine for AI-built software</span>
          <h1 className="sb-thesis" style={{ fontSize: "clamp(3.4rem,7.2vw,6.4rem)", margin: "18px 0 0" }}>AI builds.<br /><span className="v">Vraelis proves.</span></h1>
          <p className="sb-say" style={{ marginTop: 22, maxWidth: "42ch" }}>
            An agent ships a change and says it is done. Vraelis takes the promise the business actually made, builds
            its own challenge against the live system, and shows what really happened.
          </p>
        </div>
      </div>
      <StudyTag>Frame 01 · establishing</StudyTag>
    </div>
  );
}

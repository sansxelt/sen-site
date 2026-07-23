import type { Metadata } from "next";
import "../sb.css";
import { Wordmark, IdentityToken, ProofRecord, StudyTag } from "../parts";

export const metadata: Metadata = { title: "0D · Frame 10 — a new challenge", robots: { index: false } };

export default function Frame10() {
  return (
    <div className="sb">
      <div className="sb-frame">
        <div className="sb-top"><Wordmark /><span className="sb-frameid">Frame 10 / 10 · never the same test twice</span></div>

        {/* the lineage growing along the bottom */}
        <div style={{ position: "absolute", left: "clamp(24px,4vw,64px)", right: "clamp(24px,4vw,64px)", bottom: "clamp(28px,5vh,56px)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, zIndex: 4 }} className="sb-cap sb-lineage-m">
          <ProofRecord verdict="rejected" n="record 1" label="Cross-tenant access observed" />
          <ProofRecord verdict="rejected" n="record 2" label="Fixed one path, missed another" />
          <div className="sb-record" data-v="verified" style={{ outline: "1px solid rgba(22,224,140,0.4)" }}>
            <span className="rn">record 3 · now</span>
            <span className="rl">New identities, new path</span>
            <span className="rv" style={{ color: "var(--vr)" }}>re-verifying…</span>
          </div>
        </div>

        <div style={{ maxWidth: "54ch", marginTop: "clamp(30px,6vh,80px)" }} className="sb-cap">
          <span className="sb-eyebrow"><span className="v">Vraelis</span> never runs the same test twice</span>
          <h1 className="sb-thesis" style={{ fontSize: "clamp(2.6rem,4.6vw,4.4rem)", margin: "14px 0 0" }}>New identities.<br />A different path.<br /><span className="v">Proven again — or rejected again.</span></h1>
        </div>

        {/* fresh identities for the new challenge, different from before */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26, position: "relative", zIndex: 4 }} className="sb-cap">
          <IdentityToken initials="C" name="User C" org="Organization C · session s-9910" color="#7C5CD6" />
          <IdentityToken initials="D" name="User D" org="Organization D · session s-2277" color="#2FA37A" />
          <span className="sb-id" style={{ borderColor: "rgba(22,224,140,0.3)" }}><span className="og" style={{ color: "var(--vr)" }}>path: direct URL, not the menu · reused token · delayed re-auth</span></span>
        </div>

        <p className="sb-say" style={{ marginTop: 22, maxWidth: "48ch", position: "relative", zIndex: 4 }}>
          Every release an agent ships is challenged fresh. The proof cannot be memorized, and the record grows
          either way. <span style={{ color: "var(--ink-hi)", fontWeight: 600 }}>AI builds. Vraelis proves.</span>
        </p>
      </div>
      <StudyTag>Frame 10 · the cycle</StudyTag>
    </div>
  );
}

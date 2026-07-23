import type { Metadata } from "next";
import "../c0.css";
import { Wordmark, Seal, StudyTag, SourceNode } from "../parts";

export const metadata: Metadata = { title: "0C · B — requirement + evidence sources", robots: { index: false } };
const REQUIREMENT = "A customer who upgrades to Pro keeps it after signing out and back in.";
const LEFT = [
  { label: "Real browser · the live UI", held: true },
  { label: "Payment provider · sandbox charge", held: true },
  { label: "Database · entitlement record", held: false },
];
const RIGHT = [
  { label: "Account API · plan on re-auth", held: false },
  { label: "Second identity · isolation", held: true },
  { label: "Email · receipt delivered", held: true },
];

export default function ConceptB() {
  return (
    <div className="c0">
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "0 clamp(24px,3.5vw,52px)" }}>
        <div className="c0-top">
          <Wordmark />
          <a className="c0-top-cta" href="#">Request a verification</a>
        </div>

        <div style={{ textAlign: "center", paddingTop: 14 }}>
          <span className="c0-label">Independently verified against reality</span>
          <h1 className="c0-thesis" style={{ fontSize: "clamp(2.6rem,5vw,4.4rem)", margin: "12px auto 0", maxWidth: "18ch" }}>
            One requirement. <span className="g">Six independent checks.</span> One verdict.
          </h1>
        </div>

        {/* center object + orbiting evidence sources */}
        <div className="c0-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr 1fr", gap: "clamp(16px,2.4vw,40px)", alignItems: "center", marginTop: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {LEFT.map((s) => <SourceNode key={s.label} label={s.label} held={s.held} />)}
          </div>

          {/* the requirement, central */}
          <div style={{ position: "relative" }}>
            <div className="c0-clause">
              <div className="c0-clause-h"><span className="c0-clause-ref">REQUIREMENT · REV-2026-07-14</span><span className="c0-clause-src">Pro entitlement</span></div>
              <div className="c0-clause-body" style={{ textAlign: "center" }}>
                <p className="c0-requirement" style={{ fontSize: "clamp(20px,1.9vw,28px)" }}>{REQUIREMENT}</p>
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                  <div className="c0-verdict-word" style={{ fontSize: "clamp(30px,3.4vw,44px)", color: "var(--red)" }}>Release rejected</div>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "8px 0 0", lineHeight: 1.4 }}>Payment cleared, but the entitlement did not survive a fresh sign-in. Two sources disagree with the claim.</p>
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", right: -34, bottom: -34, zIndex: 3 }}><Seal verdict="rejected" size={118} rotate={-8} /></div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {RIGHT.map((s) => <SourceNode key={s.label} label={s.label} held={s.held} />)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
          <span className="c0-label">The same bureau proves</span>
          {["tenant isolation", "agent approval gates", "inventory reserved before confirm", "real state change, not just the screen"].map((t) => (
            <span key={t} className="c0-inv"><span className="t" />{t}</span>
          ))}
        </div>
      </div>
      <StudyTag>Concept B · requirement + evidence sources</StudyTag>
    </div>
  );
}

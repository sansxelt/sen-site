import type { Metadata } from "next";
import "../c0.css";
import { Wordmark, Seal, StudyTag } from "../parts";
import { OBLIGATIONS, RECORDS } from "../../fixtures";

export const metadata: Metadata = { title: "0C · D — the release gate", robots: { index: false } };
const rec = RECORDS[0];

function Arrow() {
  return <svg width="46" height="16" viewBox="0 0 46 16" fill="none" aria-hidden style={{ flex: "none" }}><path d="M0 8h40M34 2l6 6-6 6" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ConceptD() {
  return (
    <div className="c0">
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "0 clamp(24px,3.5vw,52px)" }}>
        <div className="c0-top">
          <Wordmark />
          <a className="c0-top-cta" href="#">Request a verification</a>
        </div>

        <div style={{ paddingTop: 12, paddingBottom: 26 }}>
          <span className="c0-label">AI builds. Vraelis proves.</span>
          <h1 className="c0-thesis" style={{ fontSize: "clamp(2.5rem,5vw,4.4rem)", margin: "12px 0 0", maxWidth: "20ch" }}>Nothing ships on the <span className="g">agent&rsquo;s word.</span></h1>
        </div>

        {/* the gate: change in → proof → verdict out */}
        <div className="c0-cols" style={{ display: "grid", gridTemplateColumns: "0.9fr auto 1.5fr auto 1fr", gap: "clamp(10px,1.4vw,20px)", alignItems: "center" }}>
          {/* the agent's change enters */}
          <div>
            <span className="c0-label">The agent completes</span>
            <div className="c0-clause" style={{ marginTop: 12 }}>
              <div className="c0-clause-h"><span className="c0-clause-ref">deploy a41d0c2</span><span className="c0-clause-src" style={{ color: "var(--green)" }}>✓ done</span></div>
              <div style={{ padding: "16px 16px 18px" }}>
                <p style={{ fontSize: 15, lineHeight: 1.35, color: "var(--ink)", margin: 0, fontWeight: 500 }}>&ldquo;Subscription checkout and Pro access are complete and working.&rdquo;</p>
              </div>
            </div>
          </div>

          <span className="c0-hide-m"><Arrow /></span>

          {/* the Vraelis proof gate */}
          <div className="c0-chamber">
            <div className="c0-chamber-h"><span className="live" />Vraelis · proof gate</div>
            <div style={{ padding: "8px 0 10px" }}>
              {OBLIGATIONS.slice(0, 5).map((o, i) => {
                const st = rec.steps[i].state;
                return (
                  <div key={o.id} className={`c0-ob ${st === "pass" ? "c0-ob--pass" : st === "fail" ? "c0-ob--fail" : ""}`} style={{ padding: "9px 20px" }}>
                    <span className="mk">{st === "pass" ? <Chk /> : st === "fail" ? <Ex /> : <span style={{ width: 5, height: 5, borderRadius: 9, background: "currentColor" }} />}</span>
                    <span className="tx" style={{ fontSize: 13.5 }}>{o.short}</span>
                    <span className="st">{st === "pass" ? "held" : st === "fail" ? "broke" : ""}</span>
                  </div>
                );
              })}
              <div style={{ padding: "6px 20px 2px", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.05em", color: "var(--chamber-ink-2)" }}>+ 2 more obligations · not reached</div>
            </div>
          </div>

          <span className="c0-hide-m"><Arrow /></span>

          {/* the verdict leaves */}
          <div style={{ position: "relative", textAlign: "center" }}>
            <div style={{ display: "inline-block", position: "relative" }}>
              <Seal verdict="rejected" size={150} rotate={-6} />
            </div>
            <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: "clamp(22px,2.2vw,30px)", letterSpacing: "-0.03em", color: "var(--red)", marginTop: 8, lineHeight: 0.95 }}>Release held</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", marginTop: 8, letterSpacing: "0.03em" }}>evidence on file · repair &amp; re-verify</div>
          </div>
        </div>

        {/* the other outcome: a proof-carrying release */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 30, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><svg width="26" height="26" viewBox="0 0 200 200" style={{ flex: "none" }}><circle cx="100" cy="100" r="88" stroke="var(--green)" strokeWidth="10" fill="none" /><path d="M62 100 l24 24 l52 -58" stroke="var(--green)" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 600 }}>When it holds, the release ships with the proof attached</span></span>
          <span className="c0-label" style={{ marginLeft: "auto" }}>proven the same way</span>
          {["tenant isolation", "agent approval gates", "inventory reserved"].map((t) => <span key={t} className="c0-inv"><span className="t" />{t}</span>)}
        </div>
      </div>
      <StudyTag>Concept D · the release gate</StudyTag>
    </div>
  );
}

function Chk() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Ex() { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" /></svg>; }

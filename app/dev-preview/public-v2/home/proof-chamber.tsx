"use client";

// The contained dark proof chamber that sits inside the bright hero. It shows the tenant isolation moment in a
// compact, polished artifact: the agent's claim, the business invariant, the live result, and the decision.
// Two states: "Challenge" (Vraelis builds the isolated environment and runs its checks) and "Result" (the breach
// and the rejection). Light interaction, deterministic, keyboard accessible. Copy avoids middots and dashes.

import { useState } from "react";

export function ProofChamber() {
  const [view, setView] = useState<"challenge" | "result">("result");
  const result = view === "result";
  return (
    <div className="vh-chamber">
      <div className="vh-ch-bar">
        <span className="vh-ch-live"><span className="d" />Live verification</span>
        <span className="vh-ch-tag">tenant isolation</span>
        <span className="vh-ch-toggle" role="tablist" aria-label="Verification view">
          <button type="button" role="tab" aria-pressed={!result} className="vh-ch-tbtn" onClick={() => setView("challenge")}>Challenge</button>
          <button type="button" role="tab" aria-pressed={result} className="vh-ch-tbtn" onClick={() => setView("result")}>Result</button>
        </span>
      </div>

      <div className="vh-ch-body">
        <div className="vh-ch-step">
          <span className="vh-ch-k">agent claim</span>
          <span className="vh-ch-claim">&ldquo;Tenant permissions fixed.&rdquo; <span style={{ color: "var(--ch-ink-2)", fontFamily: "var(--mono)", fontSize: 11 }}>deploy 9f2a11c</span></span>
        </div>

        <div className="vh-ch-step">
          <span className="vh-ch-k">business<br />invariant</span>
          <span className="vh-ch-law">A user can only access data belonging to their own organization.</span>
        </div>

        {result ? (
          <>
            <div className="vh-ch-step">
              <span className="vh-ch-k">live<br />result</span>
              <div className="vh-ch-screen">
                <div className="vh-ch-screen-h"><span className="av">A</span>User A, signed in to Organization A</div>
                <div className="vh-ch-rw"><span className="dot" /><span className="nm">Onboarding checklist</span><span className="own">org_a</span></div>
                <div className="vh-ch-rw"><span className="dot" /><span className="nm">Team roster</span><span className="own">org_a</span></div>
                <div className="vh-ch-rw vh-ch-rw--foreign"><span className="dot" /><span className="nm">Q3 Financials.xlsx</span><span className="own">owner: Organization B</span></div>
                <div className="vh-ch-rw"><span className="dot" /><span className="nm">Meeting notes</span><span className="own">org_a</span></div>
              </div>
            </div>
            <div className="vh-ch-verdict">
              <span className="w">Release rejected.</span>
              <span className="n">User A retrieved Organization B data. Evidence reconciled from browser, API, identity, and record owner.</span>
            </div>
          </>
        ) : (
          <>
            <div className="vh-ch-step">
              <span className="vh-ch-k">fresh<br />challenge</span>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["A", "User A", "Organization A", "#3E63DD"],
                  ["B", "User B", "Organization B", "#C6792B"],
                ].map(([i, n, o, c]) => (
                  <div key={i as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid var(--ch-line)", borderRadius: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: c as string, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>{i}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 550 }}>{n}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ch-ink-2)" }}>{o}, fresh session</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="vh-ch-verdict" style={{ borderColor: "var(--ch-line)" }}>
              <span className="w" style={{ color: "var(--ch-grn)" }}>Verifying</span>
              <span className="n">Vraelis built two isolated organizations with its own users and is running four independent checks against the live system.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

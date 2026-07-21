"use client";

import { useEffect, useRef, useState } from "react";

// The homepage's main visual: one verification, playing out.
//
// It is a timeline rather than a dashboard screenshot on purpose. A screenshot shows what the software looks
// like; this shows what the software DOES, which is the thing nobody understands yet. Someone who watches
// fifteen seconds of it should be able to explain Vraelis to a colleague.
//
// THE HONESTY CONSTRAINT that shapes every line below: this depicts the product's real sequence, and it must
// not depict a capability that does not exist. So the failure shown is an entitlement that never applied,
// observed in a browser, which is exactly what Vraelis does today. No payment-processor introspection, no
// database assertion, no email check. The steps are labelled as an illustration, not as a live run.

type Step = {
  label: string;
  detail?: string;
  kind: "normal" | "fail" | "pass";
  /** Milliseconds this step appears to take. Uneven on purpose: a real run is not metronomic. */
  ms: number;
};

const STEPS: Step[] = [
  { label: "Claim received", detail: "Checkout grants Pro access and keeps it after signing in again", kind: "normal", ms: 900 },
  { label: "6 requirements derived", detail: "Machine-derived, no human review", kind: "normal", ms: 1100 },
  { label: "Live deployment opened", kind: "normal", ms: 800 },
  { label: "Payment completed", kind: "pass", ms: 1000 },
  { label: "Entitlement never applied", detail: "Account still reports Free after a successful payment", kind: "fail", ms: 1400 },
  { label: "Evidence captured", detail: "Step trace, console, failed requests", kind: "normal", ms: 800 },
  { label: "Repair returned to the agent", kind: "normal", ms: 1000 },
  { label: "New deployment detected", kind: "normal", ms: 900 },
  { label: "Reverified", kind: "pass", ms: 1200 },
];

const RESTART_PAUSE = 4200;

export function VerificationTimeline() {
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect reduced motion by rendering the finished state immediately. Someone who has asked the system
    // to stop animating things should still be able to read the whole story.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(STEPS.length); return; }

    const tick = () => {
      setShown((n) => {
        const next = n >= STEPS.length ? 0 : n + 1;
        const delay = next === 0 ? 600 : n >= STEPS.length ? RESTART_PAUSE : STEPS[n].ms;
        timer.current = setTimeout(tick, delay);
        return next;
      });
    };
    timer.current = setTimeout(tick, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const done = shown >= STEPS.length;

  return (
    <div style={{
      border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", background: "var(--bg-1)",
      boxShadow: "var(--shadow-sm)", overflow: "hidden", minWidth: 0,
    }}>
      <div className="codebar" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <i /><i /><i />
        <span>verification</span>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        {/* Fixed min-height so the surrounding layout does not jump as steps appear. A hero that reflows
            while you read it feels broken even when it is working. */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11, minHeight: 268 }}>
          {STEPS.slice(0, shown).map((s, i) => (
            <li key={i} style={{
              display: "grid", gridTemplateColumns: "14px minmax(0,1fr)", gap: 11, alignItems: "start",
              animation: "vt-in .34s var(--ease-out) both",
            }}>
              <span aria-hidden style={{
                width: 8, height: 8, borderRadius: 999, marginTop: 6,
                background: s.kind === "fail" ? "var(--warn, #8a4b2a)" : s.kind === "pass" ? "var(--acc-deep)" : "var(--line-3)",
                boxShadow: s.kind === "fail" || s.kind === "pass" ? "0 0 0 3px var(--acc-soft)" : "none",
              }} />
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: "block", fontSize: 13.5, lineHeight: 1.4,
                  color: s.kind === "fail" ? "var(--fg-1)" : "var(--fg-2)",
                  fontWeight: s.kind === "fail" ? 600 : 500,
                }}>{s.label}</span>
                {s.detail && (
                  <span style={{ display: "block", fontSize: 12, lineHeight: 1.45, color: "var(--fg-4)", marginTop: 2, textWrap: "pretty" }}>{s.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ol>

        <div style={{
          marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--line-1)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            color: done ? "var(--acc-deep)" : "var(--fg-5)",
            transition: "color .3s ease",
          }}>{done ? "Verified" : "Running"}</span>
          {/* Labelled as an illustration. The timeline shows the real sequence, but it is not a live run, and
              a visitor should never have to wonder which. */}
          <span style={{ fontFamily: "var(--font-code)", fontSize: 10, color: "var(--fg-5)" }}>illustration</span>
        </div>
      </div>

      <style>{`
        @keyframes vt-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { li { animation: none !important; } }
      `}</style>
    </div>
  );
}

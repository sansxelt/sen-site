"use client";

// The two-user state check, upgraded with a replay control. The rows are
// ported unchanged from the static TwoUserProof in app/rank/page.tsx; the
// only addition is the "Run the check" button that replays them one by one.
import { useEffect, useRef, useState } from "react";

const ROWS: { who: "A" | "B"; act: string; expect: string; ok: boolean }[] = [
  { who: "A", act: "Creates a project, sees “Saved”", expect: "Written to the database", ok: true },
  { who: "A", act: "Refreshes the page", expect: "Project is still there", ok: true },
  { who: "A", act: "Signs out, signs back in", expect: "Project survives a new session", ok: true },
  { who: "B", act: "Opens User A's project by id", expect: "Access is denied", ok: false },
];

const STEP_MS = 420;

const CSS = `
@keyframes tud-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
.tud-in { animation: tud-rise 380ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .tud-in { animation: none; } }
`;

// Stage machine: 1..4 = that many rows revealed, 5 = summary line and
// verdict pill are in. First paint shows the finished state.
export function TwoUserDemo() {
  const [stage, setStage] = useState(5);
  const [runId, setRunId] = useState(0); // 0 = never run, so nothing animates on load
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const run = () => {
    clearTimers();
    setRunId((n) => n + 1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(5); // no animation: show the final state instantly
      return;
    }
    setStage(0);
    for (let s = 1; s <= 5; s++) {
      timers.current.push(window.setTimeout(() => setStage(s), 60 + (s - 1) * STEP_MS));
    }
  };

  const settled = stage >= 5;

  return (
    <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
      <style>{CSS}</style>
      <div className="win__bar" style={{ flexWrap: "wrap", rowGap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Two-user state check</span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", color: "var(--fg-5)", marginLeft: 9 }}>illustrative</span>
        <button type="button" className="btn btn--ghost" onClick={run} style={{ marginLeft: "auto", fontSize: 13, padding: "7px 14px" }}>
          Run the check
        </button>
        <span aria-live="polite">
          {settled ? (
            <span key={`p${runId}`} className={runId > 0 ? "tud-in" : undefined} style={{ display: "inline-flex" }}>
              <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Isolation held</span>
            </span>
          ) : (
            <span className="pill" style={{ background: "#FEF6E7", color: "#B45309", borderColor: "#F3DFB0" }}>Running</span>
          )}
        </span>
      </div>
      <div style={{ padding: "clamp(16px,2.4vw,24px)", display: "grid", gap: 10 }}>
        {ROWS.map((r, i) => {
          const shown = stage > i;
          return (
            <div
              key={`${i}-${runId}`}
              className={shown && runId > 0 ? "tud-in" : undefined}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 11, background: "var(--bg-2)", border: "1px solid var(--line-1)", opacity: shown ? 1 : 0 }}
            >
              <span aria-hidden style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, color: "#fff", background: r.who === "A" ? "linear-gradient(135deg, var(--acc), var(--acc-deep))" : "linear-gradient(135deg, #7c8698, #5a6478)" }}>{r.who}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{r.act}</div>
                <div style={{ fontSize: 12, color: "var(--fg-4)" }}>{r.expect}</div>
              </div>
              <span aria-hidden style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, lineHeight: 1, paddingTop: 1, color: r.ok ? "var(--acc-deep)" : "#C0392B", background: r.ok ? "var(--acc-soft)" : "#FBEBEA", border: `1px solid ${r.ok ? "var(--acc-line)" : "#F0C7C2"}` }}>{r.ok ? "✓" : "✕"}</span>
            </div>
          );
        })}
        <div
          key={`f${runId}`}
          className={settled && runId > 0 ? "tud-in" : undefined}
          style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 2, opacity: settled ? 1 : 0 }}
        >
          Persistence held. Session survived. User B was denied. All three proven in a real browser.
        </div>
      </div>
    </div>
  );
}

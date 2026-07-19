"use client";

// Interactive Production Pass demonstration for the landing hero.
// Scripted results, labeled honestly as a demonstration: the real product
// runs your approved flows in a real browser and attaches evidence
// (screenshots, console, network, reproduction steps). This demo only
// shows the shape of the verdict a run produces.
import { useEffect, useRef, useState, type CSSProperties } from "react";

type ToneKey = "ready" | "running" | "blocked" | "muted";
const TONES: Record<ToneKey, { fg: string; bg: string; line: string }> = {
  ready:   { fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  running: { fg: "#B45309",         bg: "#FEF6E7",         line: "#F3DFB0" },
  blocked: { fg: "#C0392B",         bg: "#FBEBEA",         line: "#F0C7C2" },
  muted:   { fg: "var(--fg-4)",     bg: "var(--bg-2)",     line: "var(--line-2)" },
};

function Pill({ tone, text }: { tone: ToneKey; text: string }) {
  const t = TONES[tone];
  return (
    <span className="pill" style={{ background: t.bg, color: t.fg, borderColor: t.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>
      {text}
    </span>
  );
}

// The approved requirements a run verifies, in order. The same requirements run in every scenario — a
// scenario just reflects what the system actually did against a given build.
const FLOWS = [
  { name: "A record persists", expect: "Create it, then confirm it is still there on a fresh read." },
  { name: "Access stays private", expect: "Another user must not be able to reach it." },
  { name: "The core action holds", expect: "The primary workflow completes end to end." },
] as const;

// Scenarios, not a mandatory repair sequence. READY is the default. Customers never manufacture a failure.
type ModeKey = "passed" | "failed" | "newBuild";
type FlowResult = { ok: boolean; note: string; repaired?: boolean };
type Mode = {
  key: ModeKey;
  label: string;
  results: [FlowResult, FlowResult, FlowResult];
  verdict: { tone: "ready" | "blocked"; pill: string; title: string; count: string; line: string };
};

const MODES: Mode[] = [
  {
    key: "passed",
    label: "All passed",
    results: [
      { ok: true, note: "Created and confirmed present on a fresh read." },
      { ok: true, note: "A second user is correctly refused access." },
      { ok: true, note: "The core workflow completes end to end." },
    ],
    verdict: {
      tone: "ready",
      pill: "READY",
      title: "The system behaves as required",
      count: "3 of 3 requirements held",
      line: "The complete approved contract passed. On a real run this decision carries the evidence behind it, tied to the exact build.",
    },
  },
  {
    key: "failed",
    label: "Critical failure",
    results: [
      { ok: true, note: "Created and confirmed present on a fresh read." },
      { ok: false, note: "A second user could reach data that should be private." },
      { ok: true, note: "The core workflow completes end to end." },
    ],
    verdict: {
      tone: "blocked",
      pill: "BLOCKED",
      title: "Critical required behavior failed",
      count: "1 critical requirement failed",
      line: "A critical promise did not hold. On a real run the failure arrives with factual evidence and exact reproduction steps.",
    },
  },
  {
    key: "newBuild",
    label: "Under review",
    results: [
      { ok: true, note: "Created and confirmed present on a fresh read." },
      { ok: true, repaired: true, note: "A previously-failed requirement now passes on this build." },
      { ok: true, note: "The core workflow completes end to end." },
    ],
    verdict: {
      tone: "ready",
      pill: "REPAIR VERIFIED",
      title: "A known issue closed on this build",
      count: "Targeted rerun",
      line: "A known issue was rerun against a later build and now passes, without claiming full coverage. The issue keeps its lineage across releases.",
    },
  },
];

const STEP_MS = 450;

// Scoped animation helpers. The global reduced-motion kill switch also
// applies, but the component carries its own so it stays self-contained.
const CSS = `
@keyframes pd-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
.pd-in { animation: pd-rise 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes pd-pop { from { opacity: 0; transform: scale(0.72); } to { opacity: 1; transform: scale(1); } }
.pd-pop { animation: pd-pop 240ms cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes pd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.pd-pulse { animation: pd-pulse 0.9s ease-in-out infinite; }
.pd-seg { max-width: 100%; flex-wrap: wrap; }
.pd-seg::-webkit-scrollbar { display: none; }
.pd-seg button { padding: 8px 13px; font-size: 13.5px; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .pd-in, .pd-pop, .pd-pulse { animation: none; } }
`;

// Stage machine: 0 = all queued, 1..3 = flow (stage - 1) is running and
// earlier flows are done, 4 = all done and the verdict is in.
export function PassDemo() {
  const [mode, setMode] = useState<ModeKey>("passed"); // READY is the normal default
  const [stage, setStage] = useState(4); // first paint shows a resolved pass; runs animate on click
  const [runId, setRunId] = useState(0); // 0 = never run, so nothing animates on load
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const running = stage < 4;
  // One rule: if they're on it, they're on it. The active tab never replays, and while a pass is
  // animating every tab is locked, so mashing buttons (same or different) cannot restart or glitch a run.
  const run = (next: ModeKey) => {
    if (next === mode || stage < 4) return;
    clearTimers();
    setMode(next);
    setRunId((n) => n + 1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(4); // no animation: show the final state instantly
      return;
    }
    setStage(0);
    for (let s = 1; s <= 4; s++) {
      timers.current.push(window.setTimeout(() => setStage(s), 60 + (s - 1) * STEP_MS));
    }
  };

  const m = MODES.find((x) => x.key === mode) ?? MODES[0];
  const done = stage >= 4;
  const vTone = TONES[m.verdict.tone];

  return (
    <div className="win" style={{ textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
      <style>{CSS}</style>
      <div className="win__bar">
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, color: "var(--fg-2)" }}>Production Pass</span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, letterSpacing: "0.05em", color: "var(--fg-5)", marginLeft: 9 }}>interactive demonstration</span>
        <span style={{ marginLeft: "auto" }} aria-live="polite">
          {done ? <Pill tone={m.verdict.tone} text={m.verdict.pill} /> : <Pill tone="running" text="RUNNING" />}
        </span>
      </div>

      <div style={{ padding: "clamp(18px,2.6vw,28px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="seg pd-seg">
            {MODES.map((x) => {
              const active = x.key === mode;
              const locked = running && !active;
              return (
                <button key={x.key} type="button" className={active ? "on" : undefined} aria-pressed={active} aria-disabled={active || locked}
                  onClick={() => run(x.key)} style={locked ? { opacity: 0.45, cursor: "default" } : active ? { cursor: "default" } : undefined}>
                  {x.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)" }} aria-live="polite">{running ? "Verification in progress\u2026" : "Pick a scenario, watch the verification run."}</span>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {FLOWS.map((f, i) => {
            const r = m.results[i];
            const phase = stage >= i + 2 ? "done" : stage === i + 1 ? "running" : "pending";
            const markBase: CSSProperties = {
              flex: "none", width: 22, height: 22, borderRadius: "50%",
              display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
            };
            const label = phase === "done" ? (r.ok ? "Pass" : "Fail") : phase === "running" ? "Running" : "Queued";
            const labelColor = phase === "done" ? (r.ok ? "var(--acc-deep)" : TONES.blocked.fg) : phase === "running" ? TONES.running.fg : "var(--fg-5)";
            return (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderRadius: 12, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                {phase === "done" ? (
                  <span key={`m${runId}-${i}`} className={runId > 0 ? "pd-pop" : undefined} aria-hidden style={{ ...markBase, color: r.ok ? "var(--acc-deep)" : TONES.blocked.fg, background: r.ok ? "var(--acc-soft)" : TONES.blocked.bg, border: `1px solid ${r.ok ? "var(--acc-line)" : TONES.blocked.line}`, lineHeight: 1, paddingTop: 1 }}>
                    {r.ok ? "✓" : "✕"}
                  </span>
                ) : phase === "running" ? (
                  <span aria-hidden style={{ ...markBase, background: TONES.running.bg, border: `1px solid ${TONES.running.line}` }}>
                    <i className="pd-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: TONES.running.fg, display: "block" }} />
                  </span>
                ) : (
                  <span aria-hidden style={{ ...markBase, background: "var(--bg-1)", border: "1px solid var(--line-3)" }}>
                    <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--line-3)", display: "block" }} />
                  </span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, color: "var(--fg-1)", fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.5, marginTop: 1 }}>{phase === "done" ? r.note : f.expect}</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                  {phase === "done" && r.repaired && (
                    <span key={`t${runId}`} className={runId > 0 ? "pd-pop" : undefined} style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--acc-deep)", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
                      Repair verified
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: labelColor }}>{label}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Verdict slab. Space is reserved so the window does not jump while the pass runs. */}
        <div style={{ marginTop: 14, minHeight: 118 }} aria-live="polite">
          {done ? (
            <div
              key={`v${runId}-${mode}`}
              className={runId > 0 ? "pd-in" : undefined}
              style={{
                padding: "16px 18px", borderRadius: 12,
                background: vTone.bg, border: `1px solid ${vTone.line}`,
                boxShadow: m.verdict.tone === "ready" ? "0 10px 30px -18px var(--acc-glow)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <Pill tone={m.verdict.tone} text={m.verdict.pill} />
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: vTone.fg }}>{m.verdict.count}</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(1.15rem, 2.2vw, 1.45rem)", letterSpacing: "-0.01em", color: m.verdict.tone === "ready" ? "var(--acc-deep)" : "var(--fg-1)" }}>
                {m.verdict.title}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginTop: 6 }}>{m.verdict.line}</div>
            </div>
          ) : (
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "var(--bg-2)", border: "1px dashed var(--line-2)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Verdict pending</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-4)", lineHeight: 1.55 }}>The pass decides only after every approved flow has run.</div>
            </div>
          )}
        </div>

        <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.55 }}>
          A scripted demonstration of the decision. A real run executes your approved requirements against the exact build and attaches factual evidence: expected versus observed, tied to the runtime it ran on.
        </div>
      </div>
    </div>
  );
}

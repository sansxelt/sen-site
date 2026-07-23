"use client";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The flagship artifact: the REAL Verification Result surface (Design 02), rendered as the hero's substance
// rather than a schematic beside it. It is the actual product language, claim to requirements to outcome to
// step-level evidence to a decision, plus the immutable lineage that a failed run and its reverifications are
// each preserved separately.
//
// HONESTY: every record here is illustrative and labelled as such. It reproduces the product's real sequence
// (a payment that succeeds while the entitlement never applies, an incomplete repair rejected, a full repair
// verified) using the browser-observable outcomes Vraelis actually produces. No fabricated customer, metric,
// screenshot, or capability. The green marks live on the STEP TRACE, where per-step pass/fail is real product
// data, never on the requirement list (the product does not claim per-requirement proof).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

type Verdict = "verified" | "failed";
type StepState = "ok" | "fail" | "skip";

type Rec = {
  id: string;
  verdict: Verdict;
  when: string;
  observed: string;
  why: string;
  steps: { text: string; state: StepState; ms: number }[];
  finding?: { title: string; expected: string; observed: string };
  evidence: { screenshots: number; console: number; network: number };
  note: string;
};

const CLAIM = "A customer can upgrade to Pro and receive access immediately.";

const REQUIREMENTS = [
  "The upgrade action is reachable from the pricing page",
  "Payment completes without an error",
  "The account reflects the Pro plan immediately afterwards",
  "Pro-only capability is actually available",
  "The plan survives a fresh sign-in",
  "No error state is shown on the way through",
];

// The three separate, immutable records of one lineage. Ordered oldest to newest.
const RECORDS: Rec[] = [
  {
    id: "vrf_4a1c8e",
    verdict: "failed",
    when: "Jul 21, 2026",
    observed: "Payment completed, but the account still reported Free afterwards.",
    why: "The claim did not hold. One critical flow failed on the tested deployment.",
    steps: [
      { text: "Open the pricing page", state: "ok", ms: 412 },
      { text: "Start the upgrade to Pro", state: "ok", ms: 690 },
      { text: "Complete payment", state: "ok", ms: 1180 },
      { text: "Confirm the account shows the Pro plan", state: "fail", ms: 900 },
      { text: "Use a Pro-only capability", state: "skip", ms: 0 },
      { text: "Sign out, back in, confirm Pro persists", state: "skip", ms: 0 },
    ],
    finding: {
      title: "Entitlement never applied after a successful payment",
      expected: "The account reflects the Pro plan immediately after payment completes.",
      observed: "The flow stopped at step 4: the account still reported Free after a successful payment.",
    },
    evidence: { screenshots: 4, console: 2, network: 1 },
    note: "The bug a claim of done would have shipped.",
  },
  {
    id: "vrf_9d20b7",
    verdict: "failed",
    when: "Jul 22, 2026",
    observed: "Pro applied at checkout, then was lost after signing back in.",
    why: "The targeted repair did not hold across sessions. One critical flow failed on the tested deployment.",
    steps: [
      { text: "Open the pricing page", state: "ok", ms: 401 },
      { text: "Start the upgrade to Pro", state: "ok", ms: 655 },
      { text: "Complete payment", state: "ok", ms: 1090 },
      { text: "Confirm the account shows the Pro plan", state: "ok", ms: 720 },
      { text: "Use a Pro-only capability", state: "ok", ms: 540 },
      { text: "Sign out, back in, confirm Pro persists", state: "fail", ms: 830 },
    ],
    finding: {
      title: "Pro access not persisted across sessions",
      expected: "The plan survives a fresh sign-in and stays applied.",
      observed: "The flow stopped at step 6: the account returned to Free after signing back in.",
    },
    evidence: { screenshots: 5, console: 1, network: 0 },
    note: "An incomplete repair, rejected on its own evidence.",
  },
  {
    id: "vrf_ff9d6c",
    verdict: "verified",
    when: "Jul 22, 2026",
    observed: "The checked workflow completed with the expected result.",
    why: "Every critical flow in this verification passed on the tested deployment.",
    steps: [
      { text: "Open the pricing page", state: "ok", ms: 398 },
      { text: "Start the upgrade to Pro", state: "ok", ms: 642 },
      { text: "Complete payment", state: "ok", ms: 1105 },
      { text: "Confirm the account shows the Pro plan", state: "ok", ms: 705 },
      { text: "Use a Pro-only capability", state: "ok", ms: 512 },
      { text: "Sign out, back in, confirm Pro persists", state: "ok", ms: 761 },
    ],
    evidence: { screenshots: 6, console: 0, network: 0 },
    note: "The repair, independently reverified.",
  },
];

const TONE: Record<Verdict, { color: string; bg: string; border: string; label: string }> = {
  verified: { color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)", label: "Verified" },
  failed: { color: "#A8452A", bg: "#F6ECE7", border: "#E7CFC5", label: "Failed" },
};

const labelStyle = {
  fontFamily: "var(--font-code)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.09em",
  textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0,
};

function VerdictChip({ verdict, running }: { verdict: Verdict; running?: boolean }) {
  if (running) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 999,
        border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-4)",
        fontFamily: "var(--font-code)", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: "var(--fg-4)" }} />
        Running
      </span>
    );
  }
  const t = TONE[verdict];
  return (
    <span className="vp-chip" style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px 6px 11px", borderRadius: 999,
      border: `1px solid ${t.border}`, background: t.bg, color: t.color,
      fontFamily: "var(--font-code)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      <span aria-hidden style={{ display: "inline-flex" }}>
        <Ic d={verdict === "verified" ? I.check : I.x} size={13} sw={2.6} />
      </span>
      {t.label}
    </span>
  );
}

function StepRow({ text, state, ms, index }: { text: string; state: StepState; ms: number; index: number }) {
  const failed = state === "fail";
  const skipped = state === "skip";
  return (
    <li style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 11px", borderRadius: 9,
      background: failed ? "#F6ECE7" : "var(--bg-2)", border: `1px solid ${failed ? "#E7CFC5" : "var(--line-2)"}`,
      opacity: skipped ? 0.6 : 1, animation: "vp-in .3s var(--ease-out) both",
    }}>
      <span aria-hidden style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", width: 14, textAlign: "right", flex: "none", marginTop: 2 }}>{index + 1}</span>
      <span aria-hidden style={{ display: "inline-flex", flex: "none", marginTop: 2, color: state === "ok" ? "var(--acc-deep)" : failed ? "#A8452A" : "var(--fg-4)" }}>
        <Ic d={state === "ok" ? I.check : failed ? I.x : I.dash} size={13} sw={2.5} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: failed ? "var(--fg-1)" : "var(--fg-2)", fontWeight: failed ? 600 : 500 }}>{text}</span>
      <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", flex: "none", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{ms ? `${ms} ms` : ""}</span>
    </li>
  );
}

// The result surface itself. `revealed` limits how many steps have appeared (for the hero's one-time fill);
// pass Infinity for a fully settled record. `running` shows the Running chip until the reveal resolves.
function ResultPlate({ rec, revealed = Infinity, running = false }: { rec: Rec; revealed?: number; running?: boolean }) {
  const t = TONE[rec.verdict];
  const steps = rec.steps.slice(0, revealed === Infinity ? rec.steps.length : revealed);
  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-lg)", overflow: "hidden",
    }}>
      {/* Head: verdict + provenance. A single full-width hairline in the verdict tone, never a heavy banner. */}
      <div style={{ padding: "clamp(16px, 2.2vw, 22px) clamp(18px, 2.4vw, 26px)", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={labelStyle}>Verification</span>
            <VerdictChip verdict={rec.verdict} running={running} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px 14px", flexWrap: "wrap", fontSize: 12, color: "var(--fg-4)" }}>
            <span style={{ fontFamily: "var(--font-code)" }}>#{rec.id}</span>
            <span>{rec.when}</span>
          </div>
        </div>
        <p style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(1.15rem, 2vw, 1.42rem)", lineHeight: 1.32, letterSpacing: "-0.015em", color: "var(--fg-1)", maxWidth: "36ch" }}>
          {CLAIM}
        </p>
      </div>

      {/* Body: what had to be true (derived) beside what the browser actually did (the evidence). */}
      <div className="cols-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1fr)", gap: "clamp(18px, 2.4vw, 30px)", padding: "clamp(18px, 2.4vw, 26px)" }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 12 }}>What had to be true</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 9 }}>
            {REQUIREMENTS.map((r) => (
              <li key={r} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: 999, background: "var(--fg-4)", flex: "none", marginTop: 7 }} />
                <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--fg-3)" }}>{r}</span>
              </li>
            ))}
          </ul>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", lineHeight: 1.5 }}>
            6 requirements derived. Machine derived, not human reviewed, always shown to you.
          </p>
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 12 }}>What happened in a real browser</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, minHeight: 6 * 42 }}>
            {steps.map((s, i) => (
              <StepRow key={i} text={s.text} state={s.state} ms={s.ms} index={i} />
            ))}
          </ol>
        </div>
      </div>

      {/* Outcome + a finding when the claim did not hold. The observed sentence leads; the decision is metadata. */}
      <div style={{ padding: "clamp(16px, 2.2vw, 22px) clamp(18px, 2.4vw, 26px)", borderTop: "1px solid var(--line-2)", background: "var(--bg-2)" }}>
        <div style={{ ...labelStyle, marginBottom: 7 }}>Outcome</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--fg-1)", maxWidth: "62ch" }}>{rec.observed}</p>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--fg-3)", maxWidth: "64ch" }}>{rec.why}</p>

        {rec.finding ? (
          <div style={{ marginTop: 14, border: "1px solid #E7CFC5", background: "#FBF4F0", borderRadius: 12, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ ...labelStyle, color: "#A8452A" }}>Critical finding</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{rec.finding.title}</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div><span style={{ ...labelStyle }}>Expected</span><p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>{rec.finding.expected}</p></div>
              <div><span style={{ ...labelStyle }}>Observed</span><p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>{rec.finding.observed}</p></div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: "6px 16px", flexWrap: "wrap", marginTop: 14 }}>
          <span style={labelStyle}>Evidence retained</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{rec.evidence.screenshots} screenshots</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{rec.evidence.console} console errors</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{rec.evidence.network} failed requests</span>
          <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{rec.steps.filter((s) => s.state !== "skip").length} steps traced</span>
        </div>
      </div>
    </div>
  );
}

// The lineage rail: three separate immutable records, oldest to newest. A later record never rewrites an
// earlier one. `activeId` marks the record currently in view.
function LineageRail({ activeId, onPick }: { activeId?: string; onPick?: (id: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap" }}>
      {RECORDS.map((r, i) => {
        const t = TONE[r.verdict];
        const active = r.id === activeId;
        const interactive = Boolean(onPick);
        const Comp: React.ElementType = interactive ? "button" : "div";
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", flex: "1 1 200px", minWidth: 0 }}>
            <Comp
              {...(interactive ? { onClick: () => onPick?.(r.id), "aria-pressed": active, type: "button" } : {})}
              style={{
                flex: 1, minWidth: 0, textAlign: "left", cursor: interactive ? "pointer" : "default",
                display: "grid", gap: 5, padding: "12px 14px", borderRadius: 12, fontFamily: "inherit",
                border: `1px solid ${active ? t.border : "var(--line-2)"}`,
                background: active ? t.bg : "var(--bg-1)",
                boxShadow: active ? "none" : "var(--shadow-sm)",
                transition: "border-color .18s ease, background .18s ease, transform .18s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: t.color, flex: "none", boxShadow: active ? `0 0 0 3px ${t.bg}` : "none" }} />
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: t.color }}>{t.label}</span>
                {r.id === RECORDS[RECORDS.length - 1].id ? <span style={{ fontSize: 10.5, color: "var(--fg-5)", marginLeft: "auto" }}>this record</span> : null}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.4 }}>{r.note}</span>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)" }}>{r.when}</span>
            </Comp>
            {i < RECORDS.length - 1 ? (
              <span aria-hidden className="vp-connector" style={{ flex: "none", width: 22, height: 1, background: "var(--line-3)", margin: "0 2px" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// A compact, one-line telling of the lineage for the hero: the full interactive rail lives in the proof
// section, so the hero states the hook in words rather than repeating the same three-node control.
function LineageSummary() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span aria-hidden style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        {RECORDS.map((r, i) => (
          <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: TONE[r.verdict].color }} />
            {i < RECORDS.length - 1 ? <span style={{ width: 14, height: 1, background: "var(--line-3)" }} /> : null}
          </span>
        ))}
      </span>
      <span style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>
        Failed, failed, then Verified. Three separate records, each one preserved, none overwritten.
      </span>
    </div>
  );
}

// ── Hero flagship: the Verified record, filled once on load, with the lineage beneath. ──
export function HeroFlagship() {
  const verified = RECORDS[RECORDS.length - 1];
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(verified.steps.length); return; }
    const tick = () => {
      setShown((n) => {
        if (n >= verified.steps.length) return n;
        timer.current = setTimeout(tick, 300);
        return n + 1;
      });
    };
    timer.current = setTimeout(tick, 520);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [verified.steps.length]);

  const done = shown >= verified.steps.length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className={done ? "vp-plate vp-plate--done" : "vp-plate"}>
        <ResultPlate rec={verified} revealed={shown} running={!done} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <LineageSummary />
        <p style={{ margin: 0, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5 }}>
          Illustrative record, from a real production lineage. Not a live run.
        </p>
      </div>
      <PlateStyles />
    </div>
  );
}

// ── Openable example: switch among the three real records and read the actual evidence, no sign-in. ──
export function ProofViewer() {
  const [activeId, setActiveId] = useState(RECORDS[0].id);
  const rec = RECORDS.find((r) => r.id === activeId) ?? RECORDS[0];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <LineageRail activeId={activeId} onPick={setActiveId} />
      <div key={activeId} style={{ animation: "vp-fade .28s var(--ease-out) both" }}>
        <ResultPlate rec={rec} />
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", lineHeight: 1.5 }}>
        Illustrative record, reproducing a real production verification lineage. Pick a record above to read its evidence.
      </p>
      <PlateStyles />
    </div>
  );
}

function PlateStyles() {
  return (
    <style>{`
      @keyframes vp-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
      @keyframes vp-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes vp-settle { 0% { box-shadow: var(--shadow-lg); } 40% { box-shadow: var(--shadow-lg), 0 0 0 3px var(--acc-line), 0 0 34px -6px var(--acc-glow); } 100% { box-shadow: var(--shadow-lg); } }
      .vp-plate--done { animation: vp-settle 1100ms var(--ease-out) both; border-radius: var(--r-lg); }
      .vp-chip { transition: background .3s ease, color .3s ease, border-color .3s ease; }
      @media (max-width: 560px) { .vp-connector { display: none; } }
      @media (prefers-reduced-motion: reduce) {
        .vp-plate--done { animation: none; }
        [style*="vp-in"], [style*="vp-fade"] { animation: none !important; }
      }
    `}</style>
  );
}

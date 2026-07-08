import type { ReactNode } from "react";
import { bandScore, type EvalResult, type CandidateEval, type LineFlag } from "@/lib/v-evaluator";

// The AI Check report. Deliberately NOT the human-vote ReportBody: no posterior, no
// "N judgments", no credible interval, every one of those would be fabricated for a
// single AI pass. This renders exactly what the evaluator produced: per-criterion
// scores, a computed recommendation, and line-level flags whose spans are verbatim
// from the customer's own output. Server component (pure render).

const OUTPUT_LABELS: Record<string, string> = {
  support_reply: "Support reply", onboarding: "Onboarding", marketing_copy: "Marketing copy",
  agent_action: "Agent action", other: "Output",
};
const ISSUE_LABELS: Record<string, string> = {
  dismissive: "Dismissive", overpromise: "Overpromise", confusing: "Confusing",
  risky: "Risky", inaccurate: "Inaccurate", tone: "Tone", other: "Issue",
};

const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)" } as const;
const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

function sevColor(s: string): string { return s === "high" ? "var(--err)" : s === "medium" ? "var(--acc-deep)" : "var(--fg-4)"; }
function scoreColor(n: number): string { return n >= 75 ? "var(--acc-deep)" : n >= 50 ? "var(--acc)" : "var(--fg-4)"; }

// Best-effort inline highlight: wrap each flag's span where it appears (case-insensitive,
// non-overlapping, first occurrence). Spans that don't match exactly are simply not
// highlighted inline, they still appear in the flags list with full detail.
function highlightSpans(text: string, flags: LineFlag[]): ReactNode {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number; severity: string }[] = [];
  for (const f of flags) {
    const needle = (f.span || "").toLowerCase().trim();
    if (!needle) continue;
    const idx = lower.indexOf(needle);
    if (idx >= 0) ranges.push({ start: idx, end: idx + needle.length, severity: f.severity });
  }
  ranges.sort((a, b) => a.start - b.start);
  const clean: typeof ranges = [];
  let lastEnd = -1;
  for (const r of ranges) { if (r.start >= lastEnd) { clean.push(r); lastEnd = r.end; } }
  if (!clean.length) return text;
  const out: ReactNode[] = [];
  let cursor = 0;
  clean.forEach((r, i) => {
    if (r.start > cursor) out.push(text.slice(cursor, r.start));
    out.push(
      <mark key={i} style={{ background: "var(--acc-soft)", color: "var(--fg-1)", borderBottom: `2px solid ${sevColor(r.severity)}`, borderRadius: 2, padding: "0 1px" }}>{text.slice(r.start, r.end)}</mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ width: 96, height: 7, borderRadius: 999, background: "var(--bg-2)", border: "1px solid var(--line-1)", overflow: "hidden", flex: "none" }}>
        <span style={{ display: "block", height: "100%", width: `${score}%`, background: scoreColor(score) }} />
      </span>
      <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: scoreColor(score), width: 26, textAlign: "right" }}>{score}</span>
    </span>
  );
}

function CandidateCard({ c, flags, isWinner }: { c: CandidateEval; flags: LineFlag[]; isWinner: boolean }) {
  const mine = flags.filter((f) => f.candidateIndex === c.index);
  return (
    <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", ...(isWinner ? { borderColor: "var(--acc-line)", background: "var(--acc-soft)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: isWinner ? "linear-gradient(135deg, var(--acc), var(--acc-deep))" : "var(--bg-2)", border: `1px solid ${isWinner ? "var(--acc-line)" : "var(--line-2)"}`, color: isWinner ? "#fff" : "var(--fg-4)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, flex: "none" }}>{c.label}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)" }}>Version {c.label}</span>
        {isWinner ? <span className="pill" style={{ fontSize: 10, color: "var(--acc-deep)", background: "var(--bg-1)" }}>Recommended</span> : null}
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-code)", fontSize: 12.5, color: scoreColor(c.overall) }}>Overall {Math.round(c.overall / 5) * 5}</span>
      </div>

      <p style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.6, margin: "0 0 14px", whiteSpace: "pre-wrap", padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>{highlightSpans(c.text, mine)}</p>

      {c.summary ? <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 14px" }}>{c.summary}</p> : null}

      <div style={{ display: "grid", gap: 8 }}>
        {c.scores.map((s) => (
          <div key={s.criterion} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--fg-2)", width: 132, flex: "none" }}>{s.label}</span>
            <ScoreBar score={bandScore(s.criterion, s.score)} />
            {s.note ? <span style={{ fontSize: 12, color: "var(--fg-4)", flex: 1, minWidth: 120 }}>{s.note}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlagRow({ f }: { f: LineFlag }) {
  return (
    <div style={{ display: "grid", gap: 6, padding: "14px 0", borderTop: "1px solid var(--line-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fff", background: sevColor(f.severity), borderRadius: 4, padding: "2px 6px" }}>{f.severity}</span>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>{ISSUE_LABELS[f.issue] ?? "Issue"}</span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>Version {f.candidateLabel}</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.5, margin: 0, paddingLeft: 12, borderLeft: `2px solid ${sevColor(f.severity)}`, fontStyle: "italic" }}>&ldquo;{f.span}&rdquo;</p>
      <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, margin: 0 }}>{f.why}</p>
      <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}><span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Fix: </span>{f.fix}</p>
    </div>
  );
}

export function CheckReport({ result, title, createdAt, calibrationSlot }: { result: EvalResult; title?: string | null; createdAt?: string | null; calibrationSlot?: ReactNode }) {
  const multi = result.candidates.length > 1;
  const winner = result.recommendedIndex != null ? result.candidates.find((c) => c.index === result.recommendedIndex) ?? null : null;
  const typeLabel = OUTPUT_LABELS[result.outputType] ?? "Output";

  return (
    <div>
      {/* header */}
      <p className="eyebrow">AI output check</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{title || `${typeLabel} check`}</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...kicker, marginBottom: 22 }}>
        <span>{typeLabel}</span><span>|</span>
        <span>{result.candidates.length} version{result.candidates.length === 1 ? "" : "s"}</span><span>|</span>
        <span>AI assessment</span>
        {result.model ? <><span>|</span><span>{result.model}</span></> : null}
        {createdAt ? <><span>|</span><span>{new Date(createdAt).toISOString().slice(0, 10)}</span></> : null}
      </div>

      {/* recommendation */}
      {multi && winner ? (
        <div className="card card--acc" style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>{winner.label}</div>
          <div>
            <div style={{ ...kicker, color: "var(--acc-deep)" }}>Recommendation</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)" }}>Ship Version {winner.label}</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>Highest overall score{result.margin != null ? `, leads the runner-up by ${result.margin} point${result.margin === 1 ? "" : "s"}` : ""}{result.margin != null && result.margin < 5 ? " (a close call)" : ""}</div>
            {result.recommendation ? <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>{result.recommendation}</div> : null}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ ...kicker, color: "var(--acc-deep)", marginBottom: 4 }}>{multi ? "Too close to call" : result.context === "published" ? "Highest-impact change" : "Review"}</div>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>{result.recommendation || (multi ? "The versions scored evenly. Use the flags below to break the tie." : "See the score and flags below.")}</div>
        </div>
      )}

      {/* candidates */}
      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        {[...result.candidates].sort((a, b) => b.overall - a.overall).map((c) => (
          <CandidateCard key={c.index} c={c} flags={result.flags} isWinner={winner?.index === c.index} />
        ))}
      </div>

      {/* flags */}
      {result.flags.length ? (
        <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 4 }}>Line-level flags</div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 6px" }}>Each quote is verbatim from your output, with a concrete suggested fix.</p>
          {result.flags.map((f, i) => <FlagRow key={i} f={f} />)}
        </div>
      ) : (
        <div style={{ ...box, background: "var(--bg-2)", padding: "clamp(14px, 2.2vw, 20px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 6 }}>Line-level flags</div>
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>No specific problem spans were flagged.</p>
        </div>
      )}

      {/* calibration: validate on real people + the rolling agreement rate (owner only) */}
      {calibrationSlot}

      {/* honest method note */}
      <div style={{ ...box, background: "var(--bg-2)", padding: "clamp(16px, 2.4vw, 22px)" }}>
        <div style={{ ...kicker, marginBottom: 8 }}>How to read this</div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.7, margin: 0 }}>
          This is an <strong style={{ color: "var(--fg-2)" }}>AI assessment</strong>{result.model ? ` generated by ${result.model}` : ""}, not a human judgment and not a guarantee. Every flagged span is quoted verbatim from your output, and the recommended version is computed from the scores shown, not asserted by the model. Scores are approximate and vary a little between runs, so they are rounded and not used by the pass or fail decision; the flags are. It informs your decision; it does not replace shipping judgment or real user testing.
        </p>
      </div>
    </div>
  );
}

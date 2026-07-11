import type { ReactNode } from "react";
import { bandScore, taskOutcome, type EvalResult, type CandidateEval, type LineFlag, type AiReview, type TaskFit, type TaskOutcome } from "@/lib/v-evaluator";
import { CorrectedBlock } from "./corrected-block";
import { AnalysisSources, type ReportAttachment } from "./analysis-sources";

// The AI Check report. Deliberately NOT the human-vote ReportBody: no posterior, no
// "N judgments", no credible interval, every one of those would be fabricated for a
// single AI pass. This renders exactly what the evaluator produced: per-criterion
// scores, a computed recommendation, and line-level flags whose spans are verbatim
// from the customer's own output. Server component (pure render).

const OUTPUT_LABELS: Record<string, string> = {
  support_reply: "Customer support", onboarding: "Onboarding", marketing_copy: "Marketing",
  agent_action: "Agent action", other: "Custom", product_ux: "Product & UX", long_form: "Long-form content",
};
const ISSUE_LABELS: Record<string, string> = {
  dismissive: "Dismissive", overpromise: "Overpromise", confusing: "Confusing",
  risky: "Risky", inaccurate: "Inaccurate", tone: "Tone", other: "Issue",
};

const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)" } as const;
const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

function sevColor(s: string): string { return s === "high" ? "var(--err)" : s === "medium" ? "var(--acc-deep)" : "var(--fg-4)"; }
function scoreColor(n: number): string { return n >= 75 ? "var(--acc-deep)" : n >= 50 ? "var(--acc)" : "var(--fg-4)"; }

// Task-fit verdict styling. Amber (revise) has no design token, so it is a literal that reads on
// both the light and dark report grounds; ship/fails reuse the existing green and error tokens.
const AMBER = "#c2831a";
const TASK_STYLE: Record<TaskFit["outcome"], { label: string; color: string }> = {
  ship: { label: "Ship", color: "var(--acc-deep)" },
  revise: { label: "Revise", color: AMBER },
  fails: { label: "Fails task", color: "var(--err)" },
};
const TASK_CHIP: Record<TaskOutcome, { label: string; color: string }> = {
  meets: { label: "Meets the request", color: "var(--acc-deep)" },
  revise: { label: "Misses requirements", color: AMBER },
  fails: { label: "Fails the request", color: "var(--err)" },
};

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
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-code)", fontSize: 12.5, color: scoreColor(c.overall) }}>Overall {bandScore("overall", c.overall)}</span>
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

// "Reads as AI-written": its own section, visually distinct from the overpromise flags. These
// tells are LOW/MEDIUM and never affect the pass/fail gate.
function AiTellsSection({ review }: { review: AiReview }) {
  const label = review.verdict === "reads_ai" ? "Reads as AI-written" : review.verdict === "some" ? "A few AI tells" : "Reads human";
  const color = review.verdict === "reads_ai" ? "var(--err)" : review.verdict === "some" ? "var(--acc-deep)" : "var(--fg-4)";
  return (
    <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ ...kicker }}>Reads as AI-written</div>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fff", background: color, borderRadius: 4, padding: "2px 7px" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)" }}>{review.count} tell{review.count === 1 ? "" : "s"}</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 4px", lineHeight: 1.5 }}>Spans that read as machine-written, each with a plainer human rewrite. These do not affect the pass or fail gate.{review.readsAsNote ? ` ${review.readsAsNote}` : ""}</p>
      {review.tells.map((t, i) => (
        <div key={i} style={{ display: "grid", gap: 4, padding: "11px 0", borderTop: "1px solid var(--line-1)" }}>
          <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.5 }}><span style={{ fontFamily: "var(--font-code)", fontSize: 9.5, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 8 }}>{t.kind.replace("_", " ")}</span>&ldquo;{t.span}&rdquo;</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}><span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Fix: </span>{t.fix}</div>
        </div>
      ))}
    </div>
  );
}

function FitList({ label, items, color, mark }: { label: string; items: string[]; color: string; mark: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      {items.map((it, i) => <div key={i} style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, display: "flex", gap: 6 }}><span style={{ color, flex: "none", fontWeight: 700 }} aria-hidden>{mark}</span>{it}</div>)}
    </div>
  );
}

// The headline answer when an original request was supplied: did the ship-pick actually do the job?
// SHIP / REVISE / FAILS TASK, derived from instruction fit + the risk flags on that version. Distinct
// from the risk gate itself (an instruction miss is never a HIGH safety flag).
function TaskVerdictBanner({ tf, multi }: { tf: TaskFit; multi: boolean }) {
  const v = TASK_STYLE[tf.outcome];
  return (
    <div style={{ ...box, borderLeft: `3px solid ${v.color}`, padding: "clamp(14px, 2.2vw, 20px)", marginBottom: 14, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: v.color, border: `1px solid ${v.color}`, borderRadius: 999, padding: "5px 12px", flex: "none" }}>{v.label}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...kicker, marginBottom: 3 }}>Did it do the job?{multi ? ` — Version ${tf.label}` : ""}</div>
        <div style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>{tf.reason}</div>
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 5 }}>Instruction fit {tf.score}/100. Separate from the risk flags below.</div>
      </div>
    </div>
  );
}

// "Did it do the task?": instruction fit vs the original request, judged separately from quality and
// never affecting the gate. Per candidate, so comparison mode shows which version fulfilled it best.
function InstructionFitSection({ result, winnerIndex }: { result: EvalResult; winnerIndex: number | null }) {
  const withFit = result.candidates.filter((c) => c.instructionFit);
  if (!withFit.length) return null;
  const req = result.originalRequest;
  const multi = withFit.length > 1;
  return (
    <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
      <div style={{ ...kicker, marginBottom: 6 }}>Instruction fit</div>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 12px", lineHeight: 1.55 }}>How fully each version did what the request asked, judged against your original request and kept separate from the quality scores. It never becomes a risk flag, but it decides which version is recommended and the ship verdict above.</p>
      {req ? (
        <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--line-1)", marginBottom: 14, whiteSpace: "pre-wrap" }}>
          <span style={{ fontFamily: "var(--font-code)", fontSize: 9.5, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>You asked</span>
          <div style={{ marginTop: 4 }}>{req.length > 400 ? `${req.slice(0, 400)}…` : req}</div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {withFit.map((c) => {
          const f = c.instructionFit!;
          return (
            <div key={c.index} style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                {multi ? <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-1)" }}>Version {c.label}</span> : null}
                {multi && c.index === winnerIndex ? <span className="pill" style={{ fontSize: 10, color: "var(--acc-deep)", background: "var(--bg-1)" }}>Recommended</span> : null}
                {(() => { const o = taskOutcome(f); return o ? <span className="pill" style={{ fontSize: 10, color: TASK_CHIP[o].color, background: "var(--bg-1)", border: `1px solid ${TASK_CHIP[o].color}` }}>{TASK_CHIP[o].label}</span> : null; })()}
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-code)", fontSize: 13, color: scoreColor(f.score) }}>Did the task: {f.score}/100</span>
              </div>
              {f.met.length ? <FitList label="Satisfied" items={f.met} color="var(--acc-deep)" mark="✓" /> : null}
              {f.missed.length ? <FitList label="Missed or partial" items={f.missed} color="var(--fg-3)" mark="•" /> : null}
              {f.contradictions.length ? <FitList label="Contradicts the request" items={f.contradictions} color="var(--err)" mark="!" /> : null}
              {f.fix ? <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, margin: "8px 0 0" }}><span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>To fit the task: </span>{f.fix}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Aggregate the persisted per-attachment capabilities into a short human summary for the audit panel.
const CAP_WORD: Record<string, string> = { visual: "visual", text_and_visual: "text + visual", text: "text", text_only_fallback: "text-only fallback", failed: "not analyzed" };
function capSummary(caps: NonNullable<EvalResult["attachmentCapabilities"]>): string {
  const counts: Record<string, number> = {};
  for (const c of caps) counts[c.capability] = (counts[c.capability] ?? 0) + 1;
  return Object.entries(counts).map(([k, n]) => `${n} ${CAP_WORD[k] ?? k}`).join(", ") || "none";
}

export function CheckReport({ result, title, createdAt, calibrationSlot, attachments }: { result: EvalResult; title?: string | null; createdAt?: string | null; calibrationSlot?: ReactNode; attachments?: ReportAttachment[] }) {
  const multi = result.candidates.length > 1;
  const winner = result.recommendedIndex != null ? result.candidates.find((c) => c.index === result.recommendedIndex) ?? null : null;
  const corrected = result.candidates.find((c) => c.correctedVersion); // only the ship-pick/sole candidate carries it
  const aiReview = result.candidates.find((c) => c.aiReview)?.aiReview ?? null;
  const typeLabel = OUTPUT_LABELS[result.outputType] ?? "Output";
  // Attachment audit surfaces only when a check actually had uploads, so text-only reports render unchanged.
  const hasAttachments = !!(attachments && attachments.length);
  const caps = result.attachmentCapabilities ?? [];

  return (
    <div>
      {/* header */}
      <p className="eyebrow">AI output check</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{title || `${typeLabel} check`}</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...kicker, marginBottom: 22 }}>
        <span>{typeLabel}</span><span>|</span>
        <span>{result.candidates.length} version{result.candidates.length === 1 ? "" : "s"}</span><span>|</span>
        <span>AI assessment</span>
        {aiReview && aiReview.count > 0 ? <><span>|</span><span style={{ color: aiReview.verdict === "reads_ai" ? "var(--err)" : "inherit" }}>{aiReview.count} AI tell{aiReview.count === 1 ? "" : "s"}</span></> : null}
        {result.model ? <><span>|</span><span>{result.model}</span></> : null}
        {createdAt ? <><span>|</span><span>{new Date(createdAt).toISOString().slice(0, 10)}</span></> : null}
      </div>

      {/* task-fit verdict: the headline answer when a request was supplied (did it do the job?) */}
      {result.taskFit ? <TaskVerdictBanner tf={result.taskFit} multi={multi} /> : null}

      {/* recommendation */}
      {multi && winner ? (
        <div className="card card--acc" style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>{winner.label}</div>
          <div>
            <div style={{ ...kicker, color: "var(--acc-deep)" }}>Recommendation</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)" }}>Ship Version {winner.label}</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>{result.recommendedOnTaskFit
              ? "Best instruction fit. Another version scores higher overall but does not follow the request as well."
              : `Highest overall score${result.margin != null && result.margin > 0 ? `, leads the runner-up by ${result.margin} point${result.margin === 1 ? "" : "s"}` : ""}${result.margin != null && result.margin > 0 && result.margin < 5 ? " (a close call)" : ""}`}</div>
            {result.recommendation ? <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>{result.recommendation}</div> : null}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ ...kicker, color: "var(--acc-deep)", marginBottom: 4 }}>{multi ? "Too close to call" : result.context === "published" ? "Highest-impact change" : "Review"}</div>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>{result.recommendation || (multi ? "The versions scored evenly. Use the flags below to break the tie." : "See the score and flags below.")}</div>
        </div>
      )}

      {/* candidates — the recommended pick first (it may not be the highest overall), then by score */}
      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        {[...result.candidates].sort((a, b) =>
          (winner ? Number(b.index === winner.index) - Number(a.index === winner.index) : 0) || b.overall - a.overall
        ).map((c) => (
          <CandidateCard key={c.index} c={c} flags={result.flags} isWinner={winner?.index === c.index} />
        ))}
      </div>

      {/* instruction fit — only present when an original request was supplied */}
      <InstructionFitSection result={result} winnerIndex={result.recommendedIndex} />

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

      {/* corrected version: the ship-pick with every applicable fix applied (assembly only) */}
      {aiReview && aiReview.count > 0 ? <AiTellsSection review={aiReview} /> : null}

      {corrected?.correctedVersion ? <CorrectedBlock text={corrected.correctedVersion} label={corrected.label} multi={multi} /> : null}

      {/* analysis sources + validated evidence viewer (multimodal checks only) */}
      {hasAttachments ? <AnalysisSources sources={attachments!} capabilities={caps} evidence={result.attachmentEvidence ?? []} /> : null}

      {/* calibration: validate on real people + the rolling agreement rate (owner only) */}
      {calibrationSlot}

      {/* honest method note */}
      <div style={{ ...box, background: "var(--bg-2)", padding: "clamp(16px, 2.4vw, 22px)" }}>
        <div style={{ ...kicker, marginBottom: 8 }}>How to read this</div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.7, margin: 0 }}>
          This is an <strong style={{ color: "var(--fg-2)" }}>AI assessment</strong>{result.model ? ` generated by ${result.model}` : ""}, not a human judgment and not a guarantee. Every flagged span is quoted verbatim from your output, and the recommended version is computed from the scores shown, not asserted by the model. Scores are approximate and vary a little between runs, so they are rounded and not used by the pass or fail decision; the flags are. It informs your decision; it does not replace shipping judgment or real user testing.
        </p>
      </div>

      {/* audit: safe check details (multimodal checks only) — no paths, URLs, base64, or identities */}
      {hasAttachments ? (
        <details data-testid="check-details" style={{ ...box, background: "var(--bg-2)", padding: "clamp(14px, 2.2vw, 20px)", marginTop: 18 }}>
          <summary style={{ ...kicker, cursor: "pointer", color: "var(--fg-3)" }}>Check details</summary>
          <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
            {([
              ["Status", "Complete"],
              ["Versions", `${result.candidates.length}`],
              ["Attachments", `${attachments!.length}`],
              ["Capabilities", capSummary(caps)],
              ...(result.model ? [["Model", result.model] as [string, string]] : []),
              ...(createdAt ? [["Completed", new Date(createdAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"] as [string, string]] : []),
              ...(result.snapshotHash ? [["Snapshot", result.snapshotHash] as [string, string]] : []),
              ...(result.attachmentWarnings && result.attachmentWarnings.length ? [["Warnings", result.attachmentWarnings.join("; ")] as [string, string]] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: "var(--fg-4)" }}>{k}</span>
                <span style={{ color: "var(--fg-2)", fontFamily: "var(--font-code)", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

import type { ReactNode } from "react";
import { OPTION_LETTERS, type VOption, type VReport } from "@/lib/v-db";
import { evaluationIntelligence, intelligenceDisclaimer } from "@/lib/v-intelligence";
import { decisionReadiness, followupForReadiness, REPORT_GLOSSARY } from "@/lib/v-readiness";

// Bounds-safe option letter (A..Z): never render "Option undefined" for position >= 26.
const optLetter = (pos: number) => OPTION_LETTERS[pos] ?? "?";

const READY_TONE: Record<string, { bg: string; fg: string }> = {
  good: { bg: "var(--acc-soft)", fg: "var(--acc-deep)" },
  warn: { bg: "var(--bg-1)", fg: "var(--money)" },
  bad: { bg: "var(--bg-1)", fg: "var(--err)" },
  neutral: { bg: "var(--bg-1)", fg: "var(--fg-3)" },
};

export function OptionThumb({ o, size = 56 }: { o?: VOption; size?: number }) {
  if (!o) return <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)" }} />;
  return o.asset_url ? (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
  ) : (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size > 70 ? 16 : 12, color: "var(--fg-2)", textAlign: "center", padding: 6, overflow: "hidden" }}>{o.label}</div>
  );
}

const head = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

function Metric({ l, v, accent }: { l: string; v: string; accent?: boolean }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-1)", border: "1px solid var(--line-1)", flex: "1 1 120px" }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: accent ? "var(--acc-deep)" : "var(--fg-1)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

const CONF_TONE: Record<string, { bg: string; fg: string }> = {
  Strong: { bg: "var(--acc-soft)", fg: "var(--acc-deep)" },
  Moderate: { bg: "var(--bg-1)", fg: "var(--acc-deep)" },
  Tentative: { bg: "var(--bg-1)", fg: "var(--fg-3)" },
  None: { bg: "var(--bg-1)", fg: "var(--fg-4)" },
};

// The shared report deliverable — Evaluation Intelligence (decision summary,
// margin, signal quality, action), preference breakdown, optional AI analysis
// slot, and reasoning signals. Pure render from results + options; used by both
// the owner report and the public /r/<token> report.
export function ReportBody({ results, options, analysisSlot, votesTarget = 0, complete = true, audienceFit, screeningEnabled, viewerCanAct = false, judgePool }: { results: VReport["results"]; options: VOption[]; analysisSlot?: ReactNode; votesTarget?: number; complete?: boolean; audienceFit?: string | null; screeningEnabled?: boolean; viewerCanAct?: boolean; judgePool?: { uniqueJudges: number; established: number; cleanRecord: number; cleanPct: number | null } }) {
  const optById: Record<string, VOption> = Object.fromEntries(options.map((o) => [o.id, o]));
  const total = results.total;
  const filtered = results.filtered ?? 0;
  const max = Math.max(1, ...results.ranked.map((x) => x.votes));
  const winner = results.winner_option_id ? optById[results.winner_option_id] : undefined;
  const winnerRow = results.winner_option_id ? results.ranked.find((x) => x.id === results.winner_option_id) : undefined;
  const intel = evaluationIntelligence(results, votesTarget);
  const conf = CONF_TONE[intel.confidenceLabel] ?? CONF_TONE.None;
  const readiness = decisionReadiness({ complete, intel, valid: total, target: votesTarget, audienceFit, screeningEnabled });
  const rt = READY_TONE[readiness.tone] ?? READY_TONE.neutral;
  const followPlan = followupForReadiness(readiness.label);
  const ranked = [...results.ranked].sort((a, b) => b.votes - a.votes);
  const commentsByOption: Record<string, string[]> = {};
  for (const c of results.comments) (commentsByOption[c.option_id] ||= []).push(c.reason);
  // Only claim a preference rank when there's real signal to back it. With no
  // judgments (or everything tied), "Most/Least preferred" is a fabricated claim —
  // show the honest state instead. A row with 0 votes is never "preferred".
  const allTied = ranked.length > 1 && ranked[0].votes === ranked[ranked.length - 1].votes;
  const rankNote = (i: number, votes: number) => {
    if (total === 0 || votes === 0) return "No judgments yet";
    if (allTied) return "Tied so far";
    return i === 0 ? "Most preferred" : i === ranked.length - 1 ? "Least preferred" : "Mid-pack";
  };

  return (
    <>
      {/* ── Decision summary ── */}
      <div className="card" style={{ marginBottom: 16, borderColor: "var(--acc-line)", background: intel.inconclusive ? "var(--bg-2)" : "var(--acc-soft)" }}>
        <div style={head}>Decision summary</div>
        {total === 0 ? (
          <p style={{ fontSize: 14.5, color: "var(--fg-2)", margin: 0 }}>{intel.decisionSummary}</p>
        ) : winner && winnerRow && !intel.inconclusive ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "clamp(14px, 3vw, 24px)", alignItems: "center" }}>
            <OptionThumb o={winner} size={96} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommendation</span>
                <span className="pill" style={{ background: conf.bg, color: conf.fg, borderColor: "var(--acc-line)" }}>{intel.confidenceLabel} confidence</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>{winner.label && !winner.asset_url ? winner.label.slice(0, 48) : `Option ${optLetter(winner.position)}`}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)" }}>{winnerRow.pct}% preferred · {intel.marginPts == null ? "n/a" : `+${intel.marginPts} pts`} margin</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6, marginBottom: 0 }}>{intel.decisionSummary}</p>
              {intel.winProbabilityPct != null && (
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8, marginBottom: 0, lineHeight: 1.55 }}>
                  <strong style={{ color: "var(--fg-1)" }}>{intel.winProbabilityPct}% chance</strong> this is genuinely the preferred version, based on the judgments collected{intel.winnerShareCI ? ` (95% range: ${intel.winnerShareCI[0]}% to ${intel.winnerShareCI[1]}% preference)` : ""}. A decision aid, not a guarantee.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--money)", marginBottom: 4 }}>No clear recommendation yet</div>
            <p style={{ fontSize: 14.5, color: "var(--fg-2)", margin: 0 }}>{intel.decisionSummary}</p>
          </div>
        )}

        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "14px 0 14px" }}>{intel.marginText}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Metric l="Preference margin" v={intel.marginPts == null ? "n/a" : `${intel.marginPts} pts`} accent={!intel.inconclusive} />
          <Metric l="Confidence" v={intel.confidenceLabel === "None" ? "n/a" : intel.winProbabilityPct != null ? `${intel.confidenceLabel} · ${intel.winProbabilityPct}%` : intel.confidenceLabel} />
          <Metric l="Valid judgments" v={intel.totalValid.toLocaleString()} />
          <Metric l="Signal quality" v={intel.signalLabel} />
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>{intelligenceDisclaimer()}</p>
      </div>

      {analysisSlot}

      {/* ── Decision readiness ── */}
      <div className="card" style={{ marginBottom: 22, borderColor: readiness.tone === "good" ? "var(--acc-line)" : "var(--line-2)" }}>
        <div style={head}>Decision readiness</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="pill" style={{ background: rt.bg, color: rt.fg, borderColor: "var(--acc-line)", fontSize: 12, fontWeight: 700 }}>{readiness.label}</span>
          {readiness.signals.targetProgress != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)" }}>{readiness.signals.validJudgments.toLocaleString()}{readiness.signals.target ? ` / ${readiness.signals.target.toLocaleString()}` : ""} judgments · {readiness.signals.targetProgress}% of target</span>}
        </div>
        <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.55 }}>{readiness.reason}</p>
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
          <span aria-hidden style={{ flex: "none", width: 22, height: 22, marginTop: 1, borderRadius: 7, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 13 }}>→</span>
          <p style={{ fontSize: 14, color: "var(--fg-1)", margin: 0, lineHeight: 1.55 }}><strong>Recommended next step:</strong> {readiness.nextStep}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Metric l="Valid judgments" v={readiness.signals.validJudgments.toLocaleString()} accent />
          {readiness.signals.target != null ? <Metric l="Target progress" v={`${readiness.signals.targetProgress}%`} /> : null}
          <Metric l="Preference margin" v={readiness.signals.marginPts == null ? "—" : `${readiness.signals.marginPts} pts`} />
          <Metric l="Signal quality" v={readiness.signals.signalQuality} />
          {readiness.signals.audienceFit ? <Metric l="Audience fit" v={readiness.signals.audienceFit} /> : null}
        </div>
        {followPlan && !viewerCanAct ? <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "12px 0 0", lineHeight: 1.55 }}>The evaluation owner can run a confirmation round ({followPlan.actionLabel.toLowerCase()}) if more signal is needed.</p> : null}
      </div>

      {/* ── Candidate evaluation ── */}
      <div style={head}>Candidate evaluation</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {ranked.map((row, i) => {
          const isWin = row.id === results.winner_option_id && !intel.inconclusive;
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "26px 44px minmax(0,1fr) 52px", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: isWin ? "var(--acc-soft)" : "transparent", border: isWin ? "1px solid var(--acc-line)" : "1px solid transparent" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: i === 0 ? "var(--acc-deep)" : "var(--fg-4)" }}>{i + 1}</span>
              <OptionThumb o={optById[row.id]} size={44} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(() => { const o = optById[row.id]; return o?.label && !o.asset_url ? `${optLetter(row.position)}: ${o.label.slice(0, 60)}` : `Option ${optLetter(row.position)}`; })()}{isWin ? " (recommended)" : ""}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", whiteSpace: "nowrap" }}>{rankNote(i, row.votes)}{row.votes > 0 ? `, ${row.votes} judgment${row.votes === 1 ? "" : "s"}` : ""}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((row.votes / max) * 100)}%`, background: isWin ? "linear-gradient(90deg, var(--acc), var(--acc-deep))" : "var(--line-3)" }} />
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: isWin ? "var(--acc-deep)" : "var(--fg-3)", textAlign: "right" }}>{row.pct}%</span>
            </div>
          );
        })}
      </div>

      {/* ── Signal convergence ── */}
      {(() => {
        const c = intel.convergence;
        const TONE: Record<string, { bg: string; fg: string; word: string }> = {
          converged: { bg: "var(--acc-soft)", fg: "var(--acc-deep)", word: "Converged" },
          leaning: { bg: "var(--bg-1)", fg: "var(--acc-deep)", word: "Leaning" },
          split: { bg: "var(--bg-1)", fg: "var(--money)", word: "Split" },
          insufficient: { bg: "var(--bg-1)", fg: "var(--fg-4)", word: "Not enough signal" },
        };
        const t = TONE[c.state] ?? TONE.insufficient;
        const showBar = c.winnerSharePct != null && c.chancePct != null;
        return (
          <>
            <div style={head}>Signal convergence</div>
            <div className="card" style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <span className="pill" style={{ background: t.bg, color: t.fg, borderColor: "var(--acc-line)", fontSize: 12, fontWeight: 700 }}>{t.word}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, flex: "1 1 260px" }}>{c.label}</span>
              </div>
              {showBar ? (
                <div style={{ marginTop: 4, marginBottom: 12 }}>
                  {/* leading share bar with a marked chance line and the confident lower bound */}
                  <div style={{ position: "relative", height: 30, borderRadius: 8, background: "var(--bg-2)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
                    {/* confident lower bound (conservative) fill */}
                    {c.lowerBoundPct != null ? (
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${c.lowerBoundPct}%`, background: c.state === "split" ? "var(--line-3)" : "linear-gradient(90deg, var(--acc), var(--acc-deep))", opacity: c.state === "split" ? 0.6 : 1 }} />
                    ) : null}
                    {/* observed share marker */}
                    <div title={`Observed leading share: ${c.winnerSharePct}%`} style={{ position: "absolute", left: `calc(${c.winnerSharePct}% - 1px)`, top: 0, bottom: 0, width: 2, background: "var(--fg-1)", opacity: 0.5 }} />
                    {/* chance line (1/options) */}
                    <div title={`Even-split baseline: ${c.chancePct}%`} style={{ position: "absolute", left: `calc(${c.chancePct}% - 1px)`, top: -2, bottom: -2, width: 2, background: "var(--money)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-5)" }}>
                    <span>0%</span><span style={{ color: "var(--money)" }}>even split {c.chancePct}%</span><span>100%</span>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Metric l="Leading share" v={c.winnerSharePct == null ? "—" : `${c.winnerSharePct}%`} accent={c.state === "converged"} />
                <Metric l="Confident floor" v={c.lowerBoundPct == null ? "—" : `${c.lowerBoundPct}%`} />
                <Metric l="Even-split line" v={c.chancePct == null ? "—" : `${c.chancePct}%`} />
                <Metric l="Clears chance by" v={c.clearsChanceByPts == null ? "—" : `${c.clearsChanceByPts > 0 ? "+" : ""}${c.clearsChanceByPts} pts`} />
              </div>
              <p style={{ fontSize: 11.5, color: "var(--fg-5)", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>Convergence checks whether the leading share is distinguishable from an even split, using a conservative (95%) estimate that accounts for sample size — so a small or noisy result can&apos;t read as decisive. It measures signal strength, not whether any individual response is &quot;right&quot;.</p>
            </div>
          </>
        );
      })()}

      {/* ── Signal quality ── */}
      <div style={head}>Signal quality</div>
      <div className="card" style={{ marginBottom: 26, background: "var(--bg-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="pill" style={{ background: intel.signalLabel === "Clean signal" ? "var(--acc-soft)" : "var(--bg-1)", color: intel.signalLabel === "Clean signal" ? "var(--acc-deep)" : "var(--fg-3)", borderColor: "var(--acc-line)" }}>{intel.signalLabel}</span>
          <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{intel.signalText}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Metric l="Valid judgments" v={total.toLocaleString()} accent />
          <Metric l="Filtered" v={filtered.toLocaleString()} />
          <Metric l="Filtered rate" v={`${intel.filteredRate}%`} />
          {votesTarget ? <Metric l="Target" v={votesTarget.toLocaleString()} /> : null}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginTop: 12, marginBottom: 0 }}>Low-quality, too-fast, or duplicate responses are filtered automatically. <strong style={{ color: "var(--fg-1)" }}>Only valid human judgments count</strong>. Raw participant, IP, and device data is never shown.</p>
      </div>

      {/* ── Judge pool (provenance) ── */}
      {judgePool && judgePool.uniqueJudges > 0 ? (
        <>
          <div style={head}>Judge pool</div>
          <div className="card" style={{ marginBottom: 26 }}>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 14px", lineHeight: 1.5 }}>This decision came from <strong style={{ color: "var(--fg-1)" }}>{judgePool.uniqueJudges.toLocaleString()} unique judge{judgePool.uniqueJudges === 1 ? "" : "s"}</strong> — real people, each judging once. Quality filtering and reputation gating run on every response.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Metric l="Unique judges" v={judgePool.uniqueJudges.toLocaleString()} accent />
              <Metric l="Established judges" v={judgePool.established.toLocaleString()} />
              <Metric l="Clean track record" v={judgePool.cleanPct == null ? "—" : `${judgePool.cleanPct}%`} />
            </div>
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
              {judgePool.cleanPct == null
                ? "“Established” judges have a track record of 12+ prior judgments; this run had too few to report a clean-record rate yet. Reputation gating still removes judges whose responses are mostly rejected."
                : <>Of judges with a track record (12+ prior judgments), <strong style={{ color: "var(--fg-3)" }}>{judgePool.cleanPct}%</strong> have a clean record — their responses are rarely filtered. We report who judged and how filtered the signal is; we don&apos;t claim inter-judge agreement or reliability scores, which we don&apos;t measure.</>}
            </p>
          </div>
        </>
      ) : null}

      {/* ── Reasoning signals ── */}
      <div style={head}>Reasoning signals</div>
      {results.comments.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-4)", marginBottom: 26 }}>Reasoning signals appear here when evaluators leave enough useful comments.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 26 }}>
          {ranked.filter((row) => commentsByOption[row.id]?.length).map((row) => (
            <div key={row.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <OptionThumb o={optById[row.id]} size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-1)" }}>Option {optLetter(row.position)}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{commentsByOption[row.id].length} note{commentsByOption[row.id].length === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {commentsByOption[row.id].slice(0, 6).map((c, j) => (
                  <p key={j} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, paddingLeft: 12, borderLeft: "2px solid var(--acc-line)", margin: 0 }}>{c}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Next steps ── */}
      <div style={head}>Next steps</div>
      <div className="card" style={{ marginBottom: 8, background: "var(--bg-2)" }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {[
            ["Choose what to ship", "based on this recommendation."],
            ["Judge how strong the call is", "from the preference margin and directional confidence."],
            ["Improve the weaker options", "using the reasoning signals."],
            ["Share or export it", "as a decision report for clients, teams, or apps — or pull it by API."],
          ].map(([t, d]) => (
            <li key={t} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>
              <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 11 }}>→</span>
              <span><strong style={{ color: "var(--fg-1)" }}>{t}</strong> {d}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── How to read this decision record ── */}
      <div style={{ ...head, marginTop: 26 }}>How to read this decision record</div>
      <div className="card" style={{ marginBottom: 8, background: "var(--bg-2)" }}>
        <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px", lineHeight: 1.55 }}>This is a decision record — a structured business artifact capturing the recommendation, confidence, signal quality, and decision readiness derived from qualified human judgment, not a poll result.</p>
        <div style={{ display: "grid", gap: 11 }}>
          {REPORT_GLOSSARY.map((g) => (
            <div key={g.term} style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ minWidth: 130, fontSize: 13, fontWeight: 700, color: "var(--fg-1)" }}>{g.term}</span>
              <span style={{ flex: "1 1 240px", fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>{g.meaning}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>{intelligenceDisclaimer()}</p>
      </div>
    </>
  );
}

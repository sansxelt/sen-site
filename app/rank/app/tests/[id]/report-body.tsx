import type { ReactNode } from "react";
import { OPTION_LETTERS, type VOption, type VReport } from "@/lib/v-db";
import { evaluationIntelligence, intelligenceDisclaimer } from "@/lib/v-intelligence";

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
export function ReportBody({ results, options, analysisSlot, votesTarget = 0 }: { results: VReport["results"]; options: VOption[]; analysisSlot?: ReactNode; votesTarget?: number }) {
  const optById: Record<string, VOption> = Object.fromEntries(options.map((o) => [o.id, o]));
  const total = results.total;
  const filtered = results.filtered ?? 0;
  const max = Math.max(1, ...results.ranked.map((x) => x.votes));
  const winner = results.winner_option_id ? optById[results.winner_option_id] : undefined;
  const winnerRow = results.winner_option_id ? results.ranked.find((x) => x.id === results.winner_option_id) : undefined;
  const intel = evaluationIntelligence(results, votesTarget);
  const conf = CONF_TONE[intel.confidenceLabel] ?? CONF_TONE.None;
  const ranked = [...results.ranked].sort((a, b) => b.votes - a.votes);
  const commentsByOption: Record<string, string[]> = {};
  for (const c of results.comments) (commentsByOption[c.option_id] ||= []).push(c.reason);
  const rankNote = (i: number) => (i === 0 ? "Most preferred" : i === ranked.length - 1 ? "Least preferred" : "Mid-pack");

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
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommended output</span>
                <span className="pill" style={{ background: conf.bg, color: conf.fg, borderColor: "var(--acc-line)" }}>{intel.confidenceLabel} confidence</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>Option {OPTION_LETTERS[winner.position]}</span>
                <span className="bignum" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)" }}>{winnerRow.pct}%</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6, marginBottom: 0 }}>{intel.decisionSummary}</p>
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
          <Metric l="Preference margin" v={intel.marginPts == null ? "—" : `${intel.marginPts} pts`} accent={!intel.inconclusive} />
          <Metric l="Directional confidence" v={intel.confidenceLabel === "None" ? "—" : intel.confidenceLabel} />
          <Metric l="Valid judgments" v={intel.totalValid.toLocaleString()} />
          <Metric l="Signal quality" v={intel.signalLabel} />
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>{intelligenceDisclaimer()}</p>
      </div>

      {analysisSlot}

      {/* ── What to do next ── */}
      <div className="card" style={{ marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: 9, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 16 }}>→</span>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginBottom: 2 }}>What to do next</div>
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: 0, lineHeight: 1.55 }}>{intel.action}</p>
        </div>
      </div>

      {/* ── Preference breakdown ── */}
      <div style={head}>Preference breakdown</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {ranked.map((row, i) => {
          const isWin = row.id === results.winner_option_id && !intel.inconclusive;
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "26px 44px minmax(0,1fr) 52px", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: isWin ? "var(--acc-soft)" : "transparent", border: isWin ? "1px solid var(--acc-line)" : "1px solid transparent" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: i === 0 ? "var(--acc-deep)" : "var(--fg-4)" }}>{i + 1}</span>
              <OptionThumb o={optById[row.id]} size={44} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>Option {OPTION_LETTERS[row.position]}{isWin ? " (recommended)" : ""}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", whiteSpace: "nowrap" }}>{rankNote(i)}, {row.votes} judgment{row.votes === 1 ? "" : "s"}</span>
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
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, marginTop: 12, marginBottom: 0 }}>Low-quality, too-fast, or duplicate responses are filtered automatically. <strong style={{ color: "var(--fg-1)" }}>Only valid human judgments count</strong>. Raw voter, IP, and device data is never shown.</p>
      </div>

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
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-1)" }}>Option {OPTION_LETTERS[row.position]}</span>
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

      {/* ── Use this result ── */}
      <div style={head}>Use this result</div>
      <div className="card" style={{ marginBottom: 8, background: "var(--bg-2)" }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {[
            ["Choose what to ship", "from the recommended output."],
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
    </>
  );
}

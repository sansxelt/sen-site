import type { ReactNode } from "react";
import { OPTION_LETTERS, type VOption, type VReport } from "@/lib/v-db";

export function OptionThumb({ o, size = 56 }: { o?: VOption; size?: number }) {
  if (!o) return <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)" }} />;
  return o.asset_url ? (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
  ) : (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size > 70 ? 16 : 12, color: "var(--fg-2)", textAlign: "center", padding: 6, overflow: "hidden" }}>{o.label}</div>
  );
}

// The shared report deliverable — verdict, optional analysis slot, vote
// breakdown, vote-quality panel, comments. Pure render from results + options;
// used by both the owner report and the public /r/<token> report.
export function ReportBody({ results, options, analysisSlot }: { results: VReport["results"]; options: VOption[]; analysisSlot?: ReactNode }) {
  const optById: Record<string, VOption> = Object.fromEntries(options.map((o) => [o.id, o]));
  const total = results.total;
  const filtered = results.filtered ?? 0;
  const max = Math.max(1, ...results.ranked.map((x) => x.votes));
  const winner = results.winner_option_id ? optById[results.winner_option_id] : undefined;
  const winnerRow = results.winner_option_id ? results.ranked.find((x) => x.id === results.winner_option_id) : undefined;
  const runnerUp = results.ranked[1];
  const margin = winnerRow && runnerUp ? winnerRow.pct - runnerUp.pct : 0;
  const marginLabel = margin >= 25 ? "Clear win" : margin >= 10 ? "Solid win" : "Narrow win";
  const commentsByOption: Record<string, string[]> = {};
  for (const c of results.comments) (commentsByOption[c.option_id] ||= []).push(c.reason);

  return (
    <>
      {total === 0 ? (
        <div className="card" style={{ marginBottom: 22, textAlign: "center", padding: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Not enough valid judgments yet</div>
          <p style={{ fontSize: 14.5, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto" }}>This evaluation closed before collecting valid judgments.</p>
        </div>
      ) : winner && winnerRow ? (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "clamp(16px, 3vw, 28px)", alignItems: "center" }}>
          <OptionThumb o={winner} size={112} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommended output</span>
              <span className="pill" style={{ background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{marginLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>Option {OPTION_LETTERS[winner.position]}</span>
              <span className="bignum" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>{winnerRow.pct}%</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6 }}>{results.recommendation}</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--money)", marginBottom: 4 }}>Too close to call</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>No clear recommendation</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 4 }}>{results.recommendation}</p>
        </div>
      )}

      {analysisSlot}

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Preference breakdown</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {results.ranked.map((row, i) => {
          const isWin = row.id === results.winner_option_id;
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "26px 44px minmax(0,1fr) 52px", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: isWin ? "var(--acc-soft)" : "transparent", border: isWin ? "1px solid var(--acc-line)" : "1px solid transparent" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: i === 0 ? "var(--acc-deep)" : "var(--fg-4)" }}>{i + 1}</span>
              <OptionThumb o={optById[row.id]} size={44} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>Option {OPTION_LETTERS[row.position]}{isWin ? " (recommended)" : ""}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>{row.votes} vote{row.votes === 1 ? "" : "s"}</span>
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

      <div className="card" style={{ marginBottom: 26, background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--acc-deep)" }}>{total}</div><div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>valid judgments</div></div>
          <div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-3)" }}>{filtered}</div><div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>filtered</div></div>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, flex: 1, minWidth: 240, margin: 0 }}>Votes that were too fast, duplicated, or low-quality are filtered automatically. <strong style={{ color: "var(--fg-1)" }}>Only valid human judgments count</strong> toward this result.</p>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Reasoning signals</div>
      {results.comments.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-4)", marginBottom: 26 }}>No written comments yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 26 }}>
          {results.ranked.filter((row) => commentsByOption[row.id]?.length).map((row) => (
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
    </>
  );
}

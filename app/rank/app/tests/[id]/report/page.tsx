import type { Metadata } from "next";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, ensureReportAnalysis, OPTION_LETTERS, type VOption } from "@/lib/v-db";
import { CloseButton } from "../close-button";
import { EmbedSnippet } from "../embed-snippet";

export const metadata: Metadata = { title: "Results — Vraelis" };
export const maxDuration = 60; // first view of a completed test generates the AI analysis

function Msg({ title, body }: { title: string; body?: string }) {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", marginBottom: 12 }}>{title}</h1>
        {body && <p className="lead-copy" style={{ margin: "0 auto 24px" }}>{body}</p>}
        <a href="/app" className="btn btn--ghost">Back to dashboard</a>
      </div>
    </section>
  );
}

function OptionThumb({ o, size = 56 }: { o?: VOption; size?: number }) {
  if (!o) return null;
  return o.asset_url ? (
    <div style={{ width: size, height: size, flex: "none", borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
  ) : (
    <div style={{ width: size, height: size, flex: "none", borderRadius: "var(--r-xs)", border: "1px solid var(--line-2)", background: "var(--bg-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--fg-2)", textAlign: "center", padding: 4, overflow: "hidden" }}>{o.label}</div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;

  const data = await getTestWithOptions(id);
  if (!data) return <Msg title="Test not found" />;
  if (!email || data.test.user_id !== email.trim().toLowerCase()) return <Msg title="Not your test" body="Reports are private to the person who created the test." />;

  const { test, options } = data;
  const optById: Record<string, VOption> = Object.fromEntries(options.map((o) => [o.id, o]));
  let report = await getReport(id);
  if (report && test.status === "complete") report = (await ensureReportAnalysis(id)) ?? report;

  // In progress (no report yet)
  if (!report || test.status !== "complete") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <p className="eyebrow">Collecting votes</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 18 }}>{test.votes_valid} / {test.votes_target} votes in</p>
        <div style={{ height: 8, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {options.map((o) => <OptionThumb key={o.id} o={o} size={84} />)}
        </div>
        {test.status === "active" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <CloseButton testId={test.id} />
            <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Unfilled credits are refunded.</span>
          </div>
        )}
        {test.status === "active" && <EmbedSnippet testId={test.id} />}
      </div>
    );
  }

  // Complete — full report
  const r = report.results;
  const max = Math.max(1, ...r.ranked.map((x) => x.votes));
  const winner = r.winner_option_id ? optById[r.winner_option_id] : undefined;
  const commentsByOption: Record<string, string[]> = {};
  for (const c of r.comments) (commentsByOption[c.option_id] ||= []).push(c.reason);

  return (
    <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">Results</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 18 }}>{test.title}</h1>

      {/* winner — or an honest inconclusive state when there's no clear/decisive result */}
      {winner ? (
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)" }}>
          <OptionThumb o={winner} size={72} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 4 }}>Winner</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>
              Option {OPTION_LETTERS[winner.position]} — {r.ranked.find((x) => x.id === winner.id)?.pct ?? 0}%
            </div>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 4 }}>{r.recommendation}</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 }}>Result</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--fg-1)" }}>No clear winner {r.total === 0 ? "yet" : "— it's close"}</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 4 }}>{r.recommendation}</p>
        </div>
      )}

      {/* AI analysis */}
      {r.analysis && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Vraelis analysis</span>
            <span className="pill" style={{ color: "var(--fg-4)" }}>confidence: {r.analysis.confidence}</span>
          </div>
          <p style={{ fontSize: 15, color: "var(--fg-1)", lineHeight: 1.55, marginBottom: 16, fontWeight: 500 }}>{r.analysis.summary}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="cols-2">
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 8 }}>Why it won</div>
              <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>{r.analysis.why_winner}</p>
            </div>
            {r.analysis.weaknesses.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--money)", marginBottom: 8 }}>What held the others back</div>
                <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
                  {r.analysis.weaknesses.map((w, i) => <li key={i} style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
          {r.analysis.suggestions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-1)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Make the winner stronger</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
                {r.analysis.suggestions.map((sug, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{sug}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* breakdown */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Breakdown · {r.total} votes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {r.ranked.map((row, i) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
            <OptionThumb o={optById[row.id]} size={44} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>Option {OPTION_LETTERS[row.position]}{i === 0 ? " · winner" : ""}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>{row.votes} vote{row.votes === 1 ? "" : "s"}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((row.votes / max) * 100)}%`, background: i === 0 ? "linear-gradient(90deg, var(--acc), var(--acc-deep))" : "var(--line-3)" }} />
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: i === 0 ? "var(--acc-deep)" : "var(--fg-3)", minWidth: 44, textAlign: "right" }}>{row.pct}%</span>
          </div>
        ))}
      </div>

      {/* comments */}
      {r.comments.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>What voters said</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {r.ranked.filter((row) => commentsByOption[row.id]?.length).map((row) => (
              <div key={row.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>Option {OPTION_LETTERS[row.position]}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {commentsByOption[row.id].slice(0, 8).map((c, j) => (
                    <p key={j} style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5, paddingLeft: 12, borderLeft: "2px solid var(--acc-line)" }}>{c}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/app/new" className="btn">Run another test <span aria-hidden>→</span></a>
        <a href="/app" className="btn btn--ghost">Dashboard</a>
      </div>
    </div>
  );
}

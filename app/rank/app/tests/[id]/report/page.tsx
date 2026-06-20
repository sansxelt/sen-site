import type { Metadata } from "next";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS, type VOption } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { CloseButton } from "../close-button";
import { EmbedSnippet } from "../embed-snippet";
import { AnalysisPanel } from "../analysis-panel";
import { ReportActions } from "../report-actions";

export const metadata: Metadata = { title: "Report — Vraelis" };

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
  if (!o) return <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)" }} />;
  return o.asset_url ? (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
  ) : (
    <div style={{ width: size, height: size, flex: "none", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size > 70 ? 16 : 12, color: "var(--fg-2)", textAlign: "center", padding: 6, overflow: "hidden" }}>{o.label}</div>
  );
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ launched?: string }> }) {
  const { id } = await params;
  const justLaunched = ((await searchParams) || {}).launched === "1";
  const session = await auth();
  const email = session?.user?.email;

  const data = await getTestWithOptions(id);
  if (!data) return <Msg title="Test not found" />;
  if (!email || data.test.user_id !== email.trim().toLowerCase()) return <Msg title="Not your test" body="Reports are private to the person who created the test." />;

  const { test, options } = data;
  const optById: Record<string, VOption> = Object.fromEntries(options.map((o) => [o.id, o]));
  const report = await getReport(id);

  // ── In progress (collecting votes) ──
  if (!report || test.status !== "complete") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        {justLaunched && test.status === "active" && (
          <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc)", background: "var(--acc-soft)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--acc-deep)", marginBottom: 4 }}>🎉 Your test is live!</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0 }}>Real people are voting now. Share or embed it below to collect votes faster — we&apos;ll generate your report once enough valid votes come in.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <a href="/app/new" className="btn btn--ghost" style={{ fontSize: 13 }}>Create another</a>
              <a href="/app" className="btn btn--ghost" style={{ fontSize: 13 }}>Dashboard</a>
            </div>
          </div>
        )}
        <p className="eyebrow">Collecting votes</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.votes_valid} / {test.votes_target} valid votes</p>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", marginBottom: 24 }}>
          <div className="pulse" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, marginBottom: 24, maxWidth: 460 }}>
          {options.map((o, i) => (
            <div key={o.id} style={{ position: "relative" }}>
              <OptionThumb o={o} size={84} />
              <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i]}</span>
            </div>
          ))}
        </div>
        {test.status === "active" && (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <CloseButton testId={test.id} />
              <span style={{ fontSize: 13, color: "var(--fg-4)" }}>Unfilled credits are refunded when it closes.</span>
            </div>
            <EmbedSnippet testId={test.id} />
          </>
        )}
      </div>
    );
  }

  // ── Complete report ──
  const r = report.results;
  const total = r.total;
  const filtered = r.filtered ?? 0;
  const max = Math.max(1, ...r.ranked.map((x) => x.votes));
  const winner = r.winner_option_id ? optById[r.winner_option_id] : undefined;
  const winnerRow = r.winner_option_id ? r.ranked.find((x) => x.id === r.winner_option_id) : undefined;
  const runnerUp = r.ranked[1];
  const margin = winnerRow && runnerUp ? winnerRow.pct - runnerUp.pct : 0;
  const marginLabel = margin >= 25 ? "Clear win" : margin >= 10 ? "Solid win" : "Narrow win";

  const commentsByOption: Record<string, string[]> = {};
  for (const c of r.comments) (commentsByOption[c.option_id] ||= []).push(c.reason);

  const bal = await balance(email);
  const reportUrl = `https://vraelis.com/app/tests/${id}/report`;

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 90 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Report · complete</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>{test.title}</h1>
        </div>
        <ReportActions url={reportUrl} />
      </div>

      {/* ── Verdict ── */}
      {total === 0 ? (
        <div className="card" style={{ marginBottom: 22, textAlign: "center", padding: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Not enough valid feedback yet</div>
          <p style={{ fontSize: 14.5, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto" }}>This test closed before collecting valid votes. Run it again, or share it wider to gather real responses.</p>
        </div>
      ) : winner && winnerRow ? (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "clamp(16px, 3vw, 28px)", alignItems: "center" }}>
          <OptionThumb o={winner} size={112} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Recommended winner</span>
              <span className="pill" style={{ background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{marginLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>Option {OPTION_LETTERS[winner.position]}</span>
              <span className="bignum" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>{winnerRow.pct}%</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6 }}>{r.recommendation}</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--money)", marginBottom: 4 }}>Too close to call</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>No decisive winner</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 4 }}>{r.recommendation}</p>
        </div>
      )}

      {/* ── AI analysis (the value) ── */}
      <AnalysisPanel testId={id} initial={r.analysis ?? null} />

      {/* ── Vote breakdown ── */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Vote breakdown</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {r.ranked.map((row, i) => {
          const isWin = row.id === r.winner_option_id;
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "26px 44px minmax(0,1fr) 52px", gap: 12, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: isWin ? "var(--acc-soft)" : "transparent", border: isWin ? "1px solid var(--acc-line)" : "1px solid transparent" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: i === 0 ? "var(--acc-deep)" : "var(--fg-4)" }}>{i + 1}</span>
              <OptionThumb o={optById[row.id]} size={44} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>Option {OPTION_LETTERS[row.position]}{isWin ? " · winner" : ""}</span>
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

      {/* ── Quality / trust ── */}
      <div className="card" style={{ marginBottom: 26, background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--acc-deep)" }}>{total}</div><div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>valid votes</div></div>
          <div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-3)" }}>{filtered}</div><div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>filtered</div></div>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5, flex: 1, minWidth: 240, margin: 0 }}>Votes that were too fast, duplicated, or low-quality are filtered automatically. <strong style={{ color: "var(--fg-1)" }}>Only valid human judgments count</strong> toward this result.</p>
      </div>

      {/* ── Comments ── */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>What voters said</div>
      {r.comments.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-4)", marginBottom: 26 }}>No written comments on this test — voters chose without leaving a note.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 26 }}>
          {r.ranked.filter((row) => commentsByOption[row.id]?.length).map((row) => (
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

      {/* ── Next actions ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <a href="/app/new" className="btn">Run another test <span aria-hidden>→</span></a>
        <a href="/app" className="btn btn--ghost">Dashboard</a>
        {bal < 50 && <a href="/app/credits" className="btn btn--ghost">Buy credits</a>}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", lineHeight: 1.7 }}>
        Credits were held in escrow while the test ran. Invalid votes were filtered, unused credits refunded, and this report is based only on valid human judgments.
      </p>
    </div>
  );
}

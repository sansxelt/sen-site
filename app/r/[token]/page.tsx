import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSharedReport, OPTION_LETTERS } from "@/lib/v-db";
import { judgePoolStats } from "@/lib/v-analytics";
import { ogMeta } from "@/lib/og-meta";
import { ReportBody, OptionThumb } from "@/app/rank/app/tests/[id]/report-body";
import { AnalysisPanel } from "@/app/rank/app/tests/[id]/analysis-panel";
import { ThemesPanel } from "@/app/rank/app/tests/[id]/themes-panel";

// Report-specific preview (title + verdict), static OG image, noindex (tokened).
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getSharedReport(token);
  // Unknown/disabled → generic card + generic copy (no report-specific preview).
  if (!data || (data.test.status !== "active" && data.test.status !== "complete")) {
    return ogMeta({ title: "Decision record", description: "A structured Decision Package from quality-filtered human judgment — the recommended option, confidence, and signal quality.", path: `/r/${token}`, index: false });
  }
  const { test, report } = data;
  let description = "A structured Decision Package from quality-filtered human judgment — the recommended option, confidence, and signal quality.";
  if (report && test.status === "complete") {
    const r = report.results;
    const win = r.winner_option_id ? r.ranked.find((x) => x.id === r.winner_option_id) : null;
    description = win
      ? `Recommended: Option ${OPTION_LETTERS[win.position]} (${win.pct}% preferred). See the full Decision Package.`
      : "A structured decision from quality-filtered human judgment. See the full Vraelis Decision Package.";
  } else if (test.status === "active") {
    description = `Collecting judgments. ${test.votes_valid} of ${test.votes_target} in.`;
  }
  // Per-report dynamic OG image (public-safe fields only); generic /og fallback.
  const image = `https://vraelis.com/og/r?token=${encodeURIComponent(token)}`;
  return ogMeta({ title: `Vraelis Report: ${test.title}`, description, path: `/r/${token}`, index: false, image });
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rank-root">
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "rgba(250,248,244,0.9)" }}>
        <a href="https://vraelis.com" style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.035em" }}>Vraelis</a>
        <a href="https://vraelis.com/app/new" className="btn">Run your own evaluation</a>
      </nav>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 60 }}>{children}</div>
      <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)", position: "relative", overflow: "hidden" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ position: "relative", padding: "clamp(40px, 6vw, 76px) var(--gutter)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Created with Vraelis</p>
          <div className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)", marginBottom: 10 }}>Evaluate your creative with <span className="em">real people</span>.</div>
          <p style={{ fontSize: 15, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto 22px" }}>Submit your options and get a decision report before launch.</p>
          <a href="https://vraelis.com/app/new" className="btn btn--lg">Run your own evaluation →</a>
        </div>
      </footer>
    </div>
  );
}

function Unavailable() {
  return (
    <Frame>
      <div className="empty" style={{ margin: "clamp(20px, 5vw, 48px) 0" }}>
        <div className="empty__icon">∅</div>
        <h3 style={{ fontSize: "1.4rem" }}>This report isn&apos;t available</h3>
        <p>The link may have been disabled by its owner, or it doesn&apos;t exist.</p>
        <a href="https://vraelis.com" className="btn">Create your own evaluation →</a>
      </div>
    </Frame>
  );
}

export default async function PublicReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedReport(token);
  if (!data) return <Unavailable />;

  const { test, options, report } = data;

  // Only active (collecting) and complete (with a report) are viewable publicly.
  if (test.status !== "active" && test.status !== "complete") return <Unavailable />;
  if (test.status === "complete" && !report) {
    return (
      <Frame>
        <div className="empty" style={{ margin: "clamp(20px, 5vw, 48px) 0" }}>
          <div className="empty__icon">◷</div>
          <h3 style={{ fontSize: "1.3rem" }}>This test has closed</h3>
          <p>It closed before a report could be generated.</p>
        </div>
      </Frame>
    );
  }

  // In progress (actively collecting votes)
  if (test.status === "active") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    return (
      <Frame>
        <p className="eyebrow">Collecting judgments</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.votes_valid} / {test.votes_target} valid judgments so far</p>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", marginBottom: 24 }}>
          <div className="pulse" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
        </div>
        {options.every((o) => !o.asset_url) ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
            {options.map((o, i) => (
              <div key={o.id} className="card" style={{ background: "var(--bg-2)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 7 }}>Response {OPTION_LETTERS[i] ?? "?"}</div>
                <p style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{o.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, marginBottom: 20, maxWidth: 460 }}>
            {options.map((o, i) => (
              <div key={o.id} style={{ position: "relative" }}>
                <OptionThumb o={o} size={84} />
                <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i] ?? "?"}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>This test is still gathering real responses. Check back soon for the full report.</p>
      </Frame>
    );
  }

  // Complete with report
  if (!report) return <Unavailable />; // unreachable (handled above) — satisfies the type checker
  const judgePool = await judgePoolStats(test.id);
  return (
    <Frame>
      <p className="eyebrow">Decision record</p>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.5rem)", marginBottom: 8 }}>{test.title}</h1>
      <p style={{ fontSize: 14, color: "var(--fg-4)", marginBottom: 22 }}>A read-only Decision Package from quality-filtered human judgment, powered by Vraelis.</p>
      <ReportBody
        results={report.results}
        options={options}
        votesTarget={test.votes_target}
        judgePool={judgePool}
        analysisSlot={report.results.analysis ? <AnalysisPanel testId="" initial={report.results.analysis} readOnly /> : null}
        themesSlot={report.results.themes ? <ThemesPanel testId="" initial={report.results.themes} readOnly /> : null}
      />
    </Frame>
  );
}

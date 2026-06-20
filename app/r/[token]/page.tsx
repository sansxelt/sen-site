import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSharedReport, OPTION_LETTERS } from "@/lib/v-db";
import { ReportBody, OptionThumb } from "@/app/rank/app/tests/[id]/report-body";
import { AnalysisPanel } from "@/app/rank/app/tests/[id]/analysis-panel";

// Tokened links shouldn't be search-indexed; the owner shares them directly.
export const metadata: Metadata = { title: "Report — Vraelis", robots: { index: false, follow: false } };

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rank-root">
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "rgba(250,248,244,0.9)" }}>
        <a href="https://vraelis.com" style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--acc)", boxShadow: "0 0 10px var(--acc-glow)" }} />Vraelis
        </a>
        <a href="https://vraelis.com/app/new" className="btn">Run your own test</a>
      </nav>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 60 }}>{children}</div>
      <footer style={{ borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
        <div className="wrap" style={{ padding: "clamp(28px, 4vw, 44px) var(--gutter)", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Made with Vraelis</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 420, margin: "0 auto 16px" }}>Test your own creative with real people and get a clear report on what wins.</p>
          <a href="https://vraelis.com" className="btn btn--lg">Run your own test →</a>
        </div>
      </footer>
    </div>
  );
}

function Unavailable() {
  return (
    <Frame>
      <div style={{ textAlign: "center", padding: "clamp(40px, 7vw, 80px) 0" }}>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)", marginBottom: 12 }}>This report isn&apos;t available</h1>
        <p className="lead-copy" style={{ margin: "0 auto 24px" }}>The link may have been disabled by its owner, or it doesn&apos;t exist.</p>
        <a href="https://vraelis.com" className="btn btn--lg">Create your own test →</a>
      </div>
    </Frame>
  );
}

export default async function PublicReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedReport(token);
  if (!data) return <Unavailable />;

  const { test, options, report } = data;

  // In progress
  if (!report || test.status !== "complete") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    return (
      <Frame>
        <p className="eyebrow">Collecting votes</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.votes_valid} / {test.votes_target} valid votes so far</p>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", marginBottom: 24 }}>
          <div className="pulse" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, marginBottom: 20, maxWidth: 460 }}>
          {options.map((o, i) => (
            <div key={o.id} style={{ position: "relative" }}>
              <OptionThumb o={o} size={84} />
              <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i]}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>This test is still gathering real responses. Check back soon for the full report.</p>
      </Frame>
    );
  }

  // Complete
  return (
    <Frame>
      <p className="eyebrow">Report · complete</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 18 }}>{test.title}</h1>
      <ReportBody
        results={report.results}
        options={options}
        analysisSlot={report.results.analysis ? <AnalysisPanel testId="" initial={report.results.analysis} readOnly /> : null}
      />
    </Frame>
  );
}

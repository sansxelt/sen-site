import type { Metadata } from "next";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "@/lib/v-db";
import { getProject } from "@/lib/v-projects";
import { testFilterReasons } from "@/lib/v-analytics";
import { SectionHead, Bars } from "../../../_workspace/analytics-ui";
import { balance } from "@/lib/v-credits";
import { CloseButton } from "../close-button";
import { EmbedSnippet } from "../embed-snippet";
import { AnalysisPanel } from "../analysis-panel";
import { ShareControls } from "../share-controls";
import { ExportControls } from "../export-controls";
import { ReportBody, OptionThumb } from "../report-body";

export const metadata: Metadata = { title: "Report" };

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

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ launched?: string }> }) {
  const { id } = await params;
  const justLaunched = ((await searchParams) || {}).launched === "1";
  const session = await auth();
  const email = session?.user?.email;

  const data = await getTestWithOptions(id);
  if (!data) return <Msg title="Test not found" />;
  if (!email || data.test.user_id !== email.trim().toLowerCase()) return <Msg title="Not your test" body="Reports are private to the person who created the test." />;

  const { test, options } = data;
  const report = await getReport(id);
  // Owner-only context — never shown on the public /r/<token> report.
  const project = test.project_id ? await getProject(email, test.project_id) : null;
  const projectLine = project ? (
    <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: -4, marginBottom: 14 }}>Project: <a href={`/app/projects/${project.id}`} style={{ color: "var(--acc-deep)", textDecoration: "none" }}>{project.name}</a></p>
  ) : null;

  // ── In progress (collecting votes) ──
  if (!report || test.status !== "complete") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        {justLaunched && test.status === "active" && (
          <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--acc-deep)", marginBottom: 4 }}>Your evaluation is live</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0 }}>Real people are evaluating now. Share or embed it below to collect judgments faster. We&apos;ll generate your report once enough valid judgments come in.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <a href="/app/new" className="btn btn--ghost" style={{ fontSize: 13 }}>Create another</a>
              <a href="/app" className="btn btn--ghost" style={{ fontSize: 13 }}>Dashboard</a>
            </div>
          </div>
        )}
        <p className="eyebrow">Collecting judgments</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
        {projectLine}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.votes_valid} / {test.votes_target} valid judgments</p>
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
            <ShareControls testId={test.id} enabled={!!test.share_enabled} token={test.share_token ?? null} />
          </>
        )}
      </div>
    );
  }

  // ── Complete report ──
  const r = report.results;
  const bal = await balance(email);
  // Owner-only response-quality detail (filter reasons). Never on public /r reports.
  const filterReasons = (r.filtered ?? 0) > 0 ? await testFilterReasons(id) : [];

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 90 }}>
      <p className="eyebrow">Evaluation result</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8 }}>{test.title}</h1>
      {projectLine}

      <ShareControls testId={test.id} enabled={!!test.share_enabled} token={test.share_token ?? null} />

      <ReportBody results={r} options={options} votesTarget={test.votes_target} analysisSlot={<AnalysisPanel testId={id} initial={r.analysis ?? null} />} />

      {filterReasons.length > 0 ? (
        <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)" }}>
          <SectionHead>Response quality</SectionHead>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 14px", lineHeight: 1.5 }}><strong style={{ color: "var(--fg-1)" }}>{r.total.toLocaleString()} valid</strong> · {(r.filtered ?? 0).toLocaleString()} filtered before they could influence this decision:</p>
          <Bars rows={filterReasons.map((x) => ({ label: x.label, value: x.count }))} />
        </div>
      ) : null}

      <ExportControls testId={test.id} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <a href="/app/new" className="btn">Run another test <span aria-hidden>→</span></a>
        <a href="/app" className="btn btn--ghost">Dashboard</a>
        {bal < 50 && <a href="/app/credits" className="btn btn--ghost">Buy credits</a>}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", lineHeight: 1.7 }}>
        Credits were held in escrow while the evaluation ran. Low-quality responses were filtered, unused credits refunded, and this report is based only on valid human judgments. It is directional feedback, not a guarantee of sales, clicks, conversions, or revenue.
      </p>
    </div>
  );
}

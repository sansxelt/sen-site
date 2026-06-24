import type { Metadata } from "next";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "@/lib/v-db";
import { getProject } from "@/lib/v-projects";
import { testFilterReasons, testSourceQuality } from "@/lib/v-analytics";
import { evaluationIntelligence, evaluationHealth } from "@/lib/v-intelligence";
import { SectionHead, Bars, HealthBadge } from "../../../_workspace/analytics-ui";
import { CollectionLinks } from "../../../_workspace/collection-links";
import { ScreeningManager } from "../../../_workspace/screening-manager";
import { screeningStats } from "@/lib/v-screening";
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
    <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: -4, marginBottom: 14 }}>Project: <a href={`/app/projects/${project.id}`} style={{ color: "var(--acc-deep)", textDecoration: "none" }}>{project.name}</a> <span style={{ color: "var(--fg-5)" }}>·</span> <a href={`/app/projects/${project.id}`} style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Share this project with a client →</a></p>
  ) : null;
  // Owner-only audience profile + screening stats (never on the public /r report).
  const screen = await screeningStats(id);
  const audienceLine = test.target_audience ? <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: -4, marginBottom: 14 }}>Audience: {test.target_audience}</p> : null;

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
        {audienceLine}
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
            <div style={{ marginTop: 22 }}><ScreeningManager testId={test.id} /></div>
            <CollectionLinks testId={test.id} />
          </>
        )}
      </div>
    );
  }

  // ── Complete report ──
  const r = report.results;
  const bal = await balance(email);
  // Owner-only response-quality detail (filter reasons + source quality + health).
  // None of this is rendered on the public /r report.
  const filterReasons = (r.filtered ?? 0) > 0 ? await testFilterReasons(id) : [];
  const sources = await testSourceQuality(id);
  const health = evaluationHealth("complete", evaluationIntelligence(r, test.votes_target));
  const noisySource = sources.find((sq) => sq.total >= 10 && sq.filterRate >= 25);

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 90 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ marginBottom: 0 }}>Evaluation result</p>
        <HealthBadge state={health} />
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8, marginTop: 8 }}>{test.title}</h1>
      {projectLine}
      {audienceLine}

      <ShareControls testId={test.id} enabled={!!test.share_enabled} token={test.share_token ?? null} />

      <ReportBody results={r} options={options} votesTarget={test.votes_target} analysisSlot={<AnalysisPanel testId={id} initial={r.analysis ?? null} />} />

      {screen.enabled ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <SectionHead>Audience quality</SectionHead>
          {test.target_audience ? <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px" }}>Target audience: <strong style={{ color: "var(--fg-1)" }}>{test.target_audience}</strong></p> : null}
          {screen.screened > 0 ? (
            <>
              <Bars rows={[{ label: "Qualified judgments", value: test.votes_valid }, { label: "Disqualified responses", value: screen.disqualified }]} />
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 12, marginBottom: 0 }}>{screen.qualified} of {screen.screened} screened qualified · {screen.rate}% qualification rate · audience fit <span className="pill" style={{ background: screen.fit === "Strong fit" ? "var(--acc-soft)" : "var(--bg-1)", color: screen.fit === "Strong fit" ? "var(--acc-deep)" : "var(--fg-3)", borderColor: "var(--line-2)" }}>{screen.fit}</span></p>
            </>
          ) : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>No qualified judgments yet. Share this evaluation with the target audience, or adjust your screening criteria.</p>}
        </div>
      ) : null}

      <ScreeningManager testId={test.id} />
      <CollectionLinks testId={test.id} />

      {filterReasons.length > 0 ? (
        <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)" }}>
          <SectionHead>Response quality</SectionHead>
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 14px", lineHeight: 1.5 }}><strong style={{ color: "var(--fg-1)" }}>{r.total.toLocaleString()} valid</strong> · {(r.filtered ?? 0).toLocaleString()} filtered before they could influence this decision:</p>
          <Bars rows={filterReasons.map((x) => ({ label: x.label, value: x.count }))} />
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <SectionHead>Signal source quality</SectionHead>
          <Bars rows={sources.map((sq) => ({ label: sq.label, value: sq.valid, sub: `${sq.filterRate}% filtered` }))} unit=" valid" />
          {noisySource ? (
            <p style={{ fontSize: 12.5, color: "var(--money)", marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>A high share of <strong>{noisySource.label}</strong> responses were filtered ({noisySource.filterRate}%). Consider collecting more judgments from another channel before acting on this result.</p>
          ) : <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Source is captured for judgments collected after the latest update. Older judgments show as Direct link.</p>}
        </div>
      ) : null}

      <ExportControls testId={test.id} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <a href="/app/new" className="btn">Run another evaluation <span aria-hidden>→</span></a>
        <a href="/app" className="btn btn--ghost">Dashboard</a>
        {bal < 50 && <a href="/app/credits" className="btn btn--ghost">Buy credits</a>}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", lineHeight: 1.7 }}>
        Credits were held in escrow while the evaluation ran. Low-quality responses were filtered, unused credits refunded, and this report is based only on valid human judgments. It is directional feedback, not a guarantee of sales, clicks, conversions, or revenue.
      </p>
    </div>
  );
}

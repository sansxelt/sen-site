import type { Metadata } from "next";
import { auth } from "@/auth";
import { getTestWithOptions, getReport, OPTION_LETTERS } from "@/lib/v-db";
import { getProject } from "@/lib/v-projects";
import { testFilterReasons, testSourceQuality, judgePoolStats, fillStats } from "@/lib/v-analytics";
import { evaluationIntelligence, evaluationHealth } from "@/lib/v-intelligence";
import { decisionReadiness, followupForReadiness } from "@/lib/v-readiness";
import { followupLineage } from "@/lib/v-followup";
import { FollowupPanel } from "../followup-panel";
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

export const metadata: Metadata = { title: "Decision record" };

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
  // Follow-up lineage — shown on BOTH the collecting and completed report views.
  const lineage = await followupLineage(id, email);
  const lineageHeader = lineage.parent ? (
    <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: -4, marginBottom: 14 }}><span className="pill" style={{ fontSize: 10, color: "var(--acc-deep)", marginRight: 8 }}>Confirmation round</span>Follow-up of <a href={`/app/tests/${lineage.parent.id}/report`} style={{ color: "var(--acc-deep)", textDecoration: "none" }}>{lineage.parent.title}</a></p>
  ) : null;

  // ── In progress (collecting votes) ──
  if (!report || test.status !== "complete") {
    const pct = Math.min(100, Math.round((test.votes_valid / Math.max(1, test.votes_target)) * 100));
    const fill = await fillStats(id); // owner-only fill monitor (real-vs-farmed diagnostic)
    // Owner-only: recent filtered-response reasons (aggregate counts, no PII).
    const fillFilterReasons = fill.filtered > 0 ? await testFilterReasons(id) : [];

    // Pace: derive velocity + ETA from timestamps only (no PII). Elapsed since
    // launch; fill velocity over the active valid-vote window; ETA to target at
    // that rate. All best-effort — shown only when there's enough to be honest.
    const launchMs = new Date(test.created_at).getTime();
    const sinceLaunchMs = Math.max(0, Date.now() - launchMs);
    const remaining = Math.max(0, test.votes_target - fill.valid);
    let velocityPerHr: number | null = null;
    let etaMs: number | null = null;
    if (fill.firstValidAt && fill.lastValidAt && fill.valid >= 5) {
      const spanMs = new Date(fill.lastValidAt).getTime() - new Date(fill.firstValidAt).getTime();
      // votes accrued across the span = valid - 1 (intervals between the first and last).
      if (spanMs > 0) {
        velocityPerHr = Math.round(((fill.valid - 1) / (spanMs / 3_600_000)) * 10) / 10;
        if (velocityPerHr > 0 && remaining > 0) etaMs = (remaining / velocityPerHr) * 3_600_000;
      }
    }
    const fmtDur = (ms: number | null): string => {
      if (ms == null || !isFinite(ms)) return "—";
      const m = ms / 60000;
      if (m < 1) return "<1m";
      if (m < 60) return `${Math.round(m)}m`;
      const h = m / 60;
      if (h < 48) return `${Math.round(h)}h`;
      return `${Math.round(h / 24)}d`;
    };
    const fillTone: Record<string, { fg: string; label: string; hint: string }> = {
      healthy: { fg: "var(--acc-deep)", label: "Healthy spread", hint: "Votes are spread across many distinct sources — consistent with real demand." },
      concentrated: { fg: "var(--money)", label: "Concentrated", hint: "A large share comes from few sources. Could be a small real audience — or early farming. Watch it." },
      "likely-farmed": { fg: "var(--err)", label: "Likely farmed", hint: "Most votes trace to very few IPs/devices. This fill is probably NOT real cold-pool demand." },
      insufficient: { fg: "var(--fg-4)", label: "Too early", hint: "Not enough valid votes yet to judge source diversity." },
    };
    const ft = fillTone[fill.diversity] ?? fillTone.insufficient;
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        {justLaunched && test.status === "active" && (
          <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--acc-deep)", marginBottom: 6 }}>Your evaluation is collecting signal</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 8px" }}>This run is live on our servers. You can close this tab and come back anytime.</p>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0 }}>Share the evaluator link to collect judgments faster. Once enough valid responses come in, Vraelis will generate your Decision Package.</p>
            <div style={{ marginTop: 12, padding: "11px 13px", borderRadius: 10, background: "var(--bg-1)", border: "1px solid var(--acc-line)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 4 }}>Share with evaluators</div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Publish the link below and send it to your audience. Evaluators compare the outputs and answer one short judgment task. Low-quality responses are filtered automatically.</p>
            </div>
          </div>
        )}
        <p className="eyebrow">Collecting judgments</p>
        <h1 className="display" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginBottom: 8, lineHeight: 1.2 }}>{test.title}</h1>
        {lineageHeader}
        {projectLine}
        {audienceLine}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.votes_valid} of {test.votes_target} qualified judgments collected</p>
        <div style={{ height: 10, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", marginBottom: 24 }}>
          <div className="pulse" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
        </div>

        {/* Fill monitor — owner-only diagnostic: is this fill REAL demand or a few sources cycling? */}
        {fill.valid > 0 && (
          <div className="card" style={{ marginBottom: 24, background: "var(--bg-2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Fill monitor</span>
              <span className="pill" style={{ color: ft.fg, borderColor: "var(--line-2)" }}>{ft.label}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {([["Valid", `${fill.valid}`], ["Filtered", `${fill.filtered}`], ["Unique IPs", `${fill.uniqueIPs}`], ["Unique devices", `${fill.uniqueDevices}`], ["Votes / IP", fill.votesPerIP == null ? "—" : `${fill.votesPerIP}`], ["Top IP share", fill.topIPShare == null ? "—" : `${fill.topIPShare}%`]] as [string, string][]).map(([l, v]) => (
                <div key={l} style={{ padding: "8px 11px", borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-1)", minWidth: 84 }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Pace: fill %, elapsed, velocity, ETA — the "is it filling or stalling?" read. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {([["Fill", `${pct}% of ${test.votes_target}`], ["Running", fmtDur(sinceLaunchMs)], ["Velocity", velocityPerHr == null ? "—" : `${velocityPerHr}/hr`], ["ETA to target", remaining === 0 ? "target hit" : fmtDur(etaMs)]] as [string, string][]).map(([l, v]) => (
                <div key={l} style={{ padding: "8px 11px", borderRadius: 9, background: "var(--bg-1)", border: "1px solid var(--line-1)", minWidth: 96 }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", marginBottom: 10 }}>
              {fill.timeToValid.map((t) => (
                <span key={t.n}>→ {t.n} valid: <strong style={{ color: "var(--fg-2)" }}>{t.ms == null ? "—" : t.ms < 60000 ? `${Math.round(t.ms / 1000)}s` : `${Math.round(t.ms / 60000)}m`}</strong></span>
              ))}
            </div>
            {/* Recent vote errors (filtered-response reasons, aggregate counts only). */}
            {fillFilterReasons.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {fillFilterReasons.slice(0, 5).map((x) => (
                  <span key={x.label} className="pill" style={{ fontSize: 10, color: "var(--fg-3)", borderColor: "var(--line-2)" }}>{x.label}: <strong style={{ color: "var(--money)" }}>{x.count}</strong></span>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: 0, lineHeight: 1.55 }}><strong style={{ color: ft.fg }}>{ft.label}.</strong> {ft.hint} A real cold-pool fill spreads across many distinct IPs/devices; few sources cycling = farming. (Visible only to you, the owner.)</p>
          </div>
        )}

        {options.every((o) => !o.asset_url) ? (
          // Text candidates → wide, readable cards (judges compare text, not thumbnails).
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
            {options.map((o, i) => (
              <div key={o.id} className="card" style={{ background: "var(--bg-2)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)", marginBottom: 7 }}>Response {OPTION_LETTERS[i] ?? "?"}</div>
                <p style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{o.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 10, marginBottom: 24, maxWidth: 460 }}>
            {options.map((o, i) => (
              <div key={o.id} style={{ position: "relative" }}>
                <OptionThumb o={o} size={84} />
                <span style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{OPTION_LETTERS[i] ?? "?"}</span>
              </div>
            ))}
          </div>
        )}
        {test.status === "active" && (
          <>
            {/* 1. Share the evaluator link — the primary action after launch */}
            <ShareControls testId={test.id} enabled={!!test.share_enabled} token={test.share_token ?? null} />
            {/* 2. Audience screening · 3. Collection links */}
            <div style={{ marginTop: 22 }}><ScreeningManager testId={test.id} /></div>
            <CollectionLinks testId={test.id} />
            {/* 4. End collection early — secondary, de-emphasised */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 22 }}>
              <CloseButton testId={test.id} />
              <span style={{ fontSize: 12.5, color: "var(--fg-5)" }}>Results may be weak if you close before enough qualified judgments are collected. Unfilled credits are refunded.</span>
            </div>
            {/* 5. Embed code — developer-facing, lowest priority */}
            <EmbedSnippet testId={test.id} />
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
  const judgePool = await judgePoolStats(id);
  const intel = evaluationIntelligence(r, test.votes_target);
  const health = evaluationHealth("complete", intel);
  const noisySource = sources.find((sq) => sq.total >= 10 && sq.filterRate >= 25);
  // Decision readiness → suggested confirmation round (owner-only action) + lineage.
  const readiness = decisionReadiness({ complete: true, intel, valid: r.total, target: test.votes_target, audienceFit: screen.fit, screeningEnabled: screen.enabled });
  const followPlan = followupForReadiness(readiness.label);
  const followTarget = followPlan && (followPlan.type === "retest_top_two" || followPlan.type === "confirm_recommendation") ? Math.max(test.votes_target || 100, 150) : (test.votes_target || 100);

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 90 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ marginBottom: 0 }}>Decision record</p>
        <HealthBadge state={health} />
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 8, marginTop: 8 }}>{test.title}</h1>
      {lineageHeader}
      {projectLine}
      {audienceLine}

      <ShareControls testId={test.id} enabled={!!test.share_enabled} token={test.share_token ?? null} />

      <ReportBody results={r} options={options} votesTarget={test.votes_target} complete viewerCanAct audienceFit={screen.fit} screeningEnabled={screen.enabled} judgePool={judgePool} analysisSlot={<AnalysisPanel testId={id} initial={r.analysis ?? null} />} />

      <FollowupPanel testId={test.id} plan={followPlan} defaultTarget={followTarget} balance={bal} />
      {lineage.children.length > 0 ? (
        <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Confirmation rounds</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lineage.children.map((c) => (
              <a key={c.id} href={`/app/tests/${c.id}/report`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--fg-1)", textDecoration: "none" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span className="pill" style={{ fontSize: 9.5, color: "var(--fg-4)", marginRight: 8 }}>{c.type ?? "follow-up"}</span>{c.title}</span>
                <span style={{ fontSize: 12, color: "var(--acc-deep)" }}>{c.status === "complete" ? "Report →" : "View →"}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

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
        <a href="/app" className="btn btn--ghost">Dashboard</a>
        <a href="/app/new" className="btn btn--ghost">Create similar evaluation</a>
        {bal < 50 && <a href="/app/credits" className="btn btn--ghost">Buy credits</a>}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", lineHeight: 1.7 }}>
        Credits were held in escrow while the evaluation ran. Low-quality responses were filtered, unused credits refunded, and this decision record is based only on valid human judgments. It is directional guidance from human evaluation, not a guarantee of sales, clicks, conversions, or revenue.
      </p>
    </div>
  );
}

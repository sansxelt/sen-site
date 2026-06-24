import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { balance } from "@/lib/v-credits";
import { eventCounts, lastEventAt } from "@/lib/v-events";
import { cookies } from "next/headers";
import { decisionAnalytics } from "@/lib/v-analytics";
import { listProjects } from "@/lib/v-projects";
import { getWorkspaceContext, resolveWorkspaceSelection, workspaceProjectSummaries } from "@/lib/v-workspace";
import { SectionHead, Bars, Spark, Dist, CONF_COLORS, SIGNAL_COLORS } from "../_workspace/analytics-ui";
import { SharedWithYou } from "../_workspace/shared-with-you";
import { WorkspaceMemberView } from "../_workspace/workspace-member-view";

export const metadata: Metadata = { title: "Analytics" };

const fmtDate = (s: string | null) => { try { return s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"; } catch { return "—"; } };

export default async function DataPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata");

  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isPersonal) return <WorkspaceMemberView selected={selected} summary={await workspaceProjectSummaries(selected)} variant="data" />;

  const [a, bal, projects, counts, lastApi, lastHook, ctx] = await Promise.all([
    decisionAnalytics(email),
    balance(email),
    listProjects(email),
    eventCounts(email, ["export_downloaded", "api_request_made", "webhook_delivered", "webhook_failed"]),
    lastEventAt(email, "api_request_made"),
    lastEventAt(email, "webhook_delivered"),
    getWorkspaceContext(email),
  ]);
  const sharedCard = <SharedWithYou shared={ctx.shared.map((w) => ({ workspace_id: w.workspace_id, name: w.name, role: w.role }))} sharedProjects={ctx.sharedProjects.map((p) => ({ project_id: p.project_id, name: p.name, workspace_name: p.workspace_name, role: p.role }))} />;
  const projName: Record<string, string> = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const hasData = a.core.total > 0;
  const hasApi = (counts.api_request_made ?? 0) > 0 || (counts.webhook_delivered ?? 0) > 0;

  if (!hasData) {
    return (
      <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
        <div className="phead"><div><p className="eyebrow">Decision analytics</p><h1 className="display">Decision analytics</h1></div></div>
        {sharedCard}
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 6vw, 64px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No analytics in your workspace yet</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.55 }}>Run your first evaluation to see decision quality, signal cleanliness, confidence, and category trends here — all from your real results. Analytics shared with you appear above.</p>
          <a href="/app/new" className="btn btn--lg">Create an evaluation →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Decision analytics</p>
          <h1 className="display">Decision analytics</h1>
          <p>Decision quality, signal cleanliness, and category trends — derived from your real evaluations and reports.</p>
        </div>
        <a href="/app/data-quality" className="btn btn--ghost">Data quality →</a>
      </div>

      {sharedCard}

      {/* core metrics */}
      <div className="tile-grid cols-4" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="stat__l">Evaluations</div><div className="stat__v tnum">{a.core.total.toLocaleString()}</div><div className="stat__s">{a.core.completed} completed, {a.core.active} active</div></div>
        <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{a.core.validJudgments.toLocaleString()}</div><div className="stat__s">real human signal</div></div>
        <div className="stat"><div className="stat__l">Filtered</div><div className="stat__v tnum">{a.core.filtered.toLocaleString()}</div><div className="stat__s">{a.core.filterRate}% filter rate</div></div>
        <div className="stat"><div className="stat__l">Avg preference margin</div><div className="stat__v tnum">{a.core.avgMargin == null ? "—" : `${a.core.avgMargin} pts`}</div><div className="stat__s">across decisions</div></div>
      </div>
      <div className="tile-grid cols-4" style={{ marginBottom: 26 }}>
        <div className="stat"><div className="stat__l">Total responses</div><div className="stat__v tnum">{a.core.responses.toLocaleString()}</div><div className="stat__s">valid + filtered</div></div>
        <div className="stat"><div className="stat__l">Credits used</div><div className="stat__v tnum">{a.credits.used.toLocaleString()}</div><div className="stat__s">on evaluations</div></div>
        <div className="stat"><div className="stat__l">Credits remaining</div><div className="stat__v tnum">{bal.toLocaleString()}</div><div className="stat__s"><a href="/app/credits" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>Top up →</a></div></div>
        <div className="stat"><div className="stat__l">Completed (30d)</div><div className="stat__v tnum">{a.trends.completed30}</div><div className="stat__s">{a.trends.completed7} in last 7 days</div></div>
      </div>

      {/* decision + signal quality */}
      <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
        <div className="card">
          <SectionHead>Decision quality</SectionHead>
          <Dist items={[
            { label: "Strong", value: a.quality.strong, color: CONF_COLORS.Strong },
            { label: "Moderate", value: a.quality.moderate, color: CONF_COLORS.Moderate },
            { label: "Tentative", value: a.quality.tentative, color: CONF_COLORS.Tentative },
            { label: "Inconclusive", value: a.quality.inconclusive, color: CONF_COLORS.Inconclusive },
          ]} />
          <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Directional confidence across completed evaluations.</p>
        </div>
        <div className="card">
          <SectionHead>Signal quality</SectionHead>
          <Dist items={[
            { label: "Clean", value: a.quality.clean, color: SIGNAL_COLORS.Clean },
            { label: "Limited", value: a.quality.limited, color: SIGNAL_COLORS.Limited },
            { label: "Needs more", value: a.quality.needsMore, color: SIGNAL_COLORS.NeedsMore },
          ]} />
          <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>How clean and sufficient the human signal was.</p>
        </div>
      </div>

      {/* decision readiness (evaluation health) */}
      <SectionHead right={<a href="/app/data-quality" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none" }}>Signal quality →</a>}>Decision readiness</SectionHead>
      <div className="card" style={{ marginBottom: 26 }}>
        <Bars rows={[
          { label: "Ready to decide", value: a.health.ready },
          { label: "Needs more judgments", value: a.health.needsMore },
          { label: "Noisy signal", value: a.health.noisy },
          { label: "Too close to call", value: a.health.tooClose },
          { label: "Low-quality traffic", value: a.health.lowQuality },
          { label: "Collecting", value: a.health.collecting },
        ].filter((r) => r.value > 0)} unit=" evals" />
      </div>

      {/* trends */}
      <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
        <div className="card"><SectionHead>Evaluations created</SectionHead><Spark data={a.trends.createdDaily} caption={`${a.trends.created30} in last 30 days · ${a.trends.created7} in last 7`} /></div>
        <div className="card"><SectionHead>Credits used</SectionHead><Spark data={a.credits.usedDaily} caption="Last 30 days" /></div>
      </div>

      {/* category intelligence */}
      <SectionHead>Category intelligence</SectionHead>
      <div className="card" style={{ marginBottom: 26, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--fg-4)", fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <th style={{ padding: "0 0 10px" }}>Category</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Evals</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Done</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Valid</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Avg margin</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Strong</th>
            </tr>
          </thead>
          <tbody>
            {a.byCategory.map((c) => (
              <tr key={c.category} style={{ borderTop: "1px solid var(--line-1)" }}>
                <td style={{ padding: "10px 0", color: "var(--fg-1)", fontWeight: 600 }}>{c.label}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{c.count}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{c.completed}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{c.valid.toLocaleString()}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{c.avgMargin == null ? "—" : `${c.avgMargin} pts`}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: c.strongRate >= 50 ? "var(--acc-deep)" : "var(--fg-3)", fontWeight: 600 }}>{c.strongRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* project breakdown */}
      {a.byProject.length > 0 ? (
        <>
          <SectionHead right={<a href="/app/projects" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none" }}>All projects →</a>}>Valid judgments by project</SectionHead>
          <div className="card" style={{ marginBottom: 26 }}>
            <Bars rows={a.byProject.map((p) => ({ label: projName[p.project_id] ?? "Project", value: p.valid, sub: `${p.completed} completed` })).sort((x, y) => y.value - x.value).slice(0, 8)} />
          </div>
        </>
      ) : null}

      {/* API & webhook usage (kept from before) */}
      {hasApi ? (
        <>
          <SectionHead right={<a href="/app/api-keys" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none" }}>Full API analytics →</a>}>API &amp; webhook usage</SectionHead>
          <div className="card" style={{ marginBottom: 26, display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["API requests", (counts.api_request_made ?? 0).toLocaleString()], ["Webhooks delivered", (counts.webhook_delivered ?? 0).toLocaleString()], ["Webhook failures", (counts.webhook_failed ?? 0).toLocaleString()], ["Last API / webhook", `${fmtDate(lastApi)} / ${fmtDate(lastHook)}`]].map(([l, v]) => (
              <div key={l} style={{ flex: "1 1 160px" }}><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div><div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{v}</div></div>
            ))}
          </div>
        </>
      ) : null}

      {/* export */}
      <div className="card" style={{ background: "var(--bg-2)", borderRadius: "var(--r-xl)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, marginBottom: 4 }}>Export your decision data</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>Summary, standard, and Scale exports as JSON or CSV — recommended output, margin, confidence, judgment quality, and reasoning. From any completed report.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/app/data-quality" className="btn btn--ghost">Data quality</a>
          <a href="/developers#export" className="btn btn--ghost">Export docs →</a>
        </div>
      </div>
    </div>
  );
}

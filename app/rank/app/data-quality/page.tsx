import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { dataQuality, sourceQuality } from "@/lib/v-analytics";
import { screeningStatsForUser } from "@/lib/v-screening";
import { getWorkspaceContext, resolveWorkspaceSelection, workspaceProjectSummaries } from "@/lib/v-workspace";
import { SectionHead, Bars } from "../_workspace/analytics-ui";
import { SharedWithYou } from "../_workspace/shared-with-you";
import { WorkspaceMemberView } from "../_workspace/workspace-member-view";

export const metadata: Metadata = { title: "Data quality" };

export default async function DataQualityPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata-quality");
  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isPersonal) return <WorkspaceMemberView selected={selected} summary={await workspaceProjectSummaries(selected)} variant="data-quality" />;
  const [q, sources, aud, ctx] = await Promise.all([dataQuality(email), sourceQuality(email), screeningStatsForUser(email), getWorkspaceContext(email)]);
  const hasData = q.responses > 0;
  const sharedCard = <SharedWithYou shared={ctx.shared.map((w) => ({ workspace_id: w.workspace_id, name: w.name, role: w.role }))} sharedProjects={ctx.sharedProjects.map((p) => ({ project_id: p.project_id, name: p.name, workspace_name: p.workspace_name, role: p.role }))} />;

  return (
    <div className="wrap" style={{ maxWidth: 900, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Signal quality</p>
          <h1 className="display">Data quality</h1>
          <p>Vraelis filters low-quality responses before they influence your decision reports, so the recommendation reflects clean human signal, not noise.</p>
        </div>
        <Link href="/data" className="btn btn--ghost">← Analytics</Link>
      </div>

      {sharedCard}

      {!hasData ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 6vw, 64px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No signal yet</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.55 }}>Run an evaluation and collect judgments to see how much low-quality signal Vraelis filters out for you, too-fast responses, duplicates, and spam.</p>
          <Link href="/legacy/checks/new" className="btn btn--lg">Run a legacy check →</Link>
        </div>
      ) : (
        <>
          <div className="tile-grid cols-4" style={{ marginBottom: 26 }}>
            <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{q.valid.toLocaleString()}</div><div className="stat__s">counted in reports</div></div>
            <div className="stat"><div className="stat__l">Filtered out</div><div className="stat__v tnum">{q.filtered.toLocaleString()}</div><div className="stat__s">never influenced a result</div></div>
            <div className="stat"><div className="stat__l">Filter rate</div><div className="stat__v tnum">{q.filterRate}%</div><div className="stat__s">of {q.responses.toLocaleString()} responses</div></div>
            <div className="stat"><div className="stat__l">Clean signal</div><div className="stat__v tnum">{q.cleanPct}%</div><div className="stat__s">valid share</div></div>
          </div>

          <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
            <div className="card">
              <SectionHead>Why responses were filtered</SectionHead>
              {q.reasons.length > 0 ? <Bars rows={q.reasons.map((r) => ({ label: r.label, value: r.count }))} /> : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>No responses have been filtered yet, your collected signal has been clean.</p>}
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Too-fast, duplicate, source-velocity, device-limit, and low-reputation responses are rejected automatically. Raw participant, IP, and device data is never shown.</p>
            </div>
            <div className="card">
              <SectionHead>Signal across evaluations</SectionHead>
              <Bars rows={[
                { label: "Clean signal", value: q.clean },
                { label: "Limited signal", value: q.limited },
                { label: "Needs more judgments", value: q.needsMore },
              ]} unit=" evals" />
              <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
                <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Completion rate</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{q.completionRate}%</div></div>
                <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>In progress</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{q.active}</div></div>
              </div>
            </div>
          </div>

          <SectionHead>Signal sources</SectionHead>
          <div className="card" style={{ marginBottom: 26, overflowX: "auto" }}>
            {sources.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--fg-4)", fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    <th style={{ padding: "0 0 10px" }}>Source</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Responses</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Valid</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Filtered</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Filter rate</th><th style={{ padding: "0 0 10px", textAlign: "right" }}>Clean</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((sq) => (
                    <tr key={sq.source} style={{ borderTop: "1px solid var(--line-1)" }}>
                      <td style={{ padding: "10px 0", color: "var(--fg-1)", fontWeight: 600 }}>{sq.label}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{sq.total.toLocaleString()}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{sq.valid.toLocaleString()}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{sq.filtered.toLocaleString()}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: sq.filterRate >= 25 ? "var(--money)" : "var(--fg-3)", fontWeight: 600 }}>{sq.filterRate}%</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--acc-deep)", fontWeight: 600 }}>{sq.total ? Math.round((sq.valid / sq.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>New judgments will include source quality analytics from now on, direct link, embed, campaign, and referral, with valid and filter rates per source.</p>
            )}
            <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Source is recorded privacy-safely (channel + referrer hostname only, never full URLs, share tokens, IPs, or user agents). Older judgments show as Direct link.</p>
          </div>

          <SectionHead>Audience qualification</SectionHead>
          {aud.evalsWithScreening > 0 ? (
            <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
              <div className="card">
                <div className="tile-grid cols-2" style={{ gap: 14, marginBottom: 14 }}>
                  <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Qualified</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{aud.qualified.toLocaleString()}</div></div>
                  <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Disqualified</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{aud.disqualified.toLocaleString()}</div></div>
                  <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Qualification rate</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--acc-deep)", marginTop: 4 }}>{aud.rate}%</div></div>
                  <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Screened evals</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{aud.evalsWithScreening}</div></div>
                </div>
              </div>
              <div className="card">
                <SectionHead>Audience fit</SectionHead>
                <Bars rows={[{ label: "Strong fit", value: aud.fit.strong }, { label: "Mixed fit", value: aud.fit.mixed }, { label: "Limited fit", value: aud.fit.limited }].filter((r) => r.value > 0)} unit=" evals" />
                {aud.fit.strong + aud.fit.mixed + aud.fit.limited === 0 ? <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Audience fit appears once screened evaluations collect responses.</p> : null}
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 26 }}>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Add screening questions to measure audience fit and filter unqualified responses. Set them on an evaluation&apos;s report page.</p>
            </div>
          )}

          <div className="card" style={{ background: "var(--bg-2)" }}>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}><strong style={{ color: "var(--fg-1)" }}>Vraelis is a signal-quality layer, not a voting or survey tool.</strong> Every decision report is built only from valid, qualified human judgments, low-quality and off-audience responses are filtered before they can move a recommendation.</p>
          </div>
        </>
      )}
    </div>
  );
}

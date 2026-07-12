import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sharedProjectView, ROLE_LABEL } from "@/lib/v-workspace";
import { SectionHead, Dist, Bars, CONF_COLORS, SIGNAL_COLORS } from "../../../_workspace/analytics-ui";

export const metadata: Metadata = { title: "Shared program" };

// A client-safe, read-only project view for project members / client viewers. Shows
// the project's client-ready reports only, no billing, API, webhooks, collection
// links, screening, source details, data-quality internals, or team management.
export default async function SharedProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=%2Fapp%2Fshared%2Fprojects%2F${projectId}`);

  const view = await sharedProjectView(email, projectId);
  if (!view) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty"><div className="empty__icon">🔒</div><h3>No access to this project</h3><p>This project hasn&apos;t been shared with you, or your access was changed.</p><Link href="/team" className="btn">Back to Team</Link></div>
      </div>
    );
  }

  const completed = view.evaluations.filter((e) => e.status === "complete");
  const inProgress = view.evaluations.filter((e) => e.status === "active");

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <Link href="/team" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Team</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shared program</p>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[view.role]} | client-safe view</span>
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 8 }}>{view.project.name}</h1>
      {view.project.description ? <p className="lead-copy" style={{ marginBottom: 8 }}>{view.project.description}</p> : null}
      <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 24 }}>{view.analytics ? "Program analytics and shared decision records." : "You have access to this program's decision records."}</p>

      {/* Read-only project analytics, editor/viewer/admin/owner only (not client viewers) */}
      {view.analytics && view.analytics.completed > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Program analytics | read-only</div>
          <div className="tile-grid cols-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <SectionHead>Decision quality</SectionHead>
              <Dist items={[
                { label: "Strong", value: view.analytics.quality.strong, color: CONF_COLORS.Strong },
                { label: "Moderate", value: view.analytics.quality.moderate, color: CONF_COLORS.Moderate },
                { label: "Tentative", value: view.analytics.quality.tentative, color: CONF_COLORS.Tentative },
                { label: "Inconclusive", value: view.analytics.quality.inconclusive, color: CONF_COLORS.Inconclusive },
              ]} />
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Avg preference margin {view.analytics.avgMargin == null ? "-" : `${view.analytics.avgMargin} pts`} | {view.analytics.filtered.toLocaleString()} filtered</p>
            </div>
            <div className="card">
              <SectionHead>Signal quality</SectionHead>
              <Dist items={[
                { label: "Clean", value: view.analytics.quality.clean, color: SIGNAL_COLORS.Clean },
                { label: "Limited", value: view.analytics.quality.limited, color: SIGNAL_COLORS.Limited },
                { label: "Needs more", value: view.analytics.quality.needsMore, color: SIGNAL_COLORS.NeedsMore },
              ]} />
            </div>
          </div>
          <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
            <div className="card">
              <SectionHead>Decision readiness</SectionHead>
              <Bars rows={[
                { label: "Ready to decide", value: view.analytics.health.ready },
                { label: "Needs more judgments", value: view.analytics.health.needsMore },
                { label: "Noisy signal", value: view.analytics.health.noisy },
                { label: "Too close to call", value: view.analytics.health.tooClose },
                { label: "Low-quality traffic", value: view.analytics.health.lowQuality },
              ].filter((r) => r.value > 0)} unit=" evals" />
            </div>
            <div className="card">
              <SectionHead>Signal sources</SectionHead>
              {view.sources && view.sources.length > 0 ? <Bars rows={view.sources.map((sq) => ({ label: sq.label, value: sq.valid, sub: `${sq.filterRate}% filtered` }))} unit=" valid" /> : <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Source quality appears as judgments are collected. Channel-level only, no personal data.</p>}
            </div>
          </div>
        </>
      )}

      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Decision records</div>
      {completed.length === 0 && inProgress.length === 0 ? (
        <div className="empty"><div className="empty__icon">◷</div><h3>No decision records yet</h3><p>Completed decision workflows will appear here as decision records are ready.</p></div>
      ) : (
        <>
          {completed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
              {completed.map((e) => (
                <Link key={e.test_id} href={`/shared/${e.test_id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{e.title}</div>
                    <span style={{ fontSize: 12.5, color: "var(--acc-deep)" }}>View decision record →</span>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
                    {[["Recommended", e.recommended ?? "-"], ["Confidence", e.confidence ?? "-"], ["Margin", e.margin != null ? `${e.margin} pts` : "-"], ["Signal", e.signal ?? "-"]].map(([k, v]) => (
                      <div key={k}><div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{k}</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", marginTop: 2 }}>{v}</div></div>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {inProgress.length > 0 && (
            <>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>In progress</div>
              <div className="card">
                {inProgress.map((e, i) => (
                  <div key={e.test_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                    <span style={{ fontSize: 13.5 }}>{e.title}</span>
                    <Link href={`/shared/${e.test_id}`} style={{ fontSize: 12, color: "var(--acc-deep)" }}>Status →</Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

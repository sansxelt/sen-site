import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sharedProjectView, ROLE_LABEL } from "@/lib/v-workspace";

export const metadata: Metadata = { title: "Shared project" };

// A client-safe, read-only project view for project members / client viewers. Shows
// the project's client-ready reports only — no billing, API, webhooks, collection
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
        <div className="empty"><div className="empty__icon">🔒</div><h3>No access to this project</h3><p>This project hasn&apos;t been shared with you, or your access was changed.</p><a href="/app/team" className="btn">Back to Team</a></div>
      </div>
    );
  }

  const completed = view.evaluations.filter((e) => e.status === "complete");
  const inProgress = view.evaluations.filter((e) => e.status === "active");

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <a href="/app/team" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Team</a>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Shared project</p>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[view.role]} · client-safe view</span>
      </div>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 8 }}>{view.project.name}</h1>
      {view.project.description ? <p className="lead-copy" style={{ marginBottom: 8 }}>{view.project.description}</p> : null}
      <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 24 }}>You have access to this project&apos;s client-ready reports.</p>

      {completed.length === 0 && inProgress.length === 0 ? (
        <div className="empty"><div className="empty__icon">◷</div><h3>Nothing to review yet</h3><p>No completed evaluations are ready to share yet.</p></div>
      ) : (
        <>
          {completed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
              {completed.map((e) => (
                <a key={e.test_id} href={`/app/shared/${e.test_id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{e.title}</div>
                    <span style={{ fontSize: 12.5, color: "var(--acc-deep)" }}>View report →</span>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
                    {[["Recommended", e.recommended ?? "—"], ["Confidence", e.confidence ?? "—"], ["Margin", e.margin != null ? `${e.margin} pts` : "—"], ["Signal", e.signal ?? "—"]].map(([k, v]) => (
                      <div key={k}><div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{k}</div><div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", marginTop: 2 }}>{v}</div></div>
                    ))}
                  </div>
                </a>
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
                    <a href={`/app/shared/${e.test_id}`} style={{ fontSize: 12, color: "var(--acc-deep)" }}>Status →</a>
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

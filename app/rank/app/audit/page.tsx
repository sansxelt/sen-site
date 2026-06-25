import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { workspaceActivity } from "@/lib/v-audit";

export const metadata: Metadata = { title: "Workspace activity" };

const when = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default async function AuditPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Faudit");
  const events = await workspaceActivity(email, 60);

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Governance</p>
          <h1 className="display">Workspace activity</h1>
          <p>A running record of governance and billing actions across your workspace — for accountability and auditability. Read-only.</p>
        </div>
        <a href="/app/team" className="btn btn--ghost">Manage team</a>
      </div>

      <div className="card" style={{ background: "var(--bg-2)", marginBottom: 18 }}>
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>This log records member, project-access, billing, ownership, and integration changes. It never shows participant identities, payment details, Stripe identifiers, invite tokens, webhook secrets, or raw evaluation data.</p>
      </div>

      {events.length === 0 ? (
        <div className="empty" style={{ margin: "clamp(20px, 5vw, 48px) 0" }}>
          <div className="empty__icon">◷</div>
          <h3 style={{ fontSize: "1.3rem" }}>No activity yet</h3>
          <p>Invites, role changes, billing actions, ownership transfers, and confirmation rounds will appear here as your team works.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
          {events.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>{e.label}</div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="pill" style={{ fontSize: 9.5, color: e.actor === "System" ? "var(--fg-4)" : "var(--acc-deep)" }}>{e.actor}</span>
                  {e.context ? <span>{e.context}</span> : null}
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", whiteSpace: "nowrap" }}>{when(e.when)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

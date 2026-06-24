import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getWorkspaceContext, resolveWorkspaceSelection, sharedTeamView, workspaceProjectSummaries, ROLE_LABEL } from "@/lib/v-workspace";
import { teamSeatState, syncTeamCheckout } from "@/lib/v-team-billing";
import { TeamClient } from "./team-client";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ session_id?: string; team?: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fteam");
  const sp = await searchParams;

  // A selected SHARED workspace shows a read-only team view; the personal workspace
  // (default) keeps the full management UI.
  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isPersonal) {
    const [view, summary] = await Promise.all([sharedTeamView(selected), workspaceProjectSummaries(selected)]);
    return (
      <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="phead"><div><p className="eyebrow">Workspace: {selected.name}</p><h1 className="display">Team</h1><p>{view.clientSafe ? "Client-safe access — shared reports only." : "Read-only view of this shared workspace."}</p></div></div>
        <div className="card" style={{ background: "var(--bg-2)", marginBottom: 18 }}><div style={{ fontSize: 13.5, color: "var(--fg-2)" }}><strong style={{ color: "var(--fg-1)" }}>Workspace: {selected.name}</strong> · Role: {ROLE_LABEL[selected.role]} · {view.clientSafe ? "Client-safe access" : "Read-only"}</div></div>

        {view.clientSafe ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 14 }}>Client viewers can access client-safe reports only.</p>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Shared with you</div>
            {summary.projects.length === 0 ? <div className="empty"><div className="empty__icon">📂</div><h3>No projects shared with you yet</h3></div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{summary.projects.map((p) => <a key={p.id} href={`/app/shared/projects/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ fontSize: 12, color: "var(--acc-deep)" }}>View reports →</span></a>)}</div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Members</div>
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 18 }}>
              {(view.members ?? []).filter((m) => m.status === "active").map((m, i) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 14, color: "var(--fg-1)" }}>{m.email}{m.email === email.trim().toLowerCase() ? " (you)" : ""}</span>
                  <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[m.role]}</span>
                </div>
              ))}
            </div>
            {view.projects.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Project access</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>{view.projects.map((p) => <div key={p.project_id} className="card"><div style={{ fontWeight: 600, marginBottom: 6 }}>{p.project_name}</div>{p.members.map((mm) => <div key={mm.email} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--fg-2)", padding: "4px 0" }}><span>{mm.email}</span><span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{mm.role}</span></div>)}</div>)}</div>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--fg-5)" }}>Read-only — switch to your personal workspace to manage your own team. Member management for shared workspaces stays with the workspace owner.</p>
          </>
        )}
      </div>
    );
  }

  const ctx = await getWorkspaceContext(email);
  // Owner's personal workspace: team-seat billing card. Sync after a checkout return.
  if (ctx.workspace && sp.session_id) await syncTeamCheckout(ctx.workspace.id, sp.session_id);
  const billing = ctx.workspace ? await teamSeatState(ctx.workspace.id) : null;
  return <TeamClient email={email.trim().toLowerCase()} initial={ctx} billing={billing} />;
}

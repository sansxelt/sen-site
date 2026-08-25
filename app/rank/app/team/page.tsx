import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getWorkspaceContext, resolveWorkspaceSelection, sharedTeamView, workspaceProjectSummaries, eligibleOwnershipTransferTargets, canTransferWorkspaceOwnership, pendingOutgoingTransfer, pendingIncomingTransfer, isBillingAdminMember, ROLE_LABEL } from "@/lib/v-workspace";
import { teamSeatState, syncTeamCheckout, syncMigrationCheckout } from "@/lib/v-team-billing";
import { workspaceOrganizationLink } from "@/lib/v-organization";
import { TeamClient } from "./team-client";
import { TeamBillingPanel } from "../billing/team-billing-panel";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ session_id?: string; team?: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fteam");
  const sp = await searchParams;

  // Billing-migration completion fallback (target's checkout return), runs regardless of
  // which workspace is selected, in case the webhook is delayed. Idempotent.
  if (sp.session_id) await syncMigrationCheckout(sp.session_id);
  // A pending transfer addressed to this user (target), show the accept card anywhere.
  const incoming = await pendingIncomingTransfer(email);

  // A workspace the caller does NOT own shows the read-only team view; a workspace
  // they OWN (personal or one transferred to them) keeps the full management UI.
  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  if (selected && !selected.isOwner) {
    const [view, summary, billingAdmin] = await Promise.all([sharedTeamView(selected), workspaceProjectSummaries(selected), isBillingAdminMember(selected.id, email)]);
    const baBilling = billingAdmin ? await teamSeatState(selected.id) : null;
    return (
      <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="phead"><div><p className="eyebrow">Workspace: {selected.name}</p><h1 className="display">Team</h1><p>{view.clientSafe ? "Client-safe access, shared reports only." : "Read-only view of this shared workspace."}</p></div></div>
        <div className="card" style={{ background: "var(--bg-2)", marginBottom: 18 }}><div style={{ fontSize: 13.5, color: "var(--fg-2)" }}><strong style={{ color: "var(--fg-1)" }}>Workspace: {selected.name}</strong> | Role: {ROLE_LABEL[selected.role]}{billingAdmin ? " | Billing admin" : ""} | {view.clientSafe ? "Client-safe access" : "Read-only"}</div></div>

        {baBilling ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Team billing</div>
            <TeamBillingPanel workspaceName={selected.name} billing={baBilling} canManage={false} />
          </div>
        ) : null}

        {view.clientSafe ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 14 }}>Client viewers can access client-safe reports only.</p>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Shared with you</div>
            {summary.projects.length === 0 ? (
              <div className="empty">
                <EmptyIcon d={I.folder} />
                <h3>No projects shared with you yet</h3>
                <p>Ask the owner of {selected.name} to share a project with you. Client-safe reports appear here the moment they do.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{summary.projects.map((p) => <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span><span style={{ fontSize: 12, color: "var(--fg-4)" }}>Shared project</span></div>)}</div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Members</div>
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 18 }}>
              {(view.members ?? []).filter((m) => m.status === "active").map((m, i) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 14, color: "var(--fg-1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}{m.email === email.trim().toLowerCase() ? " (you)" : ""}</span>
                  <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[m.role]}</span>
                </div>
              ))}
            </div>
            {view.projects.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Program access</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>{view.projects.map((p) => <div key={p.project_id} className="card"><div style={{ fontWeight: 600, marginBottom: 6 }}>{p.project_name}</div>{p.members.map((mm) => <div key={mm.email} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13, color: "var(--fg-2)", padding: "4px 0" }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mm.email}</span><span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{mm.role}</span></div>)}</div>)}</div>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--fg-5)" }}>Read-only, switch to your personal workspace to manage your own team. Member management for shared workspaces stays with the workspace owner.</p>
          </>
        )}
      </div>
    );
  }

  // Owner-managed workspace (the selected one if they own it, else personal).
  const ctx = await getWorkspaceContext(email, selected?.isOwner ? selected.id : undefined);
  // Normal team-checkout sync, NOT for migration returns (those are handled by
  // syncMigrationCheckout above + the webhook, so they never fall through to normal sync).
  if (ctx.workspace && sp.session_id && sp.team !== "migrated") await syncTeamCheckout(ctx.workspace.id, sp.session_id);
  const wsId = ctx.workspace?.id ?? null;
  const [billing, transferTargets, transferGuard, outgoing, orgLink] = wsId
    ? await Promise.all([teamSeatState(wsId), eligibleOwnershipTransferTargets(email, wsId), canTransferWorkspaceOwnership(email, wsId), pendingOutgoingTransfer(wsId), workspaceOrganizationLink(wsId)])
    : [null, [], { ok: false, blocked: false }, null, null];
  const transfer = { blocked: !!transferGuard.blocked, eligible: transferTargets, workspaceName: ctx.workspace?.name ?? "", pending: outgoing, incoming };
  return <TeamClient email={email.trim().toLowerCase()} initial={ctx} billing={billing} transfer={transfer} orgLink={orgLink} />;
}

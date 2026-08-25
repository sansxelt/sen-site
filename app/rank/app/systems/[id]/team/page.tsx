import type { Metadata } from "next";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication } from "@/lib/v-applications";
import { applicationAccess, applicationWorkspaceForManage } from "@/lib/preflight/team-access";
import { listMembers, canManageMembers, ROLE_LABEL, activateInvitesForEmail } from "@/lib/v-workspace";
import { AppTabs } from "../app-tabs";
import { TeamPanel } from "./team-panel";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Team" };

// Team for one application: invite teammates to collaborate on this app (its contract, flows, runs, and
// reports) with a role. Owner/admin manage; everyone else sees the read-only roster. The application is
// SHARED through its workspace; billing stays with the app owner (a teammate's runs spend the owner's
// credits). Access resolves via applicationAccess — a member of the app's workspace may open this page too.
export default async function AppTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!preflightEnabled()) redirect("/app");
  const email = (await auth())?.user?.email;
  // Relative, so the open-redirect allowlist keeps it. Wrapped in appHostUrl() it became an absolute URL,
  // which safeReturnPath rejects, and the invited teammate landed on account settings instead of the team
  // they were invited to. See the note in lib/v-preflight-guard.ts.
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent("/systems/" + id + "/team")}`);
  // A teammate invited by email token activates on click; a token-less (email-match) invite activates on
  // first Preflight visit — do it here so a newly-invited member sees their shared apps immediately.
  await activateInvitesForEmail(email);
  if (!(await preflightDbReady())) return <SetupRequired />;

  // SECURITY: goes through the hardened guard, not applicationAccess directly. Calling the raw
  // resolver skipped hasAtLeastRole, so a client_viewer — a report-only side role the API refuses —
  // reached this page and saw the app name, its own role badge and the full internal nav. The guard
  // was fixed; this call site was reaching around it.
  const access = await requirePreflightAppAccess(id, `/systems/${id}/team`);
  const app = access ? await getApplication(access.owner, id) : null;
  if (!access || !app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>System not found</h3>
          <p>This system doesn&apos;t exist, or you don&apos;t have access to it.</p>
          <Link href="/systems" className="btn">Back to systems</Link>
        </div>
      </div>
    );
  }

  const manage = canManageMembers(access.role);
  // Owner/admin: resolve the manageable workspace (heals a NULL workspace_id on first visit) + full roster.
  // Others: a read-only roster of the app's workspace, if any.
  const ws = manage ? await applicationWorkspaceForManage(email, id) : null;
  const members = ws
    ? (await listMembers(ws.workspaceId)).filter((m) => m.status !== "revoked").map((m) => ({ id: m.id, email: m.email, role: m.role, status: m.status, you: m.email === email.trim().toLowerCase() }))
    : [];

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/systems" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Systems</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0 }}>
        Your role: <span style={{ fontWeight: 600, color: "var(--fg-1)" }}>{ROLE_LABEL[access.role]}</span>
      </p>

      <AppTabs appId={id} active="team" />

      {manage && ws ? (
        <TeamPanel appId={id} initialMembers={members} />
      ) : (
        <ReadOnlyRoster appId={id} yourRole={ROLE_LABEL[access.role]} />
      )}
    </div>
  );
}

// A non-manager (editor/viewer) sees who they share the app with is owner-managed, and where to ask for a
// role change. We intentionally do NOT list every teammate's email to a plain viewer (that is the owner's to
// share); we state the collaboration model and their capabilities honestly.
function ReadOnlyRoster({ appId, yourRole }: { appId: string; yourRole: string }) {
  return (
    <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", maxWidth: 720 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>Shared with your team</h2>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "10px 0 0" }}>
        You have <strong style={{ color: "var(--fg-1)" }}>{yourRole}</strong> access to this system. It&apos;s
        owned and managed by your workspace owner, who invites teammates and sets each person&apos;s role.
        {" "}Editors can author the contract and flows and launch verifications; viewers can read the
        contract, verifications, and reports.
      </p>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.6, margin: "12px 0 0" }}>
        Runs on this system are billed to the owner&apos;s account. To change your role or invite others,
        ask the system owner.
      </p>
      <div style={{ marginTop: 16 }}>
        <Link href={`/systems/${appId}`} className="btn" style={{ fontSize: 13 }}>Back to overview</Link>
      </div>
    </div>
  );
}

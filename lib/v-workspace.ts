// Team workspaces + client seats (v1). A workspace groups a team's projects/
// evaluations; every user lazily gets a personal workspace they own. Members are
// invited by email and activated when that email signs in. Roles gate access here
// (centralized permission helpers) — NO billing/credit/API/schema behavior change.
// Tolerant of the tables being absent (pre-migration) — degrades to "just you".

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { getReport } from "./v-db";
import { evaluationIntelligence } from "./v-intelligence";
import { projectAnalytics, projectSourceQuality } from "./v-analytics";
import { sendInviteEmail, type InviteDelivery } from "./email";
import { allow } from "./vraelis-ratelimit";
import { canAddPaidSeat, logSeatChange, PAID_SEAT_ROLES, hasActiveTeamBillingForTransferGuard } from "./v-team-billing";

const norm = (e: string) => e.trim().toLowerCase();
const SITE = "https://vraelis.com";
const INVITE_TTL_DAYS = 7;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// Mint a secure one-time, expiring invite token: store ONLY the hash + expiry, return
// the raw token (which goes only into the email link). Tolerant of missing columns
// (pre-migration) — returns null so callers fall back to the sign-in (email-match) link.
async function mintInviteToken(table: "v_workspace_members" | "v_project_members", memberId: string): Promise<string | null> {
  try {
    const s = getSupabaseAdminClient();
    const token = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const expires = new Date(now.getTime() + INVITE_TTL_DAYS * 86400_000).toISOString();
    const { data: cur } = await s.from(table as never).select("invite_send_count").eq("id", memberId).maybeSingle();
    const count = ((cur as unknown as { invite_send_count?: number } | null)?.invite_send_count ?? 0) + 1;
    const { error } = await s.from(table as never).update({ invite_token_hash: hashToken(token), invite_expires_at: expires, invite_last_sent_at: now.toISOString(), invite_send_count: count } as never).eq("id", memberId);
    if (error) return null; // columns not present yet
    return token;
  } catch { return null; }
}

function inviteAcceptUrl(token: string | null, fallbackPath: string): string {
  return token ? `${SITE}/invite/${token}` : `${SITE}/signin?callbackUrl=${encodeURIComponent(fallbackPath)}`;
}

// Best-effort invite email + safe delivery-status event. Never throws; the invite
// row is already stored by the caller. Logs invite_email_sent / invite_email_failed
// with no email/token/URL — only ids, role, type, and delivery status.
async function dispatchInvite(actor: string, p: { type: "workspace" | "project"; to: string; workspaceName?: string; projectName?: string; role: string; acceptUrl: string; workspace_id?: string | null; project_id?: string | null }): Promise<InviteDelivery> {
  const status = await sendInviteEmail({ type: p.type, to: p.to, workspaceName: p.workspaceName, projectName: p.projectName, role: p.role, acceptUrl: p.acceptUrl });
  if (status === "sent" || status === "failed") {
    await logEvent({ userId: actor, eventType: status === "sent" ? "invite_email_sent" : "invite_email_failed", actorType: "owner", source: "app", metadata: { invite_type: p.type, workspace_id: p.workspace_id ?? null, project_id: p.project_id ?? null, role: p.role, delivery_status: status } });
  }
  return status;
}

export type Role = "owner" | "admin" | "editor" | "viewer" | "client_viewer";
export const ROLES: Role[] = ["owner", "admin", "editor", "viewer", "client_viewer"];
export const INVITABLE_ROLES: Role[] = ["admin", "editor", "viewer", "client_viewer"];
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer",
};
export const ROLE_DESC: Record<Role, string> = {
  owner: "Full access. Manages the team and owns billing.",
  admin: "Manage projects, evaluations, and members. See analytics and reports.",
  editor: "Create and manage projects and evaluations. See analytics and reports.",
  viewer: "Read-only access to projects, evaluations, and reports.",
  client_viewer: "Read-only access to shared decision reports only — no team, billing, API, or private internals.",
};

export type Workspace = { id: string; owner_user_id: string; name: string; created_at: string };
export type Member = { id: string; workspace_id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string; invite_expires_at?: string | null };
export type SharedWorkspace = { workspace_id: string; name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };

// ── Permission helpers (centralized — no scattered role checks) ──
export const canManageMembers = (r: Role | null) => r === "owner" || r === "admin";
export const canEditProjects = (r: Role | null) => r === "owner" || r === "admin" || r === "editor";
export const canViewAnalytics = (r: Role | null) => r === "owner" || r === "admin" || r === "editor" || r === "viewer";
export const canViewReports = (r: Role | null) => r != null && ROLES.includes(r) && r !== ("revoked" as Role);
export const isClientViewer = (r: Role | null) => r === "client_viewer";

function deriveName(email: string): string {
  const local = norm(email).split("@")[0] || "My";
  return `${local.charAt(0).toUpperCase()}${local.slice(1)}'s workspace`;
}

// Lazily ensure the user's personal workspace exists (owner member row included).
export async function getOrCreatePersonalWorkspace(email: string): Promise<Workspace | null> {
  if (!email || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const uid = norm(email);
  try {
    const { data: existing, error } = await s.from("v_workspaces" as never).select("id,owner_user_id,name,created_at").eq("owner_user_id", uid).order("created_at", { ascending: true }).limit(1);
    if (error) return null; // pre-migration
    const found = (existing as unknown as Workspace[])?.[0];
    if (found) return found;
    const { data: created } = await s.from("v_workspaces" as never).insert({ owner_user_id: uid, name: deriveName(uid) } as never).select("id,owner_user_id,name,created_at").single();
    const ws = created as unknown as Workspace | null;
    if (!ws) return null;
    await s.from("v_workspace_members" as never).insert({ workspace_id: ws.id, user_id: uid, email: uid, role: "owner", status: "active", invited_by: uid } as never);
    await logEvent({ userId: uid, eventType: "workspace_created", actorType: "owner", source: "app", metadata: { workspace_id: ws.id } });
    return ws;
  } catch { return null; }
}

// Recognize invites: any pending member row matching this email becomes active.
export async function activateInvitesForEmail(email: string): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    await s.from("v_workspace_members" as never).update({ user_id: uid, status: "active", updated_at: new Date().toISOString() } as never).eq("email", uid).eq("status", "pending");
  } catch { /* pre-migration / ignore */ }
}

export async function membershipFor(email: string, workspaceId: string): Promise<Member | null> {
  if (!email || !workspaceId || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data } = await s.from("v_workspace_members" as never).select("id,workspace_id,user_id,email,role,status,created_at").eq("workspace_id", workspaceId).eq("email", uid).maybeSingle();
    const m = data as unknown as Member | null;
    return m && m.status === "active" ? m : null;
  } catch { return null; }
}

async function listMembers(workspaceId: string): Promise<Member[]> {
  try {
    const s = getSupabaseAdminClient();
    let q = await s.from("v_workspace_members" as never).select("id,workspace_id,user_id,email,role,status,created_at,invite_expires_at").eq("workspace_id", workspaceId).neq("status", "revoked").order("created_at", { ascending: true });
    if (q.error) q = await s.from("v_workspace_members" as never).select("id,workspace_id,user_id,email,role,status,created_at").eq("workspace_id", workspaceId).neq("status", "revoked").order("created_at", { ascending: true }); // pre-migration
    return (q.data as unknown as Member[]) ?? [];
  } catch { return []; }
}

// Workspaces this user belongs to but does NOT own, with a few shared evaluations
// (completed reports) for client-ready viewing.
async function sharedWorkspaces(email: string, ownWorkspaceId: string | null): Promise<SharedWorkspace[]> {
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data: mem } = await s.from("v_workspace_members" as never).select("workspace_id,role").eq("email", uid).eq("status", "active");
    const rows = ((mem as unknown as { workspace_id: string; role: Role }[]) ?? []).filter((m) => m.workspace_id !== ownWorkspaceId);
    if (!rows.length) return [];
    const wsIds = rows.map((r) => r.workspace_id);
    const { data: wss } = await s.from("v_workspaces" as never).select("id,name").in("id", wsIds);
    const nameById = Object.fromEntries(((wss as unknown as { id: string; name: string }[]) ?? []).map((w) => [w.id, w.name]));
    // projects in those workspaces → completed evaluations (client-ready reports)
    const { data: projs } = await s.from("v_projects" as never).select("id,workspace_id").in("workspace_id", wsIds);
    const projsByWs: Record<string, string[]> = {};
    for (const p of (projs as unknown as { id: string; workspace_id: string }[]) ?? []) (projsByWs[p.workspace_id] ??= []).push(p.id);
    const allProjIds = (projs as unknown as { id: string }[] ?? []).map((p) => p.id);
    const evalsByProj: Record<string, { test_id: string; title: string; status: string }[]> = {};
    if (allProjIds.length) {
      const { data: tests } = await s.from("v_tests" as never).select("id,title,status,project_id,is_sandbox").in("project_id", allProjIds).limit(500);
      for (const t of (tests as unknown as { id: string; title: string; status: string; project_id: string; is_sandbox?: boolean }[]) ?? []) {
        if (t.is_sandbox) continue;
        (evalsByProj[t.project_id] ??= []).push({ test_id: t.id, title: t.title, status: t.status });
      }
    }
    return rows.map((r) => ({
      workspace_id: r.workspace_id,
      name: nameById[r.workspace_id] ?? "Workspace",
      role: r.role,
      evaluations: (projsByWs[r.workspace_id] ?? []).flatMap((pid) => evalsByProj[pid] ?? []).slice(0, 50),
    }));
  } catch { return []; }
}

export type SharedProject = { project_id: string; name: string; workspace_name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
export type ProjectAccessSummary = { project_id: string; project_name: string; members: { email: string; role: ProjectRole; status: string }[] };
export type WorkspaceContext = { workspace: Workspace | null; myRole: Role; members: Member[]; shared: SharedWorkspace[]; sharedProjects: SharedProject[]; projectAccess: ProjectAccessSummary[] };

export async function getWorkspaceContext(email: string, selectedWorkspaceId?: string): Promise<WorkspaceContext> {
  await activateInvitesForEmail(email);
  await activateProjectInvitesForEmail(email);
  let workspace = await getOrCreatePersonalWorkspace(email);
  // Manage a selected workspace the user OWNS (e.g. one transferred to them), not only
  // their personal workspace. Falls back to personal if they don't own the selection.
  if (selectedWorkspaceId && workspace && selectedWorkspaceId !== workspace.id) {
    try {
      const { data } = await getSupabaseAdminClient().from("v_workspaces" as never).select("id,owner_user_id,name,created_at").eq("id", selectedWorkspaceId).maybeSingle();
      const ws = data as unknown as Workspace | null;
      if (ws && ws.owner_user_id === norm(email)) workspace = ws;
    } catch { /* keep personal */ }
  }
  const members = workspace ? await listMembers(workspace.id) : [];
  const shared = await sharedWorkspaces(email, workspace?.id ?? null);
  const sharedProjects = await sharedProjectsForEmail(email);
  const projectAccess = workspace ? await workspaceProjectAccess(workspace.id) : [];
  return { workspace, myRole: "owner", members, shared, sharedProjects, projectAccess };
}

// Projects in a workspace that have project-level members (for the owner/admin
// "Project access" overview on /app/team). Members only — no analytics/private data.
async function workspaceProjectAccess(workspaceId: string): Promise<ProjectAccessSummary[]> {
  try {
    const s = getSupabaseAdminClient();
    const { data: pms } = await s.from("v_project_members" as never).select("project_id,email,role,status").eq("workspace_id", workspaceId).neq("status", "revoked").order("created_at", { ascending: true }).limit(500);
    const rows = (pms as unknown as { project_id: string; email: string; role: ProjectRole; status: string }[]) ?? [];
    if (!rows.length) return [];
    const projIds = [...new Set(rows.map((r) => r.project_id))];
    const { data: projs } = await s.from("v_projects" as never).select("id,name").in("id", projIds);
    const nameById = Object.fromEntries(((projs as unknown as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name]));
    const byProj: Record<string, ProjectAccessSummary> = {};
    for (const r of rows) {
      const ps = (byProj[r.project_id] ??= { project_id: r.project_id, project_name: nameById[r.project_id] ?? "Project", members: [] });
      ps.members.push({ email: r.email, role: r.role, status: r.status });
    }
    return Object.values(byProj);
  } catch { return []; }
}

// ── Member management (owner/admin only) ──
export async function inviteMember(actorEmail: string, workspaceId: string, inviteEmail: string, role: Role): Promise<{ ok: boolean; error?: string; email?: InviteDelivery }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const actor = norm(actorEmail);
  const invitee = norm(inviteEmail);
  if (!invitee || !invitee.includes("@")) return { ok: false, error: "invalid_email" };
  if (!INVITABLE_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  const s = getSupabaseAdminClient();
  // actor must own or admin the workspace
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id,name").eq("id", workspaceId).maybeSingle();
  const wsRow = ws as unknown as { owner_user_id: string; name: string } | null;
  const ownerId = wsRow?.owner_user_id;
  const actorMember = await membershipFor(actor, workspaceId);
  if (ownerId !== actor && !canManageMembers(actorMember?.role ?? null)) return { ok: false, error: "forbidden" };
  if (invitee === ownerId) return { ok: false, error: "already_member" };
  // Seat enforcement: admin/editor/viewer are PAID seats; client_viewer is free.
  if ((PAID_SEAT_ROLES as readonly string[]).includes(role)) {
    const seat = await canAddPaidSeat(workspaceId);
    if (!seat.ok) {
      await logEvent({ userId: actor, eventType: "team_seat_limit_reached", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, seat_count: seat.used, role } });
      return { ok: false, error: "seat_limit" };
    }
  }
  if (!(await allow(`ws-invite:${workspaceId}`, 10, 3600))) return { ok: false, error: "rate_limited" };
  const { data: inserted, error } = await s.from("v_workspace_members" as never).insert({ workspace_id: workspaceId, email: invitee, role, status: "pending", invited_by: actor } as never).select("id").single();
  if (error || !inserted) {
    if (String(error?.message || "").includes("duplicate")) return { ok: false, error: "already_member" };
    return { ok: false, error: "failed" };
  }
  await logEvent({ userId: actor, eventType: "workspace_member_invited", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, role } });
  const token = await mintInviteToken("v_workspace_members", (inserted as unknown as { id: string }).id);
  if (token) await logEvent({ userId: actor, eventType: "invite_token_created", actorType: "owner", source: "app", metadata: { invite_type: "workspace", workspace_id: workspaceId, role } });
  const email = await dispatchInvite(actor, { type: "workspace", to: invitee, workspaceName: wsRow?.name, role, acceptUrl: inviteAcceptUrl(token, "/app/team"), workspace_id: workspaceId });
  return { ok: true, email };
}

export async function changeMemberRole(actorEmail: string, memberId: string, role: Role): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  if (!INVITABLE_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  const s = getSupabaseAdminClient();
  const actor = norm(actorEmail);
  const { data } = await s.from("v_workspace_members" as never).select("id,workspace_id,role").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; workspace_id: string; role: Role } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (m.role === "owner") return { ok: false, error: "cannot_change_owner" };
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id").eq("id", m.workspace_id).maybeSingle();
  const ownerId = (ws as unknown as { owner_user_id: string } | null)?.owner_user_id;
  if (ownerId !== actor && !canManageMembers((await membershipFor(actor, m.workspace_id))?.role ?? null)) return { ok: false, error: "forbidden" };
  await s.from("v_workspace_members" as never).update({ role, updated_at: new Date().toISOString() } as never).eq("id", memberId);
  await logEvent({ userId: actor, eventType: "workspace_member_role_changed", actorType: "owner", source: "app", metadata: { workspace_id: m.workspace_id, role } });
  await logSeatChange(actor, m.workspace_id, "role_changed");
  return { ok: true };
}

export async function revokeMember(actorEmail: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const actor = norm(actorEmail);
  const { data } = await s.from("v_workspace_members" as never).select("id,workspace_id,role").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; workspace_id: string; role: Role } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (m.role === "owner") return { ok: false, error: "cannot_revoke_owner" };
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id").eq("id", m.workspace_id).maybeSingle();
  const ownerId = (ws as unknown as { owner_user_id: string } | null)?.owner_user_id;
  if (ownerId !== actor && !canManageMembers((await membershipFor(actor, m.workspace_id))?.role ?? null)) return { ok: false, error: "forbidden" };
  await s.from("v_workspace_members" as never).update({ status: "revoked", updated_at: new Date().toISOString() } as never).eq("id", memberId);
  await logEvent({ userId: actor, eventType: "workspace_member_revoked", actorType: "owner", source: "app", metadata: { workspace_id: m.workspace_id, role: m.role } });
  await logSeatChange(actor, m.workspace_id, "revoked");
  return { ok: true };
}

// Access check for the member-facing client-ready report view. Resolves
// test → project → workspace → active membership. Returns the viewer's role (or null
// when not permitted). The owner always passes (they also have their own report page).
export async function reportAccessRole(email: string, testId: string): Promise<Role | null> {
  if (!email || !testId || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data: t } = await s.from("v_tests" as never).select("user_id,project_id").eq("id", testId).maybeSingle();
    const test = t as unknown as { user_id: string; project_id: string | null } | null;
    if (!test) return null;
    if (test.user_id === uid) return "owner";
    if (!test.project_id) return null; // no project linkage → owner only
    const { data: p } = await s.from("v_projects" as never).select("workspace_id").eq("id", test.project_id).maybeSingle();
    const wsId = (p as unknown as { workspace_id: string | null } | null)?.workspace_id;
    // Workspace-wide membership grants access to all the workspace's reports …
    if (wsId) { const m = await membershipFor(uid, wsId); if (m) return m.role; }
    // … and project-scoped membership grants access to THIS project's reports only.
    const pm = await projectMembershipFor(uid, test.project_id);
    return pm ? pm.role : null;
  } catch { return null; }
}

// ── Project-limited client sharing ──
export type ProjectRole = "editor" | "viewer" | "client_viewer";
export const PROJECT_ROLES: ProjectRole[] = ["editor", "viewer", "client_viewer"];
export type ProjectMember = { id: string; project_id: string; user_id: string | null; email: string; role: ProjectRole; status: "pending" | "active" | "revoked"; created_at: string; invite_expires_at?: string | null };
export type ProjectAccess = { role: Role; level: "owner" | "workspace" | "project" };

export const canEditProjectFromRole = (r: Role | null) => r === "owner" || r === "admin" || r === "editor";

export async function projectMeta(projectId: string): Promise<{ owner: string; workspace_id: string | null; name: string; description: string | null } | null> {
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_projects" as never).select("user_id,workspace_id,name,description").eq("id", projectId).maybeSingle();
  const p = data as unknown as { user_id: string; workspace_id: string | null; name: string; description: string | null } | null;
  return p ? { owner: p.user_id, workspace_id: p.workspace_id, name: p.name, description: p.description } : null;
}

// A project's manageable basics for a non-owner workspace manager (admin) UI.
// Returns null unless the caller can manage this project's members.
export async function managedProjectMeta(email: string, projectId: string): Promise<{ id: string; name: string; description: string | null } | null> {
  if (!(await canManageProjectMembers(email, projectId))) return null;
  const meta = await projectMeta(projectId);
  return meta ? { id: projectId, name: meta.name, description: meta.description } : null;
}

export async function projectMembershipFor(email: string, projectId: string): Promise<ProjectMember | null> {
  if (!email || !projectId || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_project_members" as never).select("id,project_id,user_id,email,role,status,created_at").eq("project_id", projectId).eq("email", norm(email)).maybeSingle();
    const m = data as unknown as ProjectMember | null;
    return m && m.status === "active" ? m : null;
  } catch { return null; }
}

// Combined access: project owner, then workspace membership, then project membership.
export async function getProjectAccessRole(email: string, projectId: string): Promise<ProjectAccess | null> {
  if (!email || !projectId || !isDatabaseConfigured()) return null;
  try {
    const uid = norm(email);
    const meta = await projectMeta(projectId);
    if (!meta) return null;
    if (meta.owner === uid) return { role: "owner", level: "owner" };
    if (meta.workspace_id) { const wm = await membershipFor(uid, meta.workspace_id); if (wm) return { role: wm.role, level: "workspace" }; }
    const pm = await projectMembershipFor(uid, projectId);
    if (pm) return { role: pm.role, level: "project" };
    return null;
  } catch { return null; }
}

export async function canManageProjectMembers(email: string, projectId: string): Promise<boolean> {
  const meta = await projectMeta(projectId);
  if (!meta) return false;
  const uid = norm(email);
  if (meta.owner === uid) return true;
  if (meta.workspace_id) { const wm = await membershipFor(uid, meta.workspace_id); if (canManageMembers(wm?.role ?? null)) return true; }
  return false;
}

export const canViewSharedProject = async (email: string, projectId: string) => (await getProjectAccessRole(email, projectId)) != null;

// Analytics visibility: any role with project access EXCEPT client_viewer may see
// aggregate (read-only) analytics for the project. Client viewers get reports only.
export async function canViewProjectAnalytics(email: string, projectId: string): Promise<boolean> {
  const a = await getProjectAccessRole(email, projectId);
  return a != null && a.role !== "client_viewer";
}
export async function isClientSafeOnly(email: string, projectId: string): Promise<boolean> {
  const a = await getProjectAccessRole(email, projectId);
  return a?.role === "client_viewer";
}

// ── Workspace switcher + workspace-scoped member dashboards ──
export type AvailableWorkspace = { id: string; name: string; role: Role; isPersonal: boolean; ownerId: string };
export type SelectedWorkspace = AvailableWorkspace & { isOwner: boolean; clientSafeOnly: boolean };
export const canViewWorkspaceDashboard = (role: Role) => role !== "client_viewer";
export const isWorkspaceClientSafeOnly = (role: Role) => role === "client_viewer";

// Workspaces the user can switch to: their personal (owned) workspace + every
// workspace they're an active member of.
export async function getAvailableWorkspaces(email: string): Promise<AvailableWorkspace[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const personal = await getOrCreatePersonalWorkspace(uid);
    const out: AvailableWorkspace[] = personal ? [{ id: personal.id, name: personal.name, role: "owner", isPersonal: true, ownerId: personal.owner_user_id }] : [];
    const { data: mem } = await s.from("v_workspace_members" as never).select("workspace_id,role").eq("email", uid).eq("status", "active");
    const rows = ((mem as unknown as { workspace_id: string; role: Role }[]) ?? []).filter((m) => m.workspace_id !== personal?.id);
    if (rows.length) {
      const { data: wss } = await s.from("v_workspaces" as never).select("id,name,owner_user_id").in("id", rows.map((r) => r.workspace_id));
      const roleById = Object.fromEntries(rows.map((r) => [r.workspace_id, r.role]));
      for (const w of (wss as unknown as { id: string; name: string; owner_user_id: string }[]) ?? []) {
        out.push({ id: w.id, name: w.name, role: roleById[w.id] ?? "viewer", isPersonal: false, ownerId: w.owner_user_id });
      }
    }
    return out;
  } catch { return []; }
}

// Resolve the active workspace from a (possibly stale/revoked) selected id. Falls
// back to the personal workspace gracefully if the selection is no longer valid.
export async function resolveWorkspaceSelection(email: string, selectedId?: string | null): Promise<{ available: AvailableWorkspace[]; selected: SelectedWorkspace | null }> {
  const available = await getAvailableWorkspaces(email);
  const uid = norm(email);
  const pick = available.find((w) => w.id === selectedId) ?? available.find((w) => w.isPersonal) ?? available[0] ?? null;
  const selected = pick ? { ...pick, isOwner: pick.ownerId === uid, clientSafeOnly: pick.role === "client_viewer" } : null;
  return { available, selected };
}

// Read-only team view of a SHARED workspace (selected in the switcher). Non-client
// members see the member list + project-access overview (read-only — no manage
// controls); client viewers see neither (reports only).
export async function sharedTeamView(selected: SelectedWorkspace): Promise<{ role: Role; clientSafe: boolean; members: Member[] | null; projects: ProjectAccessSummary[] }> {
  const clientSafe = selected.clientSafeOnly;
  const members = clientSafe ? null : await listMembers(selected.id);
  const projects = clientSafe ? [] : await workspaceProjectAccess(selected.id);
  return { role: selected.role, clientSafe, members, projects };
}

export type WorkspaceProjectSummary = { id: string; name: string; evaluations: number; active: number; completed: number; validJudgments: number };
export type WorkspaceSummary = { totals: { evaluations: number; active: number; completed: number; validJudgments: number }; projects: WorkspaceProjectSummary[]; clientSafe: boolean };

// Workspace-scoped project rollups (all projects in the workspace; owned by the
// workspace owner). Read-only aggregates — counts + valid judgments only.
export async function workspaceProjectSummaries(selected: SelectedWorkspace): Promise<WorkspaceSummary> {
  const empty: WorkspaceSummary = { totals: { evaluations: 0, active: 0, completed: 0, validJudgments: 0 }, projects: [], clientSafe: selected.clientSafeOnly };
  if (!isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const { data: projs } = await s.from("v_projects" as never).select("id,name").eq("workspace_id", selected.id).order("updated_at", { ascending: false }).limit(200);
    const projects = (projs as unknown as { id: string; name: string }[]) ?? [];
    if (!projects.length) return empty;
    const ids = projects.map((p) => p.id);
    // Scope by the workspace's projects (not the workspace owner id) so rollups stay
    // correct after an ownership transfer — evaluations keep their original creator.
    const { data: td } = await s.from("v_tests" as never).select("project_id,status,votes_valid,is_sandbox").in("project_id", ids).limit(3000);
    const tests = ((td as unknown as { project_id: string; status: string; votes_valid: number; is_sandbox?: boolean }[]) ?? []).filter((t) => !t.is_sandbox);
    const by: Record<string, WorkspaceProjectSummary> = {};
    for (const p of projects) by[p.id] = { id: p.id, name: p.name, evaluations: 0, active: 0, completed: 0, validJudgments: 0 };
    for (const t of tests) { const a = by[t.project_id]; if (!a) continue; a.evaluations++; if (t.status === "active") a.active++; if (t.status === "complete") a.completed++; a.validJudgments += t.votes_valid || 0; }
    const list = Object.values(by);
    const totals = list.reduce((acc, p) => ({ evaluations: acc.evaluations + p.evaluations, active: acc.active + p.active, completed: acc.completed + p.completed, validJudgments: acc.validJudgments + p.validJudgments }), { evaluations: 0, active: 0, completed: 0, validJudgments: 0 });
    return { totals, projects: list, clientSafe: selected.clientSafeOnly };
  } catch { return empty; }
}

export async function listProjectMembers(email: string, projectId: string): Promise<ProjectMember[]> {
  if (!(await canManageProjectMembers(email, projectId))) return [];
  try {
    const s = getSupabaseAdminClient();
    let q = await s.from("v_project_members" as never).select("id,project_id,user_id,email,role,status,created_at,invite_expires_at").eq("project_id", projectId).neq("status", "revoked").order("created_at", { ascending: true });
    if (q.error) q = await s.from("v_project_members" as never).select("id,project_id,user_id,email,role,status,created_at").eq("project_id", projectId).neq("status", "revoked").order("created_at", { ascending: true }); // pre-migration
    return (q.data as unknown as ProjectMember[]) ?? [];
  } catch { return []; }
}

export async function inviteProjectMember(actorEmail: string, projectId: string, inviteEmail: string, role: ProjectRole): Promise<{ ok: boolean; error?: string; email?: InviteDelivery }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const actor = norm(actorEmail);
  const invitee = norm(inviteEmail);
  if (!invitee.includes("@")) return { ok: false, error: "invalid_email" };
  if (!PROJECT_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  if (!(await canManageProjectMembers(actorEmail, projectId))) return { ok: false, error: "forbidden" };
  const meta = await projectMeta(projectId);
  if (meta && invitee === meta.owner) return { ok: false, error: "already_member" };
  if (!(await allow(`proj-invite:${projectId}`, 10, 3600))) return { ok: false, error: "rate_limited" };
  const s = getSupabaseAdminClient();
  const { data: inserted, error } = await s.from("v_project_members" as never).insert({ project_id: projectId, workspace_id: meta?.workspace_id ?? null, email: invitee, role, status: "pending", invited_by: actor } as never).select("id").single();
  if (error || !inserted) return { ok: false, error: String(error?.message || "").includes("duplicate") ? "already_member" : "failed" };
  await logEvent({ userId: actor, eventType: "project_member_invited", actorType: "owner", source: "app", metadata: { project_id: projectId, workspace_id: meta?.workspace_id ?? null, role } });
  const token = await mintInviteToken("v_project_members", (inserted as unknown as { id: string }).id);
  if (token) await logEvent({ userId: actor, eventType: "invite_token_created", actorType: "owner", source: "app", metadata: { invite_type: "project", project_id: projectId, workspace_id: meta?.workspace_id ?? null, role } });
  const email = await dispatchInvite(actor, { type: "project", to: invitee, projectName: meta?.name, role, acceptUrl: inviteAcceptUrl(token, "/app/shared/projects/" + projectId), project_id: projectId, workspace_id: meta?.workspace_id ?? null });
  return { ok: true, email };
}

// Resend the invite email for a PENDING workspace invite (owner/admin only).
export async function resendWorkspaceInvite(actorEmail: string, memberId: string): Promise<{ ok: boolean; error?: string; email?: InviteDelivery }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const actor = norm(actorEmail);
  const { data } = await s.from("v_workspace_members" as never).select("id,workspace_id,email,role,status").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; workspace_id: string; email: string; role: Role; status: string } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (m.status !== "pending") return { ok: false, error: "not_pending" };
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id,name").eq("id", m.workspace_id).maybeSingle();
  const wsRow = ws as unknown as { owner_user_id: string; name: string } | null;
  if (wsRow?.owner_user_id !== actor && !canManageMembers((await membershipFor(actor, m.workspace_id))?.role ?? null)) return { ok: false, error: "forbidden" };
  if (!(await allow(`invite-resend:${memberId}`, 5, 3600))) { await logEvent({ userId: actor, eventType: "invite_resend_rate_limited", actorType: "owner", source: "app", metadata: { invite_type: "workspace", workspace_id: m.workspace_id, role: m.role } }); return { ok: false, error: "rate_limited" }; }
  await logEvent({ userId: actor, eventType: "workspace_invite_resent", actorType: "owner", source: "app", metadata: { workspace_id: m.workspace_id, role: m.role } });
  const token = await mintInviteToken("v_workspace_members", memberId); // new token + extended expiry
  if (token) await logEvent({ userId: actor, eventType: "invite_token_created", actorType: "owner", source: "app", metadata: { invite_type: "workspace", workspace_id: m.workspace_id, role: m.role } });
  const email = await dispatchInvite(actor, { type: "workspace", to: m.email, workspaceName: wsRow?.name, role: m.role, acceptUrl: inviteAcceptUrl(token, "/app/team"), workspace_id: m.workspace_id });
  return { ok: true, email };
}

// Resend the invite email for a PENDING project invite (manager only).
export async function resendProjectInvite(actorEmail: string, memberId: string): Promise<{ ok: boolean; error?: string; email?: InviteDelivery }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const actor = norm(actorEmail);
  const { data } = await s.from("v_project_members" as never).select("id,project_id,email,role,status").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; project_id: string; email: string; role: ProjectRole; status: string } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (m.status !== "pending") return { ok: false, error: "not_pending" };
  if (!(await canManageProjectMembers(actor, m.project_id))) return { ok: false, error: "forbidden" };
  const meta = await projectMeta(m.project_id);
  if (!(await allow(`invite-resend:${memberId}`, 5, 3600))) { await logEvent({ userId: actor, eventType: "invite_resend_rate_limited", actorType: "owner", source: "app", metadata: { invite_type: "project", project_id: m.project_id, role: m.role } }); return { ok: false, error: "rate_limited" }; }
  await logEvent({ userId: actor, eventType: "project_invite_resent", actorType: "owner", source: "app", metadata: { project_id: m.project_id, workspace_id: meta?.workspace_id ?? null, role: m.role } });
  const token = await mintInviteToken("v_project_members", memberId);
  if (token) await logEvent({ userId: actor, eventType: "invite_token_created", actorType: "owner", source: "app", metadata: { invite_type: "project", project_id: m.project_id, workspace_id: meta?.workspace_id ?? null, role: m.role } });
  const email = await dispatchInvite(actor, { type: "project", to: m.email, projectName: meta?.name, role: m.role, acceptUrl: inviteAcceptUrl(token, "/app/shared/projects/" + m.project_id), project_id: m.project_id, workspace_id: meta?.workspace_id ?? null });
  return { ok: true, email };
}

export async function changeProjectMemberRole(actorEmail: string, memberId: string, role: ProjectRole): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  if (!PROJECT_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_project_members" as never).select("id,project_id").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; project_id: string } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (!(await canManageProjectMembers(actorEmail, m.project_id))) return { ok: false, error: "forbidden" };
  await s.from("v_project_members" as never).update({ role, updated_at: new Date().toISOString() } as never).eq("id", memberId);
  await logEvent({ userId: norm(actorEmail), eventType: "project_member_role_changed", actorType: "owner", source: "app", metadata: { project_id: m.project_id, role } });
  return { ok: true };
}

export async function revokeProjectMember(actorEmail: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_project_members" as never).select("id,project_id").eq("id", memberId).maybeSingle();
  const m = data as unknown as { id: string; project_id: string } | null;
  if (!m) return { ok: false, error: "not_found" };
  if (!(await canManageProjectMembers(actorEmail, m.project_id))) return { ok: false, error: "forbidden" };
  await s.from("v_project_members" as never).update({ status: "revoked", updated_at: new Date().toISOString() } as never).eq("id", memberId);
  await logEvent({ userId: norm(actorEmail), eventType: "project_member_revoked", actorType: "owner", source: "app", metadata: { project_id: m.project_id } });
  return { ok: true };
}

export async function activateProjectInvitesForEmail(email: string): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data } = await s.from("v_project_members" as never).update({ user_id: uid, status: "active", updated_at: new Date().toISOString() } as never).eq("email", uid).eq("status", "pending").select("project_id");
    for (const r of (data as unknown as { project_id: string }[]) ?? []) {
      await logEvent({ userId: uid, eventType: "project_member_activated", actorType: "owner", source: "app", metadata: { project_id: r.project_id } });
    }
  } catch { /* pre-migration / ignore */ }
}

// Completed evaluations in a project (titles + status only — for client-ready links).
async function projectEvaluations(projectId: string): Promise<{ test_id: string; title: string; status: string }[]> {
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_tests" as never).select("id,title,status,is_sandbox").eq("project_id", projectId).limit(200);
    return ((data as unknown as { id: string; title: string; status: string; is_sandbox?: boolean }[]) ?? []).filter((t) => !t.is_sandbox).map((t) => ({ test_id: t.id, title: t.title, status: t.status }));
  } catch { return []; }
}

// Project-level shares for a user who is NOT already a workspace member of that
// project's workspace (so /app/team can distinguish workspace vs project access).
async function sharedProjectsForEmail(email: string): Promise<SharedProject[]> {
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data: pm } = await s.from("v_project_members" as never).select("project_id,workspace_id,role").eq("email", uid).eq("status", "active");
    const rows = (pm as unknown as { project_id: string; workspace_id: string | null; role: ProjectRole }[]) ?? [];
    if (!rows.length) return [];
    const out: SharedProject[] = [];
    const wsNameCache: Record<string, string> = {};
    for (const r of rows) {
      // skip if the user already has workspace-wide access (shown under shared workspaces)
      if (r.workspace_id) { const wm = await membershipFor(uid, r.workspace_id); if (wm) continue; }
      const meta = await projectMeta(r.project_id);
      if (!meta) continue;
      let wsName = "Workspace";
      if (meta.workspace_id) {
        if (!(meta.workspace_id in wsNameCache)) { const { data: w } = await s.from("v_workspaces" as never).select("name").eq("id", meta.workspace_id).maybeSingle(); wsNameCache[meta.workspace_id] = (w as unknown as { name: string } | null)?.name ?? "Workspace"; }
        wsName = wsNameCache[meta.workspace_id];
      }
      out.push({ project_id: r.project_id, name: meta.name, workspace_name: wsName, role: r.role, evaluations: await projectEvaluations(r.project_id) });
    }
    return out;
  } catch { return []; }
}

// Client-safe per-evaluation summary (recommendation/confidence/margin/signal) —
// derived, no private internals (no sources, screening, IPs, or owner controls).
export type SharedEval = { test_id: string; title: string; status: string; recommended: string | null; confidence: string | null; margin: number | null; signal: string | null };
async function projectSharedEvals(projectId: string): Promise<SharedEval[]> {
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_tests" as never).select("id,title,status,votes_target,is_sandbox").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200);
    const rows = ((data as unknown as { id: string; title: string; status: string; votes_target: number; is_sandbox?: boolean }[]) ?? []).filter((t) => !t.is_sandbox);
    const out: SharedEval[] = [];
    for (const t of rows) {
      if (t.status !== "complete") { out.push({ test_id: t.id, title: t.title, status: t.status, recommended: null, confidence: null, margin: null, signal: null }); continue; }
      const rep = await getReport(t.id);
      if (!rep) { out.push({ test_id: t.id, title: t.title, status: t.status, recommended: null, confidence: null, margin: null, signal: null }); continue; }
      const intel = evaluationIntelligence(rep.results, t.votes_target);
      out.push({ test_id: t.id, title: t.title, status: t.status, recommended: intel.recommendedOption ? `Option ${intel.recommendedOption}` : null, confidence: intel.confidenceLabel === "None" ? null : intel.confidenceLabel, margin: intel.marginPts, signal: intel.signalLabel });
    }
    return out;
  } catch { return []; }
}

// The shared-project view. Client viewers get the client-safe report list only;
// editor/viewer/admin/owner additionally get read-only aggregate analytics (decision
// quality, signal quality, source quality) — computed via the project OWNER's id so
// it reuses the verified analytics aggregation, gated by the access check above.
export type SharedProjectView = {
  project: { id: string; name: string; description: string | null };
  role: Role; level: "owner" | "workspace" | "project";
  evaluations: SharedEval[];
  analytics: Awaited<ReturnType<typeof projectAnalytics>> | null;
  sources: Awaited<ReturnType<typeof projectSourceQuality>> | null;
};
export async function sharedProjectView(email: string, projectId: string): Promise<SharedProjectView | null> {
  const access = await getProjectAccessRole(email, projectId);
  if (!access) return null;
  const meta = await projectMeta(projectId);
  if (!meta) return null;
  const showAnalytics = access.role !== "client_viewer";
  const [evaluations, analytics, sources] = await Promise.all([
    projectSharedEvals(projectId),
    showAnalytics ? projectAnalytics(meta.owner, projectId) : Promise.resolve(null),
    showAnalytics ? projectSourceQuality(meta.owner, projectId) : Promise.resolve(null),
  ]);
  return { project: { id: projectId, name: meta.name, description: meta.description }, role: access.role, level: access.level, evaluations, analytics, sources };
}

// ── Tokenized invite acceptance ──
type InviteLookup = { table: "v_workspace_members" | "v_project_members"; type: "workspace" | "project"; id: string; email: string; role: Role; status: string; expires: string | null; workspace_id?: string | null; project_id?: string | null; contextName: string; redirect: string };

async function lookupInviteByToken(token: string): Promise<InviteLookup | null> {
  try {
    const s = getSupabaseAdminClient();
    const hash = hashToken(token);
    const { data: wm } = await s.from("v_workspace_members" as never).select("id,workspace_id,email,role,status,invite_expires_at").eq("invite_token_hash", hash).maybeSingle();
    const w = wm as unknown as { id: string; workspace_id: string; email: string; role: Role; status: string; invite_expires_at: string | null } | null;
    if (w) {
      const { data: ws } = await s.from("v_workspaces" as never).select("name").eq("id", w.workspace_id).maybeSingle();
      return { table: "v_workspace_members", type: "workspace", id: w.id, email: w.email, role: w.role, status: w.status, expires: w.invite_expires_at, workspace_id: w.workspace_id, contextName: (ws as unknown as { name: string } | null)?.name ?? "this workspace", redirect: "/app/team" };
    }
    const { data: pm } = await s.from("v_project_members" as never).select("id,project_id,workspace_id,email,role,status,invite_expires_at").eq("invite_token_hash", hash).maybeSingle();
    const p = pm as unknown as { id: string; project_id: string; workspace_id: string | null; email: string; role: Role; status: string; invite_expires_at: string | null } | null;
    if (p) {
      const meta = await projectMeta(p.project_id);
      return { table: "v_project_members", type: "project", id: p.id, email: p.email, role: p.role, status: p.status, expires: p.invite_expires_at, project_id: p.project_id, workspace_id: p.workspace_id, contextName: meta?.name ?? "this project", redirect: `/app/shared/projects/${p.project_id}` };
    }
    return null;
  } catch { return null; }
}

export type InviteAcceptState =
  | { state: "not_found" }
  | { state: "rate_limited" }
  | { state: "revoked" | "expired"; type: "workspace" | "project"; contextName: string; role: Role }
  | { state: "signed_out" | "wrong_email"; type: "workspace" | "project"; contextName: string; role: Role; invitedEmail: string }
  | { state: "already" | "accepted"; type?: "workspace" | "project"; contextName?: string; role?: Role; redirect: string };

// Resolve (and, when valid + matching, ACTIVATE) a tokenized invite. Never exposes
// the token; logs safe outcomes only.
export async function resolveInviteForAccept(email: string | null, token: string): Promise<InviteAcceptState> {
  if (!token || !isDatabaseConfigured()) return { state: "not_found" };
  if (!(await allow(`invite-accept:${hashToken(token).slice(0, 16)}`, 20, 3600))) return { state: "rate_limited" };
  const inv = await lookupInviteByToken(token);
  const uid = email ? norm(email) : undefined;
  const logFail = (reason: string) => logEvent({ userId: uid, eventType: "invite_accept_failed", actorType: "owner", source: "app", metadata: { invite_type: inv?.type ?? null, workspace_id: inv?.workspace_id ?? null, project_id: inv?.project_id ?? null, role: inv?.role ?? null, reason } });
  if (!inv) { await logFail("not_found"); return { state: "not_found" }; }
  if (inv.status === "revoked") { await logFail("revoked"); return { state: "revoked", type: inv.type, contextName: inv.contextName, role: inv.role }; }
  if (inv.status === "active") return { state: "already", redirect: inv.redirect, type: inv.type, contextName: inv.contextName, role: inv.role };
  if (inv.expires && new Date(inv.expires).getTime() < Date.now()) {
    await logEvent({ userId: uid, eventType: "invite_expired", actorType: "owner", source: "app", metadata: { invite_type: inv.type, workspace_id: inv.workspace_id ?? null, project_id: inv.project_id ?? null, role: inv.role } });
    await logFail("expired");
    return { state: "expired", type: inv.type, contextName: inv.contextName, role: inv.role };
  }
  if (!email) return { state: "signed_out", type: inv.type, contextName: inv.contextName, role: inv.role, invitedEmail: inv.email };
  if (norm(email) !== inv.email) { await logFail("wrong_email"); return { state: "wrong_email", type: inv.type, contextName: inv.contextName, role: inv.role, invitedEmail: inv.email }; }
  const s = getSupabaseAdminClient();
  await s.from(inv.table as never).update({ status: "active", user_id: norm(email), invite_accepted_at: new Date().toISOString() } as never).eq("id", inv.id);
  await logEvent({ userId: norm(email), eventType: "invite_accepted", actorType: "owner", source: "app", metadata: { invite_type: inv.type, workspace_id: inv.workspace_id ?? null, project_id: inv.project_id ?? null, role: inv.role } });
  return { state: "accepted", type: inv.type, contextName: inv.contextName, role: inv.role, redirect: inv.redirect };
}

// ── Workspace ownership transfer (v1) ──
// Transfers who MANAGES a workspace (members/billing visibility/transfer). Does NOT
// move Stripe billing ownership or re-own evaluations (they keep their creator).
// Blocked while a team-seat subscription is active (billing ownership transfer is later).
export const TRANSFERABLE_ROLES: Role[] = ["admin", "editor", "viewer"];
export type TransferTarget = { id: string; email: string; role: Role };

export async function eligibleOwnershipTransferTargets(ownerEmail: string, workspaceId: string): Promise<TransferTarget[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(ownerEmail);
    const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id").eq("id", workspaceId).maybeSingle();
    if ((ws as unknown as { owner_user_id: string } | null)?.owner_user_id !== uid) return []; // owner-only
    const { data } = await s.from("v_workspace_members" as never).select("id,email,role,status,user_id").eq("workspace_id", workspaceId).eq("status", "active").in("role", TRANSFERABLE_ROLES as unknown as string[]);
    return ((data as unknown as { id: string; email: string; role: Role; status: string; user_id: string | null }[]) ?? [])
      .filter((m) => m.user_id && norm(m.email) !== uid)
      .map((m) => ({ id: m.id, email: m.email, role: m.role }));
  } catch { return []; }
}

export async function canTransferWorkspaceOwnership(ownerEmail: string, workspaceId: string): Promise<{ ok: boolean; blocked: boolean; reason?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, blocked: false, reason: "unavailable" };
  const s = getSupabaseAdminClient();
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id").eq("id", workspaceId).maybeSingle();
  if ((ws as unknown as { owner_user_id: string } | null)?.owner_user_id !== norm(ownerEmail)) return { ok: false, blocked: false, reason: "not_owner" };
  if (await hasActiveTeamBillingForTransferGuard(workspaceId)) return { ok: false, blocked: true, reason: "billing_active" };
  return { ok: true, blocked: false };
}

export async function transferWorkspaceOwnership(ownerEmail: string, workspaceId: string, targetMemberId: string, confirmation: string): Promise<{ ok: boolean; error?: string; workspace_id?: string; old_role?: string; new_role?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const uid = norm(ownerEmail);
  const { data: wsd } = await s.from("v_workspaces" as never).select("owner_user_id,name").eq("id", workspaceId).maybeSingle();
  const ws = wsd as unknown as { owner_user_id: string; name: string } | null;
  if (!ws) return { ok: false, error: "not_found" };
  if (ws.owner_user_id !== uid) return { ok: false, error: "forbidden" };
  if (String(confirmation || "").trim() !== (ws.name || "").trim()) return { ok: false, error: "confirmation_mismatch" };
  // Team-billing guardrail (block while a seat subscription is live).
  if (await hasActiveTeamBillingForTransferGuard(workspaceId)) {
    await logEvent({ userId: uid, eventType: "workspace_ownership_transfer_blocked", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, action: "transfer", reason: "billing_active" } });
    return { ok: false, error: "billing_active" };
  }
  // Target validation: active internal member with a real user_id, not client_viewer/owner/self.
  const { data: tmd } = await s.from("v_workspace_members" as never).select("id,email,role,status,user_id").eq("id", targetMemberId).eq("workspace_id", workspaceId).maybeSingle();
  const t = tmd as unknown as { id: string; email: string; role: Role; status: string; user_id: string | null } | null;
  if (!t) return { ok: false, error: "target_not_found" };
  if (t.status !== "active") return { ok: false, error: "target_inactive" };
  if (!t.user_id) return { ok: false, error: "target_no_user" };
  if (!TRANSFERABLE_ROLES.includes(t.role)) return { ok: false, error: "target_not_eligible" }; // excludes client_viewer + owner
  if (norm(t.email) === uid) return { ok: false, error: "same_owner" };
  const ts = new Date().toISOString();
  // Ordered updates (supabase-js has no cross-statement txn): set the new owner, demote
  // the old owner, then flip workspace authority last; verify a single active owner.
  const r1 = await s.from("v_workspace_members" as never).update({ role: "owner", user_id: t.user_id, updated_at: ts } as never).eq("id", t.id);
  if (r1.error) return { ok: false, error: "failed" };
  await s.from("v_workspace_members" as never).update({ role: "admin", updated_at: ts } as never).eq("workspace_id", workspaceId).eq("email", uid).eq("role", "owner");
  const r3 = await s.from("v_workspaces" as never).update({ owner_user_id: t.user_id, updated_at: ts } as never).eq("id", workspaceId);
  if (r3.error) return { ok: false, error: "failed" };
  // Guard against duplicate active owners — keep the target, demote any others.
  const { data: owners } = await s.from("v_workspace_members" as never).select("id").eq("workspace_id", workspaceId).eq("status", "active").eq("role", "owner");
  for (const o of ((owners as unknown as { id: string }[]) ?? [])) if (o.id !== t.id) await s.from("v_workspace_members" as never).update({ role: "admin" } as never).eq("id", o.id);
  await logEvent({ userId: uid, eventType: "workspace_ownership_transferred", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, action: "transfer", old_role: "admin", new_role: "owner" } });
  return { ok: true, workspace_id: workspaceId, old_role: "admin", new_role: "owner" };
}

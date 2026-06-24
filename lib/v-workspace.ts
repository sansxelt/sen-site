// Team workspaces + client seats (v1). A workspace groups a team's projects/
// evaluations; every user lazily gets a personal workspace they own. Members are
// invited by email and activated when that email signs in. Roles gate access here
// (centralized permission helpers) — NO billing/credit/API/schema behavior change.
// Tolerant of the tables being absent (pre-migration) — degrades to "just you".

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();

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
export type Member = { id: string; workspace_id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string };
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
    const { data } = await s.from("v_workspace_members" as never).select("id,workspace_id,user_id,email,role,status,created_at").eq("workspace_id", workspaceId).neq("status", "revoked").order("created_at", { ascending: true });
    return (data as unknown as Member[]) ?? [];
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

export type WorkspaceContext = { workspace: Workspace | null; myRole: Role; members: Member[]; shared: SharedWorkspace[] };

export async function getWorkspaceContext(email: string): Promise<WorkspaceContext> {
  await activateInvitesForEmail(email);
  const workspace = await getOrCreatePersonalWorkspace(email);
  const members = workspace ? await listMembers(workspace.id) : [];
  const shared = await sharedWorkspaces(email, workspace?.id ?? null);
  return { workspace, myRole: "owner", members, shared };
}

// ── Member management (owner/admin only) ──
export async function inviteMember(actorEmail: string, workspaceId: string, inviteEmail: string, role: Role): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const actor = norm(actorEmail);
  const invitee = norm(inviteEmail);
  if (!invitee || !invitee.includes("@")) return { ok: false, error: "invalid_email" };
  if (!INVITABLE_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  const s = getSupabaseAdminClient();
  // actor must own or admin the workspace
  const { data: ws } = await s.from("v_workspaces" as never).select("owner_user_id").eq("id", workspaceId).maybeSingle();
  const ownerId = (ws as unknown as { owner_user_id: string } | null)?.owner_user_id;
  const actorMember = await membershipFor(actor, workspaceId);
  if (ownerId !== actor && !canManageMembers(actorMember?.role ?? null)) return { ok: false, error: "forbidden" };
  if (invitee === ownerId) return { ok: false, error: "already_member" };
  const { error } = await s.from("v_workspace_members" as never).insert({ workspace_id: workspaceId, email: invitee, role, status: "pending", invited_by: actor } as never);
  if (error) {
    if (String(error.message || "").includes("duplicate")) return { ok: false, error: "already_member" };
    return { ok: false, error: "failed" };
  }
  await logEvent({ userId: actor, eventType: "workspace_member_invited", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, role } });
  return { ok: true };
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
    if (!test.project_id) return null; // no workspace linkage → owner only
    const { data: p } = await s.from("v_projects" as never).select("workspace_id").eq("id", test.project_id).maybeSingle();
    const wsId = (p as unknown as { workspace_id: string | null } | null)?.workspace_id;
    if (!wsId) return null;
    const m = await membershipFor(uid, wsId);
    return m ? m.role : null;
  } catch { return null; }
}

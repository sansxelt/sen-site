// Organization / account layer (enterprise foundation, v1). A thin layer ABOVE workspaces:
// larger teams can govern multiple workspaces, domains, members, and billing admins from
// one account. OPTIONAL — existing workspace-only users keep working with no org. This is
// the foundation SSO / SCIM / domain auto-provisioning will sit on later (NOT implemented).
//
// Conventions match lib/v-workspace.ts exactly: service-role admin client, lowercased-email
// user ids, graceful degradation when the v_organization* tables are absent (pre-migration),
// and server-side permission checks (no RLS). All writes re-validate permissions server-side.

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();

export type OrgRole = "owner" | "admin" | "billing_admin" | "member" | "viewer";
export const ORG_ROLES: OrgRole[] = ["owner", "admin", "billing_admin", "member", "viewer"];
export const ORG_INVITABLE_ROLES: OrgRole[] = ["admin", "billing_admin", "member", "viewer"];
export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Organization admin",
  billing_admin: "Account billing admin",
  member: "Member",
  viewer: "Viewer",
};
export const ORG_ROLE_DESC: Record<OrgRole, string> = {
  owner: "Full account control. Manages organization members, domains, and workspace links.",
  admin: "Manage organization members, domains, and workspace links. No ownership transfer.",
  billing_admin: "View account-level billing context. Cannot open a workspace's payment portal without workspace billing permission.",
  member: "Belongs to the organization. Read-only on governance surfaces.",
  viewer: "Read-only on organization overview.",
};

export type Organization = { id: string; name: string; owner_user_id: string; created_at: string };
export type OrgMember = { id: string; organization_id: string; user_id: string | null; email: string; role: OrgRole; status: "pending" | "active" | "revoked"; can_manage_billing: boolean; created_at: string };
export type OrgDomain = { id: string; organization_id: string; domain: string; status: "unverified" | "verified" | "rejected"; verified_at: string | null; created_at: string };
export type LinkableWorkspace = { id: string; name: string; organization_id: string | null };
export type OrgContext = {
  organization: Organization | null;
  myRole: OrgRole | null;
  canManage: boolean;
  isBillingAdmin: boolean;
  members: OrgMember[];
  domains: OrgDomain[];
  linkedWorkspaces: { id: string; name: string }[];
  linkableWorkspaces: { id: string; name: string }[];
};

// ── Reads ──────────────────────────────────────────────────────────────────

async function getOrganizationById(orgId: string): Promise<Organization | null> {
  if (!orgId || !isDatabaseConfigured()) return null;
  try {
    const { data } = await getSupabaseAdminClient().from("v_organizations" as never).select("id,name,owner_user_id,created_at").eq("id", orgId).maybeSingle();
    return (data as unknown as Organization | null) ?? null;
  } catch { return null; }
}

// The user's primary org: one they OWN (oldest first), else their first active membership.
export async function getPrimaryOrganization(email: string): Promise<Organization | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data: owned } = await s.from("v_organizations" as never).select("id,name,owner_user_id,created_at").eq("owner_user_id", uid).order("created_at", { ascending: true }).limit(1);
    const o = ((owned as unknown as Organization[]) ?? [])[0];
    if (o) return o;
    const { data: mem } = await s.from("v_organization_members" as never).select("organization_id").eq("email", uid).eq("status", "active").order("created_at", { ascending: true }).limit(1);
    const m = ((mem as unknown as { organization_id: string }[]) ?? [])[0];
    return m ? await getOrganizationById(m.organization_id) : null;
  } catch { return null; }
}

async function orgMembershipFor(email: string, orgId: string): Promise<OrgMember | null> {
  if (!email || !orgId || !isDatabaseConfigured()) return null;
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_members" as never).select("id,organization_id,user_id,email,role,status,can_manage_billing,created_at").eq("organization_id", orgId).eq("email", norm(email)).maybeSingle();
    const m = data as unknown as OrgMember | null;
    return m && m.status === "active" ? m : null;
  } catch { return null; }
}

async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_members" as never).select("id,organization_id,user_id,email,role,status,can_manage_billing,created_at").eq("organization_id", orgId).neq("status", "revoked").order("created_at", { ascending: true });
    return (data as unknown as OrgMember[]) ?? [];
  } catch { return []; }
}

async function listOrgDomains(orgId: string): Promise<OrgDomain[]> {
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_domains" as never).select("id,organization_id,domain,status,verified_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: true });
    return (data as unknown as OrgDomain[]) ?? [];
  } catch { return []; }
}

// Workspaces the user OWNS, with their current org link (for "link to org" + overview).
async function ownedWorkspaces(email: string): Promise<LinkableWorkspace[]> {
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_workspaces" as never).select("id,name,organization_id").eq("owner_user_id", norm(email)).order("created_at", { ascending: true });
    if (error) return []; // organization_id column absent (pre-migration)
    return (data as unknown as LinkableWorkspace[]) ?? [];
  } catch { return []; }
}

async function linkedWorkspaces(orgId: string): Promise<{ id: string; name: string }[]> {
  try {
    const { data } = await getSupabaseAdminClient().from("v_workspaces" as never).select("id,name").eq("organization_id", orgId).order("created_at", { ascending: true });
    return (data as unknown as { id: string; name: string }[]) ?? [];
  } catch { return []; }
}

// ── Role resolution ──────────────────────────────────────────────────────────

async function myOrgRole(email: string, org: Organization): Promise<OrgRole | null> {
  if (org.owner_user_id === norm(email)) return "owner";
  const m = await orgMembershipFor(email, org.id);
  return m?.role ?? null;
}

export async function canViewOrganization(email: string, orgId: string): Promise<boolean> {
  const org = await getOrganizationById(orgId);
  if (!org) return false;
  return (await myOrgRole(email, org)) != null;
}

export async function canManageOrganization(email: string, orgId: string): Promise<boolean> {
  const org = await getOrganizationById(orgId);
  if (!org) return false;
  const r = await myOrgRole(email, org);
  return r === "owner" || r === "admin";
}

export const canManageOrganizationMembers = canManageOrganization;
export const canManageOrganizationDomains = canManageOrganization;
export const canViewOrganizationAudit = canManageOrganization;

// Org-level billing admin: limited. Does NOT grant a workspace's Stripe portal — that still
// requires workspace owner / workspace billing-admin permission, enforced separately.
export async function isOrganizationBillingAdmin(email: string, orgId: string): Promise<boolean> {
  const org = await getOrganizationById(orgId);
  if (!org) return false;
  if (org.owner_user_id === norm(email)) return true;
  const m = await orgMembershipFor(email, orgId);
  return !!m && (m.role === "billing_admin" || m.can_manage_billing === true);
}

// Only a user who OWNS the workspace AND manages the org can link it. client_viewer and
// project-only members never own a workspace, so they can never link.
export async function canLinkWorkspaceToOrganization(email: string, orgId: string, workspaceId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { data } = await getSupabaseAdminClient().from("v_workspaces" as never).select("owner_user_id").eq("id", workspaceId).maybeSingle();
    const ws = data as unknown as { owner_user_id: string } | null;
    if (!ws || ws.owner_user_id !== norm(email)) return false;
    return await canManageOrganization(email, orgId);
  } catch { return false; }
}

// ── Full context for /app/organization ───────────────────────────────────────

export async function getOrganizationContext(email: string): Promise<OrgContext> {
  const empty: OrgContext = { organization: null, myRole: null, canManage: false, isBillingAdmin: false, members: [], domains: [], linkedWorkspaces: [], linkableWorkspaces: [] };
  if (!email || !isDatabaseConfigured()) return empty;
  const owned = await ownedWorkspaces(email);
  const org = await getPrimaryOrganization(email);
  if (!org) return { ...empty, linkableWorkspaces: owned.filter((w) => !w.organization_id).map((w) => ({ id: w.id, name: w.name })) };
  const [role, members, domains, linked] = await Promise.all([myOrgRole(email, org), listOrgMembers(org.id), listOrgDomains(org.id), linkedWorkspaces(org.id)]);
  const canManage = role === "owner" || role === "admin";
  return {
    organization: org,
    myRole: role,
    canManage,
    isBillingAdmin: role === "owner" || role === "billing_admin" || (members.find((m) => m.email === norm(email))?.can_manage_billing ?? false),
    members,
    domains,
    linkedWorkspaces: linked,
    linkableWorkspaces: canManage ? owned.filter((w) => !w.organization_id).map((w) => ({ id: w.id, name: w.name })) : [],
  };
}

// The org a workspace is linked to (for the Team page "Organization" card). Safe fields only.
export async function workspaceOrganizationLink(workspaceId: string): Promise<{ id: string; name: string } | null> {
  if (!workspaceId || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_workspaces" as never).select("organization_id").eq("id", workspaceId).maybeSingle();
    if (error) return null; // column absent (pre-migration)
    const orgId = (data as unknown as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return null;
    const org = await getOrganizationById(orgId);
    return org ? { id: org.id, name: org.name } : null;
  } catch { return null; }
}

// ── Writes (each re-validates permission server-side) ─────────────────────────

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

export async function createOrganization(email: string, nameRaw: string): Promise<Result<{ organization: Organization }>> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const uid = norm(email);
  const name = (nameRaw || "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "name_required" };
  try {
    const s = getSupabaseAdminClient();
    // One owned org per user in v1 — keep it simple and avoid duplicates.
    const existing = await getPrimaryOrganization(email);
    if (existing && existing.owner_user_id === uid) return { ok: false, error: "already_exists" };
    const { data, error } = await s.from("v_organizations" as never).insert({ name, owner_user_id: uid } as never).select("id,name,owner_user_id,created_at").single();
    if (error || !data) return { ok: false, error: String(error?.message || "").includes("duplicate") ? "already_exists" : "create_failed" };
    const org = data as unknown as Organization;
    await s.from("v_organization_members" as never).insert({ organization_id: org.id, user_id: uid, email: uid, role: "owner", status: "active", can_manage_billing: true, invited_by: uid } as never);
    await logEvent({ userId: uid, eventType: "organization_created", actorType: "owner", source: "app", metadata: { organization_id: org.id } });
    return { ok: true, organization: org };
  } catch { return { ok: false, error: "create_failed" }; }
}

export async function addOrganizationMember(actorEmail: string, email: string, role: OrgRole): Promise<Result> {
  const org = await getPrimaryOrganization(actorEmail);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationMembers(actorEmail, org.id))) return { ok: false, error: "forbidden" };
  if (!ORG_INVITABLE_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  const target = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return { ok: false, error: "invalid_email" };
  if (target === org.owner_user_id) return { ok: false, error: "already_member" };
  try {
    const s = getSupabaseAdminClient();
    const { error } = await s.from("v_organization_members" as never).insert({ organization_id: org.id, email: target, role, status: "active", can_manage_billing: role === "billing_admin", invited_by: norm(actorEmail) } as never);
    if (error) return { ok: false, error: String(error.message || "").includes("duplicate") ? "already_member" : "add_failed" };
    await logEvent({ userId: norm(actorEmail), eventType: "organization_member_added", actorType: "owner", source: "app", metadata: { organization_id: org.id, role } });
    return { ok: true };
  } catch { return { ok: false, error: "add_failed" }; }
}

export async function setOrganizationMemberRole(actorEmail: string, memberId: string, role: OrgRole): Promise<Result> {
  const org = await getPrimaryOrganization(actorEmail);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationMembers(actorEmail, org.id))) return { ok: false, error: "forbidden" };
  if (!ORG_INVITABLE_ROLES.includes(role)) return { ok: false, error: "invalid_role" };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_organization_members" as never).select("id,role,email").eq("id", memberId).eq("organization_id", org.id).maybeSingle();
    const m = data as unknown as { id: string; role: OrgRole; email: string } | null;
    if (!m) return { ok: false, error: "not_found" };
    if (m.role === "owner") return { ok: false, error: "cannot_change_owner" };
    const { error } = await s.from("v_organization_members" as never).update({ role, can_manage_billing: role === "billing_admin", updated_at: new Date().toISOString() } as never).eq("id", memberId).eq("organization_id", org.id);
    if (error) return { ok: false, error: "update_failed" };
    await logEvent({ userId: norm(actorEmail), eventType: "organization_member_role_changed", actorType: "owner", source: "app", metadata: { organization_id: org.id, role } });
    return { ok: true };
  } catch { return { ok: false, error: "update_failed" }; }
}

export async function revokeOrganizationMember(actorEmail: string, memberId: string): Promise<Result> {
  const org = await getPrimaryOrganization(actorEmail);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationMembers(actorEmail, org.id))) return { ok: false, error: "forbidden" };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_organization_members" as never).select("id,role").eq("id", memberId).eq("organization_id", org.id).maybeSingle();
    const m = data as unknown as { id: string; role: OrgRole } | null;
    if (!m) return { ok: false, error: "not_found" };
    if (m.role === "owner") return { ok: false, error: "cannot_revoke_owner" };
    const { error } = await s.from("v_organization_members" as never).update({ status: "revoked", updated_at: new Date().toISOString() } as never).eq("id", memberId).eq("organization_id", org.id);
    if (error) return { ok: false, error: "revoke_failed" };
    await logEvent({ userId: norm(actorEmail), eventType: "organization_member_revoked", actorType: "owner", source: "app", metadata: { organization_id: org.id } });
    return { ok: true };
  } catch { return { ok: false, error: "revoke_failed" }; }
}

export async function linkWorkspaceToOrganization(email: string, workspaceId: string): Promise<Result> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!workspaceId) return { ok: false, error: "no_workspace" };
  if (!(await canLinkWorkspaceToOrganization(email, org.id, workspaceId))) return { ok: false, error: "forbidden" };
  try {
    const s = getSupabaseAdminClient();
    // Double-guard: only update a workspace this user actually owns.
    const { error } = await s.from("v_workspaces" as never).update({ organization_id: org.id, updated_at: new Date().toISOString() } as never).eq("id", workspaceId).eq("owner_user_id", norm(email));
    if (error) return { ok: false, error: "link_failed" };
    await logEvent({ userId: norm(email), eventType: "workspace_linked_to_organization", actorType: "owner", source: "app", metadata: { organization_id: org.id, workspace_id: workspaceId } });
    return { ok: true };
  } catch { return { ok: false, error: "link_failed" }; }
}

export async function unlinkWorkspaceFromOrganization(email: string, workspaceId: string): Promise<Result> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  if (!workspaceId) return { ok: false, error: "no_workspace" };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_workspaces" as never).select("owner_user_id,organization_id").eq("id", workspaceId).maybeSingle();
    const ws = data as unknown as { owner_user_id: string; organization_id: string | null } | null;
    if (!ws || ws.owner_user_id !== norm(email)) return { ok: false, error: "forbidden" }; // workspace owner only
    const orgId = ws.organization_id;
    const { error } = await s.from("v_workspaces" as never).update({ organization_id: null, updated_at: new Date().toISOString() } as never).eq("id", workspaceId).eq("owner_user_id", norm(email));
    if (error) return { ok: false, error: "unlink_failed" };
    await logEvent({ userId: norm(email), eventType: "workspace_unlinked_from_organization", actorType: "owner", source: "app", metadata: { organization_id: orgId, workspace_id: workspaceId } });
    return { ok: true };
  } catch { return { ok: false, error: "unlink_failed" }; }
}

// Strip only protocol / www / path / trailing dot — do NOT silently delete invalid characters
// (e.g. underscores), so a malformed domain is rejected by validation instead of rewritten.
function normalizeDomain(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\.$/, "");
}
// Each label is 1–63 chars, alphanumeric, hyphens only internal (no leading/trailing hyphen).
const VALID_DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Domain capture v1: SCAFFOLD ONLY. We store the domain + the SHA-256 of a DNS TXT token and
// return the raw token ONCE for the owner to publish. There is NO automatic DNS verification
// and NO auto-join in this pass — status stays 'unverified'. The raw token is never stored or
// logged. Domain ownership here only prepares the org for future SSO / provisioning.
export async function addOrganizationDomain(email: string, domainRaw: string): Promise<Result<{ domain: string; txtName: string; txtValue: string }>> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationDomains(email, org.id))) return { ok: false, error: "forbidden" };
  const domain = normalizeDomain(domainRaw);
  if (!VALID_DOMAIN.test(domain) || domain.length > 253) return { ok: false, error: "invalid_domain" };
  try {
    const s = getSupabaseAdminClient();
    const token = crypto.randomBytes(18).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { error } = await s.from("v_organization_domains" as never).insert({ organization_id: org.id, domain, status: "unverified", verification_token_hash: tokenHash } as never);
    if (error) return { ok: false, error: String(error.message || "").includes("duplicate") ? "already_added" : "add_failed" };
    await logEvent({ userId: norm(email), eventType: "organization_domain_added", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain } });
    await logEvent({ userId: norm(email), eventType: "organization_domain_verification_started", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain } });
    // Raw token returned ONCE here for DNS instructions; never persisted, never logged.
    return { ok: true, domain, txtName: `_vraelis-challenge.${domain}`, txtValue: `vraelis-verify=${token}` };
  } catch { return { ok: false, error: "add_failed" }; }
}

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
export type JoinMode = "disabled" | "request" | "auto_member";
export type DomainDefaultRole = "member" | "viewer";
export type OrgJoinRequest = { id: string; email: string; requested_role: string; created_at: string };
export type OrgContext = {
  organization: Organization | null;
  myRole: OrgRole | null;
  canManage: boolean;
  isBillingAdmin: boolean;
  members: OrgMember[];
  domains: OrgDomain[];
  linkedWorkspaces: { id: string; name: string }[];
  linkableWorkspaces: { id: string; name: string }[];
  provisioning: { joinMode: JoinMode; defaultRole: DomainDefaultRole };
  joinRequests: OrgJoinRequest[];
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
  const empty: OrgContext = { organization: null, myRole: null, canManage: false, isBillingAdmin: false, members: [], domains: [], linkedWorkspaces: [], linkableWorkspaces: [], provisioning: { joinMode: "request", defaultRole: "member" }, joinRequests: [] };
  if (!email || !isDatabaseConfigured()) return empty;
  const owned = await ownedWorkspaces(email);
  const org = await getPrimaryOrganization(email);
  if (!org) return { ...empty, linkableWorkspaces: owned.filter((w) => !w.organization_id).map((w) => ({ id: w.id, name: w.name })) };
  const [role, members, domains, linked] = await Promise.all([myOrgRole(email, org), listOrgMembers(org.id), listOrgDomains(org.id), linkedWorkspaces(org.id)]);
  const canManage = role === "owner" || role === "admin";
  const [provisioning, joinRequests] = await Promise.all([orgProvisioningSettings(org.id), canManage ? pendingJoinRequests(org.id) : Promise.resolve([])]);
  return {
    organization: org,
    myRole: role,
    canManage,
    isBillingAdmin: role === "owner" || role === "billing_admin" || (members.find((m) => m.email === norm(email))?.can_manage_billing ?? false),
    members,
    domains,
    linkedWorkspaces: linked,
    linkableWorkspaces: canManage ? owned.filter((w) => !w.organization_id).map((w) => ({ id: w.id, name: w.name })) : [],
    provisioning,
    joinRequests,
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

// Mint a DNS TXT challenge. We store only the SHA-256 of the raw token; the raw token is
// returned ONCE for the owner to publish and is never persisted or logged.
const DNS_PREFIX = "_vraelis-challenge.";
const TXT_PREFIX = "vraelis-verify=";
function newDomainToken(domain: string) {
  const token = crypto.randomBytes(18).toString("hex");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex"), txtName: `${DNS_PREFIX}${domain}`, txtValue: `${TXT_PREFIX}${token}` };
}

// Pure, unit-testable: does any resolved TXT record hash to the stored challenge hash?
// Handles providers that split a TXT value into chunks, surrounding quotes/whitespace, and
// values published with or without the "vraelis-verify=" prefix. Constant-time compare.
export function txtRecordsMatchHash(records: string[][], storedHash: string): boolean {
  if (!storedHash) return false;
  for (const chunks of records) {
    const joined = (Array.isArray(chunks) ? chunks.join("") : String(chunks)).trim().replace(/^"|"$/g, "").trim();
    const bare = joined.replace(new RegExp("^" + TXT_PREFIX, "i"), "").trim();
    for (const cand of [bare, joined]) {
      const h = crypto.createHash("sha256").update(cand).digest("hex");
      if (h.length === storedHash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(storedHash))) return true;
    }
  }
  return false;
}

// Domain capture v1: store the domain + SHA-256 of a DNS TXT token; return the raw token ONCE.
// Status starts 'unverified'. Real verification happens in verifyOrganizationDomain. No auto-join.
export async function addOrganizationDomain(email: string, domainRaw: string): Promise<Result<{ id: string; domain: string; txtName: string; txtValue: string }>> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationDomains(email, org.id))) return { ok: false, error: "forbidden" };
  const domain = normalizeDomain(domainRaw);
  if (!VALID_DOMAIN.test(domain) || domain.length > 253) return { ok: false, error: "invalid_domain" };
  try {
    const s = getSupabaseAdminClient();
    const t = newDomainToken(domain);
    const { data, error } = await s.from("v_organization_domains" as never).insert({ organization_id: org.id, domain, status: "unverified", verification_token_hash: t.hash } as never).select("id").single();
    if (error || !data) return { ok: false, error: String(error?.message || "").includes("duplicate") ? "already_added" : "add_failed" };
    const id = (data as unknown as { id: string }).id;
    await logEvent({ userId: norm(email), eventType: "organization_domain_added", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain } });
    await logEvent({ userId: norm(email), eventType: "organization_domain_verification_started", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain } });
    // Raw token returned ONCE here for DNS instructions; never persisted, never logged.
    return { ok: true, id, domain, txtName: t.txtName, txtValue: t.txtValue };
  } catch { return { ok: false, error: "add_failed" }; }
}

// Look up the domain row scoped to the caller's org (never trusts a client org id).
async function ownedOrgDomain(email: string, domainId: string): Promise<{ org: Organization; row: { id: string; domain: string; status: string; verification_token_hash: string | null } } | { error: string }> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { error: "no_organization" };
  if (!(await canManageOrganizationDomains(email, org.id))) return { error: "forbidden" };
  if (!domainId) return { error: "not_found" };
  try {
    const { data } = await getSupabaseAdminClient().from("v_organization_domains" as never).select("id,domain,status,verification_token_hash").eq("id", domainId).eq("organization_id", org.id).maybeSingle();
    const row = data as unknown as { id: string; domain: string; status: string; verification_token_hash: string | null } | null;
    return row ? { org, row } : { error: "not_found" };
  } catch { return { error: "not_found" }; }
}

// Real DNS TXT verification. Resolves _vraelis-challenge.<domain>, hashes each TXT value, and
// marks the domain verified iff one matches the stored challenge hash. DNS failures fail
// gracefully (never crash). Owner/admin only; org-scoped; never returns or logs the token/hash.
export async function verifyOrganizationDomain(email: string, domainId: string): Promise<Result<{ verified: boolean; reason?: string }>> {
  const r = await ownedOrgDomain(email, domainId);
  if ("error" in r) return { ok: false, error: r.error };
  const { org, row } = r;
  if (row.status === "verified") return { ok: true, verified: true }; // idempotent
  if (!row.verification_token_hash) return { ok: false, error: "no_token" };
  let records: string[][] = [];
  try {
    const { resolveTxt } = await import("node:dns/promises");
    records = await Promise.race([
      resolveTxt(`${DNS_PREFIX}${row.domain}`),
      new Promise<string[][]>((_, rej) => setTimeout(() => rej(new Error("dns_timeout")), 5000)),
    ]);
  } catch {
    await logEvent({ userId: norm(email), eventType: "organization_domain_verification_failed", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain: row.domain, action: "dns_lookup_failed" } });
    return { ok: true, verified: false, reason: "not_found_yet" };
  }
  if (txtRecordsMatchHash(records, row.verification_token_hash)) {
    try { await getSupabaseAdminClient().from("v_organization_domains" as never).update({ status: "verified", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", domainId).eq("organization_id", org.id); } catch { return { ok: false, error: "update_failed" }; }
    await logEvent({ userId: norm(email), eventType: "organization_domain_verified", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain: row.domain, status: "verified" } });
    return { ok: true, verified: true };
  }
  await logEvent({ userId: norm(email), eventType: "organization_domain_verification_failed", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain: row.domain, action: "no_match" } });
  return { ok: true, verified: false, reason: "not_found_yet" };
}

// Regenerate the challenge token (e.g. the owner lost the DNS value). Unverified domains only —
// a verified domain keeps its status. New raw token returned once; old token is invalidated.
export async function regenerateOrganizationDomainToken(email: string, domainId: string): Promise<Result<{ domain: string; txtName: string; txtValue: string }>> {
  const r = await ownedOrgDomain(email, domainId);
  if ("error" in r) return { ok: false, error: r.error };
  const { org, row } = r;
  if (row.status === "verified") return { ok: false, error: "already_verified" };
  try {
    const t = newDomainToken(row.domain);
    const { error } = await getSupabaseAdminClient().from("v_organization_domains" as never).update({ verification_token_hash: t.hash, verified_at: null, updated_at: new Date().toISOString() } as never).eq("id", domainId).eq("organization_id", org.id);
    if (error) return { ok: false, error: "regenerate_failed" };
    await logEvent({ userId: norm(email), eventType: "organization_domain_token_regenerated", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain: row.domain } });
    return { ok: true, domain: row.domain, txtName: t.txtName, txtValue: t.txtValue };
  } catch { return { ok: false, error: "regenerate_failed" }; }
}

// Remove a domain. Owner/admin only, org-scoped. Does NOT touch members, workspace links, or billing.
export async function removeOrganizationDomain(email: string, domainId: string): Promise<Result> {
  const r = await ownedOrgDomain(email, domainId);
  if ("error" in r) return { ok: false, error: r.error };
  const { org, row } = r;
  try {
    const { error } = await getSupabaseAdminClient().from("v_organization_domains" as never).delete().eq("id", domainId).eq("organization_id", org.id);
    if (error) return { ok: false, error: "remove_failed" };
    await logEvent({ userId: norm(email), eventType: "organization_domain_removed", actorType: "owner", source: "app", metadata: { organization_id: org.id, domain: row.domain } });
    return { ok: true };
  } catch { return { ok: false, error: "remove_failed" }; }
}

// ── Domain auto-provisioning (v1) ─────────────────────────────────────────────
// Matching an email domain to a VERIFIED org domain only ever yields ORG-LEVEL membership at a
// safe role — never workspace/project/billing/API access (those are managed separately). Default
// mode is 'request' (admin approves). Everything below tolerates pre-migration absence (returns []
// / safe defaults) so existing org/workspace flows keep working before the SQL is applied.

const SAFE_DEFAULT_ROLES = ["member", "viewer"] as const;

// Safely parse the registrable email domain. Returns null for malformed input.
function emailDomain(email: string): string | null {
  const e = norm(email);
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const d = e.slice(at + 1).trim();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && d.length <= 253 ? d : null;
}

async function orgProvisioningSettings(orgId: string): Promise<{ joinMode: JoinMode; defaultRole: DomainDefaultRole }> {
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_organizations" as never).select("domain_join_mode,domain_default_role").eq("id", orgId).maybeSingle();
    if (error) return { joinMode: "request", defaultRole: "member" }; // columns absent (pre-migration)
    const r = data as unknown as { domain_join_mode?: string; domain_default_role?: string } | null;
    const joinMode = (["disabled", "request", "auto_member"].includes(r?.domain_join_mode ?? "") ? r!.domain_join_mode : "request") as JoinMode;
    const defaultRole = (r?.domain_default_role === "viewer" ? "viewer" : "member") as DomainDefaultRole;
    return { joinMode, defaultRole };
  } catch { return { joinMode: "request", defaultRole: "member" }; }
}

async function pendingJoinRequests(orgId: string): Promise<OrgJoinRequest[]> {
  try {
    const { data, error } = await getSupabaseAdminClient().from("v_organization_join_requests" as never).select("id,email,requested_role,created_at").eq("organization_id", orgId).eq("status", "pending").order("created_at", { ascending: true });
    if (error) return []; // table absent (pre-migration)
    return (data as unknown as OrgJoinRequest[]) ?? [];
  } catch { return []; }
}

// Verified-domain orgs whose domain == the caller's email domain. Uses the authenticated email
// only (callers pass session email; never client-supplied). Exact match in v1 (no subdomains).
export async function getVerifiedDomainOrganizationsForEmail(email: string): Promise<{ id: string; name: string; owner_user_id: string; joinMode: JoinMode; defaultRole: DomainDefaultRole }[]> {
  if (!isDatabaseConfigured()) return [];
  const dom = emailDomain(email);
  if (!dom) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data: dms, error } = await s.from("v_organization_domains" as never).select("organization_id").eq("domain", dom).eq("status", "verified");
    if (error) return [];
    const orgIds = [...new Set(((dms as unknown as { organization_id: string }[]) ?? []).map((d) => d.organization_id))];
    if (!orgIds.length) return [];
    const { data: orgs } = await s.from("v_organizations" as never).select("id,name,owner_user_id,domain_join_mode,domain_default_role").in("id", orgIds);
    return ((orgs as unknown as { id: string; name: string; owner_user_id: string; domain_join_mode?: string; domain_default_role?: string }[]) ?? []).map((o) => ({
      id: o.id, name: o.name, owner_user_id: o.owner_user_id,
      joinMode: (["disabled", "request", "auto_member"].includes(o.domain_join_mode ?? "") ? o.domain_join_mode : "request") as JoinMode,
      defaultRole: (o.domain_default_role === "viewer" ? "viewer" : "member") as DomainDefaultRole,
    }));
  } catch { return []; }
}

export type DomainAccessOption = { id: string; name: string; joinMode: JoinMode; requestStatus: "pending" | null };

// What the signed-in user can do via verified-domain matching: eligible orgs they are NOT already
// a member of, with any pending request status. Drives the join card. Safe display only — no org
// internals (members/workspaces/billing/audit) are exposed here.
export async function getDomainAccessForEmail(email: string): Promise<DomainAccessOption[]> {
  if (!isDatabaseConfigured()) return [];
  const uid = norm(email);
  const matches = await getVerifiedDomainOrganizationsForEmail(email);
  if (!matches.length) return [];
  try {
    const s = getSupabaseAdminClient();
    const orgIds = matches.map((m) => m.id);
    const { data: mems } = await s.from("v_organization_members" as never).select("organization_id").eq("email", uid).eq("status", "active").in("organization_id", orgIds);
    const memberOf = new Set(((mems as unknown as { organization_id: string }[]) ?? []).map((m) => m.organization_id));
    const { data: reqs } = await s.from("v_organization_join_requests" as never).select("organization_id,status").eq("email", uid).eq("status", "pending").in("organization_id", orgIds);
    const pendingOf = new Set(((reqs as unknown as { organization_id: string }[]) ?? []).map((r) => r.organization_id));
    return matches
      .filter((m) => m.joinMode !== "disabled" && !memberOf.has(m.id) && m.owner_user_id !== uid)
      .map((m) => ({ id: m.id, name: m.name, joinMode: m.joinMode, requestStatus: pendingOf.has(m.id) ? ("pending" as const) : null }));
  } catch { return []; }
}

async function upsertOrgMember(orgId: string, email: string, role: DomainDefaultRole, invitedBy: string): Promise<boolean> {
  try {
    const s = getSupabaseAdminClient();
    const { data: existing } = await s.from("v_organization_members" as never).select("id").eq("organization_id", orgId).eq("email", email).maybeSingle();
    if ((existing as unknown as { id: string } | null)?.id) {
      const { error } = await s.from("v_organization_members" as never).update({ role, status: "active", can_manage_billing: false, updated_at: new Date().toISOString() } as never).eq("id", (existing as unknown as { id: string }).id);
      return !error;
    }
    const { error } = await s.from("v_organization_members" as never).insert({ organization_id: orgId, email, role, status: "active", can_manage_billing: false, invited_by: invitedBy } as never);
    return !error;
  } catch { return false; }
}

// User requests access to (or auto-joins) an org whose VERIFIED domain matches their email. The
// org is validated against the caller's email domain server-side — a client cannot request access
// to an org their domain doesn't match. Never grants more than a safe org role; never touches
// workspace/project/billing/API access.
export async function requestOrganizationAccess(email: string, orgId: string): Promise<Result<{ mode: JoinMode; joined?: boolean; pending?: boolean }>> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const uid = norm(email);
  if (!orgId) return { ok: false, error: "not_found" };
  const dom = emailDomain(uid);
  if (!dom) return { ok: false, error: "no_domain" };
  try {
    const s = getSupabaseAdminClient();
    // Re-validate eligibility: this org has a VERIFIED domain equal to the caller's email domain.
    const { data: dmatch } = await s.from("v_organization_domains" as never).select("id").eq("organization_id", orgId).eq("domain", dom).eq("status", "verified").maybeSingle();
    if (!(dmatch as unknown as { id: string } | null)?.id) return { ok: false, error: "not_eligible" };
    const { data: orgRow } = await s.from("v_organizations" as never).select("id,owner_user_id,domain_join_mode,domain_default_role").eq("id", orgId).maybeSingle();
    const org = orgRow as unknown as { id: string; owner_user_id: string; domain_join_mode?: string; domain_default_role?: string } | null;
    if (!org) return { ok: false, error: "not_found" };
    const mode = (["disabled", "request", "auto_member"].includes(org.domain_join_mode ?? "") ? org.domain_join_mode : "request") as JoinMode;
    if (mode === "disabled") return { ok: false, error: "join_disabled" };
    // Look up membership at ANY status: an active member is already in; a REVOKED member must NOT
    // be allowed to silently self-reinstate via auto-join — reversing a deliberate revocation
    // requires explicit admin approval, so a revoked member is routed to a pending request.
    const { data: memRow } = await s.from("v_organization_members" as never).select("status").eq("organization_id", orgId).eq("email", uid).maybeSingle();
    const memStatus = (memRow as unknown as { status: string } | null)?.status ?? null;
    if (org.owner_user_id === uid || memStatus === "active") return { ok: false, error: "already_member" };
    const wasRevoked = memStatus === "revoked";
    const role: DomainDefaultRole = org.domain_default_role === "viewer" ? "viewer" : "member";

    if (mode === "auto_member" && !wasRevoked) {
      if (!(await upsertOrgMember(orgId, uid, role, uid))) return { ok: false, error: "join_failed" };
      await logEvent({ userId: uid, eventType: "organization_domain_user_auto_joined", actorType: "owner", source: "app", metadata: { organization_id: orgId, role, mode } });
      return { ok: true, mode, joined: true };
    }
    // request mode, OR a revoked member in auto_member mode — create an idempotent pending request
    // (partial unique index on (org, email) where pending) that an admin must approve.
    const { error } = await s.from("v_organization_join_requests" as never).insert({ organization_id: orgId, email: uid, status: "pending", requested_role: role } as never);
    if (error) {
      if (String(error.message || "").includes("duplicate")) return { ok: true, mode, pending: true }; // already pending
      return { ok: false, error: "request_failed" };
    }
    await logEvent({ userId: uid, eventType: "organization_join_request_created", actorType: "owner", source: "app", metadata: { organization_id: orgId, role, status: "pending", mode } });
    return { ok: true, mode, pending: true };
  } catch { return { ok: false, error: "request_failed" }; }
}

// Cancel one's own pending request.
export async function cancelOrganizationJoinRequest(email: string, orgId: string): Promise<Result> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const uid = norm(email);
  try {
    const { error } = await getSupabaseAdminClient().from("v_organization_join_requests" as never).update({ status: "canceled", updated_at: new Date().toISOString() } as never).eq("organization_id", orgId).eq("email", uid).eq("status", "pending");
    return error ? { ok: false, error: "cancel_failed" } : { ok: true };
  } catch { return { ok: false, error: "cancel_failed" }; }
}

// Owner/admin approves or rejects a pending join request. Approval activates an org membership at
// the (clamped) safe role; rejection records the decision and grants nothing. Org-scoped.
export async function decideOrganizationJoinRequest(email: string, requestId: string, decision: "approve" | "reject"): Promise<Result> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganizationMembers(email, org.id))) return { ok: false, error: "forbidden" };
  if (!requestId) return { ok: false, error: "not_found" };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_organization_join_requests" as never).select("id,email,requested_role,status").eq("id", requestId).eq("organization_id", org.id).maybeSingle();
    const req = data as unknown as { id: string; email: string; requested_role: string; status: string } | null;
    if (!req) return { ok: false, error: "not_found" };
    if (req.status !== "pending") return { ok: false, error: "not_pending" };
    if (decision === "approve") {
      const role: DomainDefaultRole = req.requested_role === "viewer" ? "viewer" : "member"; // clamp — never admin/owner
      if (!(await upsertOrgMember(org.id, norm(req.email), role, norm(email)))) return { ok: false, error: "approve_failed" };
      await s.from("v_organization_join_requests" as never).update({ status: "approved", decided_at: new Date().toISOString(), decided_by_user_id: norm(email), updated_at: new Date().toISOString() } as never).eq("id", requestId).eq("organization_id", org.id);
      await logEvent({ userId: norm(email), eventType: "organization_join_request_approved", actorType: "owner", source: "app", metadata: { organization_id: org.id, role, status: "approved" } });
      return { ok: true };
    }
    await s.from("v_organization_join_requests" as never).update({ status: "rejected", decided_at: new Date().toISOString(), decided_by_user_id: norm(email), updated_at: new Date().toISOString() } as never).eq("id", requestId).eq("organization_id", org.id);
    await logEvent({ userId: norm(email), eventType: "organization_join_request_rejected", actorType: "owner", source: "app", metadata: { organization_id: org.id, status: "rejected" } });
    return { ok: true };
  } catch { return { ok: false, error: "decide_failed" }; }
}

// Owner/admin updates verified-domain provisioning settings (join mode + safe default role).
export async function updateOrganizationProvisioningSettings(email: string, joinMode: string, defaultRole: string): Promise<Result> {
  const org = await getPrimaryOrganization(email);
  if (!org) return { ok: false, error: "no_organization" };
  if (!(await canManageOrganization(email, org.id))) return { ok: false, error: "forbidden" };
  if (!["disabled", "request", "auto_member"].includes(joinMode)) return { ok: false, error: "invalid_mode" };
  if (!SAFE_DEFAULT_ROLES.includes(defaultRole as (typeof SAFE_DEFAULT_ROLES)[number])) return { ok: false, error: "invalid_role" };
  try {
    const { error } = await getSupabaseAdminClient().from("v_organizations" as never).update({ domain_join_mode: joinMode, domain_default_role: defaultRole, updated_at: new Date().toISOString() } as never).eq("id", org.id);
    if (error) return { ok: false, error: "update_failed" };
    await logEvent({ userId: norm(email), eventType: "organization_provisioning_settings_updated", actorType: "owner", source: "app", metadata: { organization_id: org.id, mode: joinMode, role: defaultRole } });
    return { ok: true };
  } catch { return { ok: false, error: "update_failed" }; }
}

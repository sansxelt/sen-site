// Workspace activity / audit log (v1). A read-only, owner-facing governance surface over
// the EXISTING v_events. Shows only safe, governance-relevant events with whitelisted
// scalar context — NEVER emails, Stripe ids, invite tokens, webhook secrets, API keys,
// raw payloads, or participant data. No schema change.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getOrCreatePersonalWorkspace } from "./v-workspace";
import { canViewOrganizationAudit, getPrimaryOrganization } from "./v-organization";

const norm = (e: string) => e.trim().toLowerCase();

// Activity-relevant event types -> human labels. Anything not here is omitted.
// Covers evaluations, credits, billing, exports, and governance — but NOT high-volume
// machine noise (api_request_made) or internal/admin events.
const AUDIT_LABELS: Record<string, string> = {
  test_launched: "Evaluation launched",
  test_completed: "Evaluation completed",
  sandbox_evaluation_created: "Sandbox evaluation created",
  evaluation_assigned_to_project: "Evaluation added to project",
  export_downloaded: "Results exported",
  collection_link_created: "Collection link created",
  screening_question_created: "Screening question added",
  screening_question_updated: "Screening question updated",
  checkout_started: "Credit top-up started",
  webhook_test_sent: "Test webhook sent",
  project_updated: "Project updated",
  project_added_to_workspace: "Project added to workspace",
  project_member_activated: "Project access activated",
  project_invite_resent: "Project invite re-sent",
  invite_expired: "Invite expired",
  team_seat_limit_reached: "Seat limit reached",
  workspace_created: "Workspace created",
  workspace_member_invited: "Member invited",
  workspace_member_role_changed: "Member role changed",
  workspace_member_revoked: "Member access revoked",
  workspace_invite_resent: "Invite re-sent",
  invite_accepted: "Invite accepted",
  project_created: "Project created",
  project_member_invited: "Project access granted",
  project_member_role_changed: "Project role changed",
  project_member_revoked: "Project access revoked",
  workspace_billing_admin_granted: "Billing admin granted",
  workspace_billing_admin_revoked: "Billing admin removed",
  team_checkout_started: "Team billing checkout started",
  team_billing_configured: "Team billing configured",
  team_billing_synced: "Team billing synced",
  team_billing_canceled: "Team billing canceled",
  team_billing_past_due: "Team billing payment issue",
  team_seat_count_changed: "Seat count changed",
  team_invoices_viewed: "Invoices viewed",
  team_invoice_opened: "Invoice opened",
  workspace_billing_owner_changed: "Billing owner changed",
  workspace_ownership_transfer_requested: "Ownership transfer requested",
  workspace_ownership_transfer_billing_started: "Ownership transfer — billing setup",
  workspace_ownership_transfer_billing_completed: "Ownership transfer — billing complete",
  workspace_ownership_transfer_completed: "Ownership transferred",
  workspace_ownership_transferred: "Ownership transferred",
  workspace_ownership_transfer_canceled: "Ownership transfer canceled",
  followup_created: "Confirmation round created",
  confirmation_round_created: "Confirmation round launched",
  api_key_created: "API key created",
  api_key_revoked: "API key revoked",
  webhook_endpoint_created: "Webhook endpoint created",
  webhook_endpoint_deleted: "Webhook endpoint deleted",
  webhook_endpoint_updated: "Webhook endpoint updated",
  webhook_secret_rotated: "Webhook secret rotated",
  audit_export_created: "Audit export downloaded",
  organization_created: "Organization created",
  organization_member_added: "Organization member added",
  organization_member_role_changed: "Organization member role changed",
  organization_member_revoked: "Organization member revoked",
  organization_domain_added: "Organization domain added",
  organization_domain_verification_started: "Domain verification started",
  organization_domain_verified: "Domain verified",
  organization_domain_verification_failed: "Domain verification failed",
  organization_domain_token_regenerated: "Domain token regenerated",
  organization_domain_removed: "Organization domain removed",
  organization_domain_reverification_checked: "Domain re-verification checked",
  organization_domain_reverification_failed: "Domain re-verification failed",
  organization_domain_reverification_required: "Domain needs re-verification",
  organization_domain_reverification_restored: "Domain re-verification restored",
  organization_domain_reverification_cron_completed: "Domain re-verification sweep completed",
  organization_join_request_created: "Domain access requested",
  organization_join_request_approved: "Domain access approved",
  organization_join_request_rejected: "Domain access rejected",
  organization_domain_user_auto_joined: "Member auto-joined via domain",
  organization_provisioning_settings_updated: "Domain access settings updated",
  organization_sso_provider_created: "SSO provider created",
  organization_sso_provider_updated: "SSO provider configured",
  organization_sso_provider_enabled: "SSO provider enabled",
  organization_sso_provider_disabled: "SSO provider disabled",
  organization_sso_login_started: "SSO login started",
  organization_sso_login_succeeded: "SSO login succeeded",
  organization_sso_login_failed: "SSO login failed",
  organization_sso_user_provisioned: "SSO user provisioned",
  organization_sso_test_completed: "SSO test completed",
  workspace_linked_to_organization: "Workspace linked to organization",
  workspace_unlinked_from_organization: "Workspace unlinked from organization",
};
const AUDIT_TYPES = Object.keys(AUDIT_LABELS);
// Org-level governance events (filtered by metadata.organization_id) for the org activity view.
const ORG_AUDIT_TYPES = ["organization_created", "organization_member_added", "organization_member_role_changed", "organization_member_revoked", "organization_domain_added", "organization_domain_verification_started", "organization_domain_verified", "organization_domain_verification_failed", "organization_domain_token_regenerated", "organization_domain_removed", "organization_domain_reverification_checked", "organization_domain_reverification_failed", "organization_domain_reverification_required", "organization_domain_reverification_restored", "organization_join_request_created", "organization_join_request_approved", "organization_join_request_rejected", "organization_domain_user_auto_joined", "organization_provisioning_settings_updated", "organization_sso_provider_created", "organization_sso_provider_updated", "organization_sso_provider_enabled", "organization_sso_provider_disabled", "organization_sso_login_started", "organization_sso_login_succeeded", "organization_sso_login_failed", "organization_sso_user_provisioned", "organization_sso_test_completed", "workspace_linked_to_organization", "workspace_unlinked_from_organization"];
// Whitelisted metadata keys, ordered by display usefulness (context shows the first 4 present).
// All are safe scalars — hostnames, roles, counts, modes; never emails/tokens/ids. looksSensitive
// still blocks anything with @, Stripe ids, secrets, uuids.
const SAFE_KEYS = ["result_status", "winner", "votes_valid", "votes_filtered", "votes_target", "option_count", "credits", "amount", "kind", "role", "new_role", "old_role", "status", "interval", "seat_count", "format", "tier", "export_scope", "domain", "mode", "provider_type", "reason", "action", "count", "delivery_status", "failure_count", "batch_count", "scope", "row_count", "category", "audience"];
// Friendly display names for keys whose raw snake_case reads poorly in the UI.
const KEY_LABEL: Record<string, string> = {
  result_status: "Result", winner: "Winner", votes_valid: "Valid", votes_filtered: "Filtered", votes_target: "Target",
  option_count: "Candidates", credits: "Credits", amount: "Amount", kind: "Type", new_role: "New role", old_role: "Previous role",
  seat_count: "Seats", export_scope: "Scope", provider_type: "Provider", delivery_status: "Delivery",
  failure_count: "Failures", batch_count: "Checked", row_count: "Rows",
};
const looksSensitive = (v: string) => /@|cus_[A-Za-z0-9]|sub_[A-Za-z0-9]|si_[A-Za-z0-9]|price_|sk_|whsec_|^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) || v.length > 48;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function keyLabel(k: string) { return KEY_LABEL[k] ?? cap(k.replace(/_/g, " ")); }
function valueLabel(k: string, v: unknown) {
  if (k === "amount" && typeof v === "number") return `$${v}`;
  return typeof v === "string" ? v.replace(/_/g, " ") : String(v);
}

// Coarse category for the feed chip — derived from the event type, never from metadata.
function categoryFor(t: string): string {
  if (/^(test_|sandbox_|evaluation_|confirmation_|followup_|export_downloaded|collection_link|screening_)/.test(t)) return "Evaluation";
  if (t === "checkout_started") return "Credits";
  if (/^(team_|workspace_billing)/.test(t)) return "Billing";
  if (/^(organization_|workspace_linked|workspace_unlinked)/.test(t)) return "Organization";
  if (/^(api_key|webhook_)/.test(t)) return "Developer";
  if (/^(workspace_member|workspace_invite|invite_|project_member|project_invite|workspace_ownership)/.test(t)) return "Team";
  if (t === "audit_export_created") return "Governance";
  return "Workspace";
}

export type AuditEntry = { id: string; label: string; when: string; actor: string; context: string; category: string; subject?: string };

type Row = { id: string; user_id: string | null; test_id?: string | null; event_type: string; actor_type: string; metadata: Record<string, unknown> | null; created_at: string };

function toEntry(r: Row, uid: string, titles?: Map<string, string>): AuditEntry {
  const md = (r.metadata ?? {}) as Record<string, unknown>;
  const context = SAFE_KEYS
    .filter((k) => md[k] != null && typeof md[k] !== "object" && !looksSensitive(String(md[k])))
    .slice(0, 4)
    .map((k) => `${keyLabel(k)}: ${valueLabel(k, md[k])}`)
    .join(" · ");
  const actor = r.user_id === uid ? "You" : r.actor_type === "system" ? "System" : r.actor_type === "api" ? "API" : r.actor_type === "webhook" ? "Webhook" : "Team";
  const title = r.test_id && titles ? titles.get(r.test_id) : undefined;
  return {
    id: r.id, label: AUDIT_LABELS[r.event_type] ?? r.event_type, when: r.created_at, actor, context,
    category: categoryFor(r.event_type),
    ...(title ? { subject: title.length > 60 ? title.slice(0, 57) + "…" : title } : {}),
  };
}

export async function workspaceActivity(email: string, limit = 40): Promise<AuditEntry[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const ws = await getOrCreatePersonalWorkspace(email);
    const cols = "id,user_id,test_id,event_type,actor_type,metadata,created_at";
    const [mine, sys] = await Promise.all([
      s.from("v_events" as never).select(cols).eq("user_id", uid).in("event_type", AUDIT_TYPES).order("created_at", { ascending: false }).limit(limit),
      ws ? s.from("v_events" as never).select(cols).eq("metadata->>workspace_id", ws.id).in("event_type", AUDIT_TYPES).order("created_at", { ascending: false }).limit(limit) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const byId = new Map<string, Row>();
    for (const r of [...((mine.data as unknown as Row[]) ?? []), ...(((sys as { data?: Row[] }).data) ?? [])]) byId.set(r.id, r);
    const rows = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
    // Enrich evaluation events with the evaluation's title — but ONLY the caller's own tests
    // (user_id = uid), so a stray event can never surface someone else's content.
    const testIds = [...new Set(rows.map((r) => r.test_id).filter((t): t is string => !!t))];
    const titles = new Map<string, string>();
    if (testIds.length) {
      const { data: ts } = await s.from("v_tests" as never).select("id,title").in("id", testIds).eq("user_id", uid);
      for (const t of (ts as unknown as { id: string; title: string }[]) ?? []) titles.set(t.id, t.title);
    }
    return rows.map((r) => toEntry(r, uid, titles));
  } catch { return []; }
}

// Org-level governance activity, filtered by metadata.organization_id. Self-guards: returns []
// unless the caller can view this org's audit (owner/admin). Org-LEVEL events only — it does NOT
// aggregate the activity of linked workspaces, so no cross-workspace data leaks here.
export async function organizationActivity(email: string, orgId: string, limit = 40): Promise<AuditEntry[]> {
  if (!email || !orgId || !isDatabaseConfigured()) return [];
  if (!(await canViewOrganizationAudit(email, orgId))) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const { data } = await s.from("v_events" as never).select("id,user_id,event_type,actor_type,metadata,created_at").eq("metadata->>organization_id", orgId).in("event_type", ORG_AUDIT_TYPES).order("created_at", { ascending: false }).limit(limit);
    return ((data as unknown as Row[]) ?? []).map((r) => toEntry(r, uid));
  } catch { return []; }
}

// ── Server-side audit export (Enterprise Audit Export v1) ─────────────────────
// Returns the SAME already-sanitized AuditEntry rows the /activity view shows — never raw
// metadata, emails, tokens, hashes, Stripe ids, or payloads. Permission is enforced here:
// workspace scope is self-scoped (the caller's own workspace activity, like the page);
// organization scope requires org owner/admin (canViewOrganizationAudit). No public/API-key access.
export type AuditScope = "workspace" | "organization";
export type AuditExportResult = { ok: true; entries: AuditEntry[] } | { ok: false; error: string };

export async function exportableAudit(email: string, scope: AuditScope, limit = 500): Promise<AuditExportResult> {
  if (!email || !isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const cap = Math.min(Math.max(1, Math.floor(limit) || 500), 2000);
  if (scope === "workspace") return { ok: true, entries: await workspaceActivity(email, cap) };
  if (scope === "organization") {
    const org = await getPrimaryOrganization(email);
    if (!org) return { ok: false, error: "no_organization" };
    if (!(await canViewOrganizationAudit(email, org.id))) return { ok: false, error: "forbidden" };
    return { ok: true, entries: await organizationActivity(email, org.id, cap) };
  }
  return { ok: false, error: "invalid_scope" };
}

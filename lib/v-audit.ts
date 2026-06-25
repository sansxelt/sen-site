// Workspace activity / audit log (v1). A read-only, owner-facing governance surface over
// the EXISTING v_events. Shows only safe, governance-relevant events with whitelisted
// scalar context — NEVER emails, Stripe ids, invite tokens, webhook secrets, API keys,
// raw payloads, or participant data. No schema change.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getOrCreatePersonalWorkspace } from "./v-workspace";
import { canViewOrganizationAudit } from "./v-organization";

const norm = (e: string) => e.trim().toLowerCase();

// Governance-relevant event types -> human labels. Anything not here is omitted.
const AUDIT_LABELS: Record<string, string> = {
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
// "domain" is a safe bare hostname (acme.com) — not PII; "mode" is disabled|request|auto_member;
// "provider_type" is saml|oidc; "failure_count"/"batch_count" are small ints. looksSensitive still
// blocks anything with @, Stripe ids, secrets, uuids.
const SAFE_KEYS = ["role", "new_role", "old_role", "action", "status", "interval", "seat_count", "count", "delivery_status", "reason", "domain", "mode", "provider_type", "failure_count", "batch_count"];
const looksSensitive = (v: string) => /@|cus_[A-Za-z0-9]|sub_[A-Za-z0-9]|si_[A-Za-z0-9]|price_|sk_|whsec_|^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) || v.length > 48;

export type AuditEntry = { id: string; label: string; when: string; actor: string; context: string };

type Row = { id: string; user_id: string | null; event_type: string; actor_type: string; metadata: Record<string, unknown> | null; created_at: string };

function toEntry(r: Row, uid: string): AuditEntry {
  const md = (r.metadata ?? {}) as Record<string, unknown>;
  const context = SAFE_KEYS
    .filter((k) => md[k] != null && typeof md[k] !== "object" && !looksSensitive(String(md[k])))
    .map((k) => `${k.replace(/_/g, " ")}: ${md[k]}`)
    .join(" · ");
  const actor = r.user_id === uid ? "You" : r.actor_type === "system" ? "System" : r.actor_type === "api" ? "API" : r.actor_type === "webhook" ? "Webhook" : "Team";
  return { id: r.id, label: AUDIT_LABELS[r.event_type] ?? r.event_type, when: r.created_at, actor, context };
}

export async function workspaceActivity(email: string, limit = 40): Promise<AuditEntry[]> {
  if (!email || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(email);
    const ws = await getOrCreatePersonalWorkspace(email);
    const cols = "id,user_id,event_type,actor_type,metadata,created_at";
    const [mine, sys] = await Promise.all([
      s.from("v_events" as never).select(cols).eq("user_id", uid).in("event_type", AUDIT_TYPES).order("created_at", { ascending: false }).limit(limit),
      ws ? s.from("v_events" as never).select(cols).eq("metadata->>workspace_id", ws.id).in("event_type", AUDIT_TYPES).order("created_at", { ascending: false }).limit(limit) : Promise.resolve({ data: [] as Row[] }),
    ]);
    const byId = new Map<string, Row>();
    for (const r of [...((mine.data as unknown as Row[]) ?? []), ...(((sys as { data?: Row[] }).data) ?? [])]) byId.set(r.id, r);
    const rows = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
    return rows.map((r) => toEntry(r, uid));
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

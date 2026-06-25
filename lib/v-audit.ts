// Workspace activity / audit log (v1). A read-only, owner-facing governance surface over
// the EXISTING v_events. Shows only safe, governance-relevant events with whitelisted
// scalar context — NEVER emails, Stripe ids, invite tokens, webhook secrets, API keys,
// raw payloads, or participant data. No schema change.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getOrCreatePersonalWorkspace } from "./v-workspace";

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
};
const AUDIT_TYPES = Object.keys(AUDIT_LABELS);
const SAFE_KEYS = ["role", "new_role", "old_role", "action", "status", "interval", "seat_count", "count", "delivery_status", "reason"];
const looksSensitive = (v: string) => /@|cus_[A-Za-z0-9]|sub_[A-Za-z0-9]|si_[A-Za-z0-9]|price_|sk_|whsec_|^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) || v.length > 48;

export type AuditEntry = { id: string; label: string; when: string; actor: string; context: string };

type Row = { id: string; user_id: string | null; event_type: string; actor_type: string; metadata: Record<string, unknown> | null; created_at: string };

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
    return rows.map((r) => {
      const md = (r.metadata ?? {}) as Record<string, unknown>;
      const context = SAFE_KEYS
        .filter((k) => md[k] != null && typeof md[k] !== "object" && !looksSensitive(String(md[k])))
        .map((k) => `${k.replace(/_/g, " ")}: ${md[k]}`)
        .join(" · ");
      const actor = r.user_id === uid ? "You" : r.actor_type === "system" ? "System" : r.actor_type === "api" ? "API" : r.actor_type === "webhook" ? "Webhook" : "Team";
      return { id: r.id, label: AUDIT_LABELS[r.event_type] ?? r.event_type, when: r.created_at, actor, context };
    });
  } catch { return []; }
}

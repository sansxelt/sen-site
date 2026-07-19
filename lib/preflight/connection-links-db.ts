// Per-app connection LINKS (v_app_connection_links). A link points ONE application at ONE account-level
// connection (connection-links live at the account level; see account-connections-db.ts) and carries only
// that app's selection — the per-app half of a connection (github: repo/branch; vercel: project). The token
// lives ONCE at the account level; the link holds no secret.
//
// Owner-scoped like the rest of the data plane: every read/write filters user_id = lowercased email, and the
// app must belong to the owner before a link is written. Degrades safely (returns []/null/no-op) when
// migration 15 is not yet applied.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

async function ownsApplication(owner: string, applicationId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data } = await db().from("v_applications").select("id")
    .eq("user_id", norm(owner)).eq("id", applicationId).maybeSingle();
  return !!(data as { id?: string } | null)?.id;
}

export type AppConnectionLink = {
  id: string;
  provider: string;
  accountConnectionId: string;
  selection: Record<string, unknown>; // github:{repo,branch,commit} vercel:{project,deployment_url}
};

// Link (or re-link) an app to an account connection for a provider, with the app's selection. Upsert on
// (application_id, provider): re-linking replaces the prior link. Fails closed if the app isn't the owner's.
export async function linkAppToAccountConnection(
  owner: string,
  applicationId: string,
  provider: string,
  accountConnectionId: string,
  selection: Record<string, unknown> = {},
): Promise<{ id: string } | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  if (!(await ownsApplication(owner, applicationId))) return { error: "not_found" };
  // Verify the account connection belongs to the owner + provider (no cross-account linking).
  const { data: acct } = await db().from("v_account_connections").select("id")
    .eq("user_id", norm(owner)).eq("provider", provider).eq("id", accountConnectionId).maybeSingle();
  if (!(acct as { id?: string } | null)?.id) return { error: "connection_not_found" };

  const clean = (selection && typeof selection === "object" && !Array.isArray(selection)) ? selection : {};
  const { data: existing } = await db().from("v_app_connection_links").select("id")
    .eq("user_id", norm(owner)).eq("application_id", applicationId).eq("provider", provider).maybeSingle();
  const existingRow = existing as { id: string } | null;

  if (existingRow?.id) {
    const { error } = await db().from("v_app_connection_links")
      .update({ account_connection_id: accountConnectionId, selection: clean } as never)
      .eq("user_id", norm(owner)).eq("id", existingRow.id);
    if (error) return { error: "unavailable" };
    return { id: existingRow.id };
  }
  const { data, error } = await db().from("v_app_connection_links").insert({
    application_id: applicationId, user_id: norm(owner), account_connection_id: accountConnectionId,
    provider, selection: clean,
  } as never).select("id").single();
  if (error || !data) return { error: "unavailable" };
  return { id: (data as { id: string }).id };
}

// Remove an app's link to a provider (the account token is untouched). True only when a row was removed.
export async function unlinkApp(owner: string, applicationId: string, provider: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_app_connection_links").delete()
    .eq("user_id", norm(owner)).eq("application_id", applicationId).eq("provider", provider).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// List an app's links (which account connection + selection it uses per provider). [] when unmigrated.
export async function listAppLinks(owner: string, applicationId: string): Promise<AppConnectionLink[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_app_connection_links")
    .select("id, provider, account_connection_id, selection")
    .eq("user_id", norm(owner)).eq("application_id", applicationId);
  if (error) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), provider: String(r.provider ?? ""),
    accountConnectionId: String(r.account_connection_id ?? ""),
    selection: (r.selection as Record<string, unknown>) ?? {},
  }));
}

// Resolve an app's link for one provider -> {accountConnectionId, selection} or null (not linked).
export async function resolveAppConnection(
  owner: string,
  applicationId: string,
  provider: string,
): Promise<AppConnectionLink | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_app_connection_links")
    .select("id, provider, account_connection_id, selection")
    .eq("user_id", norm(owner)).eq("application_id", applicationId).eq("provider", provider).maybeSingle();
  const r = data as Record<string, unknown> | null;
  if (!r) return null;
  return {
    id: String(r.id), provider: String(r.provider ?? ""),
    accountConnectionId: String(r.account_connection_id ?? ""),
    selection: (r.selection as Record<string, unknown>) ?? {},
  };
}

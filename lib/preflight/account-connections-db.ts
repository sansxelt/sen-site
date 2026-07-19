// Account-level connection data layer (v_account_connections). A connection here belongs to the ACCOUNT
// (user_id = lowercased email), NOT to an application — connect GitHub once, use it across every app. The
// sealed OAuth token lives here in exactly one place; a per-app link (connection-links-db.ts) points an app
// at one of these and carries only that app's selection (repo/project).
//
// Same tenancy + secret discipline as connections-db.ts: service-role client, every read/write filters
// eq("user_id", norm(email)); encrypted_ref is NEVER selected by list reads and never crosses this module's
// boundary in plaintext (openAccountToken is EXECUTOR/VERIFY-only). Degrades safely when migration 15 is not
// yet applied: reads return [], the opener returns null, writes report "unavailable" — so this can deploy
// before the SQL runs and simply does nothing until the tables exist.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { sealSecret, openSecret, maskSecretValue, vaultConfigured } from "./secret-vault";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// A postgREST error whose code/message indicates the table isn't there yet (migration 15 unapplied). We
// degrade instead of throwing so a code-before-migration deploy is safe.
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .*v_account_connections.* does not exist/i.test(err.message ?? "");
}

// The safe projection returned to any surface: metadata + masks only, never encrypted_ref.
export type AccountConnection = {
  id: string;
  provider: string;
  status: string;
  meta: Record<string, unknown>; // token_mask, scopes, expires_at, oauth:true, account label
  last_verified_at: string | null;
  created_at: string;
};

const OAUTH_LABEL: Record<string, string> = {
  github: "GitHub", vercel: "Vercel", supabase: "Supabase", stripe_test: "Stripe", sentry: "Sentry",
};

// List the caller's account-level connections (safe metadata only). [] when the DB is unconfigured or the
// migration is unapplied.
export async function listAccountConnections(owner: string): Promise<AccountConnection[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_account_connections")
    .select("id, provider, status, meta, last_verified_at, created_at")
    .eq("user_id", norm(owner))
    .order("created_at", { ascending: true });
  if (error) return []; // includes the missing-table case (pre-migration): degrade to "nothing connected"
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), provider: String(r.provider ?? ""), status: String(r.status ?? "connected"),
    meta: (r.meta as Record<string, unknown>) ?? {},
    last_verified_at: (r.last_verified_at as string) ?? null, created_at: String(r.created_at ?? ""),
  }));
}

// Store (or re-store) an account-level OAuth token. Upsert on (user_id, provider): re-connecting a provider
// re-seals the single grant rather than creating a duplicate. Mirrors addOAuthConnection's meta shape exactly.
export async function addAccountOAuthConnection(
  owner: string,
  provider: string,
  input: { accessToken: string; refreshToken?: string; scope?: string; expiresIn?: number; account?: string },
): Promise<{ id: string } | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  if (!vaultConfigured()) return { error: "vault_unconfigured" };
  const accessToken = (input.accessToken || "").trim();
  if (!accessToken) return { error: "credentials_required" };

  const sealed = sealSecret({
    access_token: accessToken,
    ...(input.refreshToken ? { refresh_token: input.refreshToken } : {}),
  });
  const scopes = (input.scope || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const meta: Record<string, unknown> = {
    label: input.account ? `${OAUTH_LABEL[provider] ?? provider} (${input.account})` : (OAUTH_LABEL[provider] ?? provider),
    token_mask: maskSecretValue(accessToken),
    oauth: true,
    scopes,
    ...(typeof input.expiresIn === "number" && input.expiresIn > 0
      ? { expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString() }
      : {}),
    ...(input.account ? { account: input.account.slice(0, 120) } : {}),
  };

  const { data: existing, error: readErr } = await db().from("v_account_connections").select("id")
    .eq("user_id", norm(owner)).eq("provider", provider).maybeSingle();
  if (isMissingTable(readErr)) return { error: "migration_required" };
  const existingRow = existing as { id: string } | null;

  if (existingRow?.id) {
    const { error } = await db().from("v_account_connections")
      .update({ status: "connected", encrypted_ref: sealed, meta, last_verified_at: new Date().toISOString() } as never)
      .eq("user_id", norm(owner)).eq("id", existingRow.id);
    if (error) return { error: "unavailable" };
    return { id: existingRow.id };
  }

  const { data, error } = await db().from("v_account_connections").insert({
    user_id: norm(owner), provider, status: "connected", encrypted_ref: sealed, meta,
  } as never).select("id").single();
  if (error || !data) return { error: isMissingTable(error) ? "migration_required" : "unavailable" };
  return { id: (data as { id: string }).id };
}

// Re-seal a refreshed token pair for an existing account connection (used by the refresh path when a
// short-lived token expires). Owner+provider scoped UPDATE of encrypted_ref + meta.expires_at. Never
// creates a row; a missing connection returns false.
export async function updateAccountOAuthTokens(
  owner: string,
  provider: string,
  input: { accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string },
): Promise<boolean> {
  if (!isDatabaseConfigured() || !vaultConfigured()) return false;
  const accessToken = (input.accessToken || "").trim();
  if (!accessToken) return false;
  const sealed = sealSecret({
    access_token: accessToken,
    ...(input.refreshToken ? { refresh_token: input.refreshToken } : {}),
  });
  // Merge the fresh mask/expiry/scopes into meta without touching the label/account.
  const { data: cur } = await db().from("v_account_connections").select("meta")
    .eq("user_id", norm(owner)).eq("provider", provider).maybeSingle();
  const meta = { ...(((cur as { meta?: Record<string, unknown> } | null)?.meta) ?? {}) } as Record<string, unknown>;
  meta.token_mask = maskSecretValue(accessToken);
  meta.oauth = true;
  if (typeof input.expiresIn === "number" && input.expiresIn > 0) meta.expires_at = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  if (input.scope) meta.scopes = input.scope.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const { data, error } = await db().from("v_account_connections")
    .update({ encrypted_ref: sealed, meta, last_verified_at: new Date().toISOString() } as never)
    .eq("user_id", norm(owner)).eq("provider", provider).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// Revoke an account connection (deletes the row + ciphertext; its per-app links cascade away). Returns true
// only when a row was actually removed (a zero-row delete is not a real revoke).
export async function removeAccountConnection(owner: string, connectionId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_account_connections").delete()
    .eq("user_id", norm(owner)).eq("id", connectionId).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// EXECUTOR/VERIFY-ONLY: open a stored account OAuth token by connection id OR provider. Owner-scoped. Returns
// the sealed token pair + non-secret expiry so a consumer can decide whether to refresh. Never call from a
// web route that could echo the token.
export async function openAccountToken(
  owner: string,
  by: { connectionId: string } | { provider: string },
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string; provider: string } | null> {
  if (!isDatabaseConfigured()) return null;
  let q = db().from("v_account_connections").select("encrypted_ref, provider, meta").eq("user_id", norm(owner));
  q = "connectionId" in by ? q.eq("id", by.connectionId) : q.eq("provider", by.provider);
  const { data } = await q.maybeSingle();
  const row = data as { encrypted_ref?: string; provider?: string; meta?: { oauth?: boolean; expires_at?: string } } | null;
  if (!row?.encrypted_ref || row.meta?.oauth !== true) return null;
  const opened = openSecret(row.encrypted_ref);
  const accessToken = String(opened.access_token ?? "");
  if (!accessToken) return null;
  return {
    accessToken,
    ...(opened.refresh_token ? { refreshToken: String(opened.refresh_token) } : {}),
    ...(row.meta?.expires_at ? { expiresAt: row.meta.expires_at } : {}),
    provider: String(row.provider ?? ""),
  };
}

// Vraelis API keys. Store only a SHA-256 hash; the raw key is shown once.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { createHash, randomBytes } from "crypto";

function norm(e: string): string { return e.trim().toLowerCase(); }
function hash(k: string): string { return createHash("sha256").update(k).digest("hex"); }

export type ApiKeyRow = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string; name?: string | null };

export async function generateApiKey(userId: string, name?: string): Promise<{ key: string; prefix: string } | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const raw = "vr_live_" + randomBytes(24).toString("hex");
  const prefix = raw.slice(0, 16);
  const s = getSupabaseAdminClient();
  const base = { user_id: norm(userId), key_hash: hash(raw), prefix };
  const clean = (name || "").trim().slice(0, 40);
  let { error } = await s.from("v_api_keys" as never).insert((clean ? { ...base, name: clean } : base) as never);
  // The name column may not exist until the migration runs; fall back to an
  // unnamed key so key creation never breaks.
  if (error && clean) ({ error } = await s.from("v_api_keys" as never).insert(base as never));
  if (error) { console.error("generateApiKey:", error.message); return null; }
  await logEvent({ userId: norm(userId), eventType: "api_key_created", actorType: "owner", source: "app", metadata: { prefix, name: clean || null } });
  return { key: raw, prefix };
}

export async function verifyApiKey(key: string): Promise<{ userId: string; scopes: string[]; prefix: string } | null> {
  if (!key || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  // prefix is the public, non-secret identifier (already shown in the UI) — used
  // to attribute API usage per key. NEVER selects key_hash.
  const { data } = await s.from("v_api_keys" as never).select("user_id,scopes,id,prefix").eq("key_hash", hash(key)).maybeSingle();
  const r = data as unknown as { user_id: string; scopes: string[]; id: string; prefix: string } | null;
  if (!r) return null;
  await s.from("v_api_keys" as never).update({ last_used: new Date().toISOString() } as never).eq("id", r.id);
  return { userId: r.user_id, scopes: r.scopes ?? [], prefix: r.prefix };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  // Never select key_hash. Try with name; fall back if the column isn't there yet.
  let { data, error } = await s.from("v_api_keys" as never).select("id,prefix,scopes,last_used,created_at,name").eq("user_id", norm(userId)).order("created_at", { ascending: false });
  if (error) ({ data } = await s.from("v_api_keys" as never).select("id,prefix,scopes,last_used,created_at").eq("user_id", norm(userId)).order("created_at", { ascending: false }));
  return (data as unknown as ApiKeyRow[]) ?? [];
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  // Capture safe metadata (prefix/name, never the hash) before deleting, for the audit log.
  const { data } = await s.from("v_api_keys" as never).select("prefix,name").eq("user_id", norm(userId)).eq("id", id).maybeSingle();
  const meta = data as unknown as { prefix?: string; name?: string | null } | null;
  await s.from("v_api_keys" as never).delete().eq("user_id", norm(userId)).eq("id", id);
  if (meta) await logEvent({ userId: norm(userId), eventType: "api_key_revoked", actorType: "owner", source: "app", metadata: { prefix: meta.prefix ?? null, name: meta.name ?? null } });
}

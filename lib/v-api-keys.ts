// Vraelis API keys. Store only a SHA-256 hash; the raw key is shown once.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { createHash, randomBytes } from "crypto";

function norm(e: string): string { return e.trim().toLowerCase(); }
function hash(k: string): string { return createHash("sha256").update(k).digest("hex"); }

export type ApiKeyRow = { id: string; prefix: string; scopes: string[]; last_used: string | null; created_at: string; name?: string | null };

// The scopes a key may be granted at creation, and the only strings the API route will accept. A scope not
// on this list is dropped rather than stored, so a typo or a hostile body can never mint a key carrying a
// permission the product does not define.
//
// Preflight scopes are OPT-IN and are never added implicitly. preflight:run:create is the one that spends
// money, which is why it is separable from the two read scopes: a CI job that only polls, or a dashboard
// that only prices a pass, should hold a key that cannot launch a run.
export const GRANTABLE_SCOPES = [
  "tests:write", "tests:read", "credits:read",
  "preflight:preview", "preflight:run:read", "preflight:run:create",
] as const;

// What a key gets when the caller asks for nothing. Unchanged from the column default the table has always
// carried, so existing behavior and existing keys are untouched.
export const DEFAULT_SCOPES = ["tests:write", "tests:read", "credits:read"] as const;

export function sanitizeScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SCOPES];
  const allowed = new Set<string>(GRANTABLE_SCOPES);
  const out = Array.from(new Set(raw.filter((s): s is string => typeof s === "string" && allowed.has(s))));
  return out.length ? out : [...DEFAULT_SCOPES];
}

// A key's daily spend ceiling, in cents. null means no ceiling. Anything not a positive finite number is
// treated as no ceiling rather than as zero, because a 0 ceiling would be a key that authenticates but can
// never spend, which is what withholding preflight:run:create already expresses more clearly.
export function sanitizeCeilingCents(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 1_000_000); // $10,000/day, well above any real use; a typo cannot mint a blank cheque
}

export async function generateApiKey(userId: string, name?: string, scopes?: string[], dailyCeilingCents?: unknown): Promise<{ key: string; prefix: string; scopes: string[]; dailyCeilingCents: number | null } | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const raw = "vr_live_" + randomBytes(24).toString("hex");
  const prefix = raw.slice(0, 16);
  const s = getSupabaseAdminClient();
  const base = { user_id: norm(userId), key_hash: hash(raw), prefix, scopes: sanitizeScopes(scopes) };
  const clean = (name || "").trim().slice(0, 40);
  const ceiling = sanitizeCeilingCents(dailyCeilingCents);
  const withName = clean ? { ...base, name: clean } : base;
  const full = ceiling === null ? withName : { ...withName, daily_ceiling_cents: ceiling };
  let { error } = await s.from("v_api_keys" as never).insert(full as never);
  // Both `name` and `daily_ceiling_cents` (migration 16) are additive columns. Fall back through them so a
  // deploy that lands before its migration still mints usable keys.
  //
  // The fallback DROPS the ceiling, which means a key the owner asked to bound would be created unbounded.
  // That is the wrong way to fail for a spend control, so this refuses instead: a key that silently ignores
  // the limit you set for it is worse than no key at all.
  if (error && ceiling !== null) {
    console.error("generateApiKey: daily_ceiling_cents is missing — apply sql/vraelis-preflight-16-key-spend-ceiling.sql. Refusing to mint an UNBOUNDED key when a ceiling was requested.");
    return null;
  }
  if (error && clean) ({ error } = await s.from("v_api_keys" as never).insert(base as never));
  if (error) { console.error("generateApiKey:", error.message); return null; }
  await logEvent({ userId: norm(userId), eventType: "api_key_created", actorType: "owner", source: "app", metadata: { prefix, name: clean || null } });
  // Report what was ACTUALLY persisted, not what was asked for. A key whose scopes silently differ from the
  // request is invisible until it fails at the first real call, which is exactly how two keys were minted
  // without preflight:run:create and nobody could tell why. The caller can now see it at creation time.
  return { key: raw, prefix, scopes: base.scopes, dailyCeilingCents: ceiling };
}

export async function verifyApiKey(key: string): Promise<{ userId: string; scopes: string[]; prefix: string; id: string; dailyCeilingCents: number | null } | null> {
  if (!key || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  // prefix is the public, non-secret identifier (already shown in the UI) — used
  // to attribute API usage per key. NEVER selects key_hash.
  //
  // daily_ceiling_cents is additive (migration 16). Selecting a column that does not exist yet is an ERROR,
  // not an empty field, and this is the authentication path: getting that wrong would reject EVERY key on a
  // deploy that landed before the migration. So the ceiling is requested optimistically and the query falls
  // back to the pre-migration column set, which reads as "no ceiling" — exactly today's behavior.
  const cols = "user_id,scopes,id,prefix,last_used";
  const first = await s.from("v_api_keys" as never).select(`${cols},daily_ceiling_cents`).eq("key_hash", hash(key)).maybeSingle();
  let data = first.data;
  if (first.error) ({ data } = await s.from("v_api_keys" as never).select(cols).eq("key_hash", hash(key)).maybeSingle());
  const r = data as unknown as { user_id: string; scopes: string[]; id: string; prefix: string; last_used: string | null; daily_ceiling_cents?: number | null } | null;
  if (!r) return null;
  // Throttle the last_used write to ~once/min per key: a burst on one key otherwise hammers
  // this single row with an UPDATE per request (lock contention). Best-effort; never blocks auth.
  const lastMs = r.last_used ? new Date(r.last_used).getTime() : 0;
  if (Date.now() - lastMs > 60_000) {
    await s.from("v_api_keys" as never).update({ last_used: new Date().toISOString() } as never).eq("id", r.id);
  }
  return { userId: r.user_id, scopes: r.scopes ?? [], prefix: r.prefix, id: r.id, dailyCeilingCents: r.daily_ceiling_cents ?? null };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  // Never select key_hash. Try with name; fall back if the column isn't there yet.
  const first = await s.from("v_api_keys" as never).select("id,prefix,scopes,last_used,created_at,name").eq("user_id", norm(userId)).order("created_at", { ascending: false });
  let data = first.data;
  if (first.error) ({ data } = await s.from("v_api_keys" as never).select("id,prefix,scopes,last_used,created_at").eq("user_id", norm(userId)).order("created_at", { ascending: false }));
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

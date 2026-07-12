// Owner-scoped data layer for the application CONNECTION GRAPH (v_app_connections) + the setup extras on
// v_applications (environment / context / test_boundaries). Same tenancy model as the rest of the data
// plane: service-role client, every read/write filters eq("user_id", lowercased email), application
// ownership is re-checked before any child write. Server-only.
//
// Secret rule: v_app_connections.encrypted_ref (test-account credentials sealed by secret-vault) is NEVER
// selected by list reads and NEVER crosses this module's boundary in plaintext — callers get SafeConnection
// (safe metadata + masks only). openTestAccount exists for the WORKER only.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { sealSecret, openSecret, maskSecretValue, vaultConfigured } from "./secret-vault";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// The connection kinds the product actually supports today. "Manual connection available" kinds carry
// user-entered metadata; OAuth comes later. Anything outside this list is refused (fail closed).
export const CONNECTION_KINDS = [
  "github", "vercel", "custom_deploy",       // source + deployment
  "supabase", "custom_auth",                 // data + auth (metadata only; no DB credentials)
  "stripe_test", "sentry", "openapi", "webhook", // billing + services
  "test_account",                            // sealed credentials (the only kind with encrypted_ref)
] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

export type SafeConnection = {
  id: string; provider: string; status: string;
  meta: Record<string, unknown>; created_at: string; last_verified_at: string | null;
};

// Keys that must never ride inside connection metadata: metadata is the NON-secret half by contract, and a
// key/token pasted into it would otherwise be stored (and listed) in plaintext. Case-insensitive substring.
const SECRETY_KEYS = ["password", "secret", "token", "api_key", "apikey", "private", "credential", "bearer"];
// VALUE-channel guard (adversarial review finding): a recognizable credential pasted into a benign-keyed
// free-text field (notes, scope, url) is redacted before storage. Prose passwords can never be reliably
// detected — the UI says so next to every free-text field — but well-known token FORMATS can be:
// Stripe sk/rk keys, GitHub tokens, JWTs, AWS access keys, private-key blocks, and explicit "password:" pairs.
const SECRETY_VALUE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(password|passwd|pwd)\s*[:=]\s*\S+/i;
export function redactSecretyValue(v: string): string {
  return SECRETY_VALUE.test(v) ? v.replace(new RegExp(SECRETY_VALUE.source, "gi"), "[redacted by Vraelis: looked like a credential]") : v;
}
export function sanitizeConnectionMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (SECRETY_KEYS.some((s) => k.toLowerCase().includes(s))) continue;   // dropped, never stored
    if (typeof v === "string") out[k] = redactSecretyValue(v.slice(0, 500));
    else if (typeof v === "boolean" || typeof v === "number") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string").map((x) => redactSecretyValue(x.slice(0, 300))).slice(0, 30);
    // nested objects dropped: metadata stays flat and auditable
  }
  return out;
}

// Ownership gate shared by every child write: the application row must exist AND belong to this owner.
async function ownsApplication(owner: string, applicationId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data } = await db().from("v_applications").select("id").eq("user_id", norm(owner)).eq("id", applicationId).maybeSingle();
  return !!data;
}

// List an application's connections, owner-scoped. encrypted_ref is DELIBERATELY not selected.
export async function listConnections(owner: string, applicationId: string): Promise<SafeConnection[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_app_connections")
    .select("id, provider, status, meta, created_at, last_verified_at")
    .eq("user_id", norm(owner)).eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r.id), provider: String(r.provider ?? ""), status: String(r.status ?? "pending"),
    meta: (r.meta as Record<string, unknown>) ?? {}, created_at: String(r.created_at ?? ""),
    last_verified_at: (r.last_verified_at as string) ?? null,
  }));
}

// Add a NON-secret connection (github/vercel/supabase/stripe_test/...). Metadata is sanitized; unknown
// kinds and test_account (which must go through addTestAccount) are refused.
export async function addConnection(owner: string, applicationId: string, provider: string, meta: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  if (!(CONNECTION_KINDS as readonly string[]).includes(provider) || provider === "test_account") return { error: "unknown_provider" };
  if (!(await ownsApplication(owner, applicationId))) return { error: "not_found" };
  const { data, error } = await db().from("v_app_connections").insert({
    application_id: applicationId, user_id: norm(owner), provider,
    status: "connected", meta: sanitizeConnectionMeta(meta),
  } as never).select("id").single();
  if (error || !data) return { error: "unavailable" };
  return { id: (data as { id: string }).id };
}

// Store a test account: credentials sealed by the vault (AES-256-GCM), only the mask + scope in metadata.
// Fail-closed: no vault key -> refuse loudly rather than store anything weaker.
export async function addTestAccount(owner: string, applicationId: string, input: { label: string; username: string; password: string; scope?: string }): Promise<{ id: string; usernameMask: string } | { error: string }> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  if (!vaultConfigured()) return { error: "vault_unconfigured" };
  if (!(await ownsApplication(owner, applicationId))) return { error: "not_found" };
  const label = (input.label || "Standard user").slice(0, 60);
  const username = (input.username || "").trim();
  const password = input.password || "";
  if (!username || !password) return { error: "credentials_required" };
  const sealed = sealSecret({ username, password });
  const usernameMask = maskSecretValue(username);
  const { data, error } = await db().from("v_app_connections").insert({
    application_id: applicationId, user_id: norm(owner), provider: "test_account",
    status: "connected", encrypted_ref: sealed,
    meta: { label, username_mask: usernameMask, scope: (input.scope || "signed-in flows only").slice(0, 200) },
  } as never).select("id").single();
  if (error || !data) return { error: "unavailable" };
  return { id: (data as { id: string }).id, usernameMask };
}

// Revoke any connection (including a test account): the row is deleted, the ciphertext with it. Returns
// true ONLY when a row was actually removed (adversarial review finding: a zero-row delete is not an
// error to PostgREST, and a false "revoked" on a credential is a lie the owner acts on).
export async function removeConnection(owner: string, applicationId: string, connectionId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { data, error } = await db().from("v_app_connections").delete()
    .eq("user_id", norm(owner)).eq("application_id", applicationId).eq("id", connectionId)
    .select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// WORKER-ONLY: open a test account's sealed credentials for a real browser sign-in step. Owner-scoped by
// the run's own user id. Never call from a web route: nothing here may flow back to a client.
export async function openTestAccount(owner: string, applicationId: string, connectionId: string): Promise<{ username: string; password: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_app_connections").select("encrypted_ref")
    .eq("user_id", norm(owner)).eq("application_id", applicationId).eq("id", connectionId)
    .eq("provider", "test_account").maybeSingle();
  const sealed = (data as { encrypted_ref?: string } | null)?.encrypted_ref;
  if (!sealed) return null;
  const opened = openSecret(sealed);
  return { username: String(opened.username ?? ""), password: String(opened.password ?? "") };
}

// ── Setup extras on the application row (environment / context / boundaries) ──────────────────────────

// Conservative-by-default test boundaries: every permit OFF until the owner turns it on. The fixed
// never-rules (no destructive actions, no live payment methods, no production-data deletion) are product
// invariants, not toggles, so they are not stored here.
export type TestBoundaries = {
  allowed_domains: string[];
  permit_account_creation: boolean; permit_db_writes: boolean; permit_email: boolean;
  permit_test_purchases: boolean; permit_file_upload: boolean;
};
export const DEFAULT_BOUNDARIES: TestBoundaries = {
  allowed_domains: [],
  permit_account_creation: false, permit_db_writes: false, permit_email: false,
  permit_test_purchases: false, permit_file_upload: false,
};
export function normalizeBoundaries(raw: unknown): TestBoundaries {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    allowed_domains: Array.isArray(r.allowed_domains)
      ? r.allowed_domains.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase().slice(0, 253)).filter(Boolean).slice(0, 20)
      : [],
    permit_account_creation: r.permit_account_creation === true,
    permit_db_writes: r.permit_db_writes === true,
    permit_email: r.permit_email === true,
    permit_test_purchases: r.permit_test_purchases === true,
    permit_file_upload: r.permit_file_upload === true,
  };
}

// Product-definition sources (prompt/PRD/requirements/readme/risks/roles). Content is bounded so a giant
// paste can't balloon the row; anything over the cap is truncated with an honest marker.
export const CONTEXT_KINDS = ["prompt", "prd", "requirements", "readme", "risks", "roles"] as const;
const MAX_SOURCE_CHARS = 60_000;
const MAX_SOURCES = 12;
export type ContextSource = { kind: string; name: string; chars: number; added_at: string; content: string };
export function normalizeContextSources(raw: unknown): ContextSource[] {
  if (!Array.isArray(raw)) return [];
  const out: ContextSource[] = [];
  for (const entry of raw.slice(0, MAX_SOURCES)) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const kind = typeof e.kind === "string" && (CONTEXT_KINDS as readonly string[]).includes(e.kind) ? e.kind : null;
    const content = typeof e.content === "string" ? e.content : "";
    if (!kind || !content.trim()) continue;
    const bounded = content.length > MAX_SOURCE_CHARS ? `${content.slice(0, MAX_SOURCE_CHARS)}\n\n[truncated by Vraelis at ${MAX_SOURCE_CHARS} characters]` : content;
    out.push({ kind, name: (typeof e.name === "string" && e.name.trim() ? e.name : kind).slice(0, 120), chars: bounded.length, added_at: new Date().toISOString(), content: bounded });
  }
  return out;
}

// Persist the setup extras. Best-effort against a pre-migration-5 schema: a missing column degrades to a
// warn + no-op (the columns are additive config; absent boundaries are treated as most conservative by
// design, so dropping them can only ever make Vraelis MORE cautious, never less).
export async function applySetupExtras(owner: string, applicationId: string, extras: { environment?: string | null; context?: ContextSource[]; boundaries?: TestBoundaries }): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = {};
  const env = (extras.environment || "").trim().toLowerCase();
  if (env === "preview" || env === "staging" || env === "production") patch.environment = env;
  if (extras.context?.length) patch.context = extras.context;
  if (extras.boundaries) patch.test_boundaries = extras.boundaries;
  if (!Object.keys(patch).length) return;
  const { error } = await db().from("v_applications").update(patch as never)
    .eq("user_id", norm(owner)).eq("id", applicationId);
  if (error && process.env.NODE_ENV !== "production") console.warn("applySetupExtras (apply sql/vraelis-preflight-5-connections.sql?):", error.message);
}

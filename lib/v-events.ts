// Append-only product analytics events (v_events). The single safe writer is
// logEvent(): it sanitizes metadata, drops anything that smells sensitive, caps
// size, and NEVER throws into a product flow (the table may not exist before the
// migration runs). Reads tolerate a missing/empty table.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type ActorType = "owner" | "voter" | "api" | "webhook" | "system" | "admin";

// Drop any metadata key whose (lowercased) name looks like a secret or raw PII.
// Defense-in-depth: callers already pass only safe fields, but this guarantees it.
const DENY = ["key", "secret", "token", "password", "hash", "cvv", "card", "device", "raw", "credential", "cookie", "authorization", "email", "stripe", "ssn", "phone"];
function unsafeKey(k: string): boolean {
  const low = k.toLowerCase();
  if (low === "ip" || low.endsWith("_ip") || low.startsWith("ip_")) return true;
  return DENY.some((d) => low.includes(d));
}

const MAX_KEYS = 20;
const MAX_STR = 200;

function sanitize(meta?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!meta || typeof meta !== "object") return out;
  let n = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (n >= MAX_KEYS) break;
    if (!k || unsafeKey(k)) continue;
    // Only scalars — no nested objects/arrays (keeps it small and avoids leaking blobs).
    if (v === null) { out[k] = null; n++; }
    else if (typeof v === "string") { out[k] = v.slice(0, MAX_STR); n++; }
    else if (typeof v === "number" && Number.isFinite(v)) { out[k] = v; n++; }
    else if (typeof v === "boolean") { out[k] = v; n++; }
  }
  return out;
}

export async function logEvent(e: {
  userId?: string | null;
  testId?: string | null;
  eventType: string;
  actorType: ActorType;
  source?: string | null;
  route?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!isDatabaseConfigured() || !e.eventType || !e.actorType) return;
    const s = getSupabaseAdminClient();
    await s.from("v_events" as never).insert({
      user_id: e.userId ? String(e.userId).trim().toLowerCase().slice(0, 200) : null,
      test_id: e.testId || null,
      event_type: String(e.eventType).slice(0, 60),
      actor_type: String(e.actorType).slice(0, 16),
      source: e.source ? String(e.source).slice(0, 40) : null,
      route: e.route ? String(e.route).slice(0, 120) : null,
      metadata: sanitize(e.metadata),
    } as never);
  } catch (err) {
    // Analytics must never break a user-facing flow. Pre-migration, the table is
    // absent and this silently no-ops.
    if (process.env.NODE_ENV !== "production") console.error("logEvent:", (err as Error)?.message);
  }
}

export type EventRow = { id: string; user_id: string | null; test_id: string | null; event_type: string; actor_type: string; source: string | null; metadata: Record<string, unknown>; created_at: string };

// Recent owner activity (the owner's own events: launched, completed, export,
// share, api, webhook). Vote events are test-scoped and intentionally excluded
// from this feed so it isn't flooded by individual votes. Tolerant of a missing table.
export async function recentEvents(userId: string, limit = 12): Promise<EventRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_events" as never)
      .select("id,user_id,test_id,event_type,actor_type,source,metadata,created_at")
      .eq("user_id", userId.trim().toLowerCase()).order("created_at", { ascending: false }).limit(limit);
    if (error) return [];
    return (data as unknown as EventRow[]) ?? [];
  } catch { return []; }
}

// Counts per event_type for an owner's own events (api/webhook/export/etc.).
export async function eventCounts(userId: string, types: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!userId || !isDatabaseConfigured()) return out;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_events" as never)
      .select("event_type").in("event_type", types).eq("user_id", userId.trim().toLowerCase());
    if (error) return out;
    for (const r of (data as unknown as { event_type: string }[]) ?? []) out[r.event_type] = (out[r.event_type] ?? 0) + 1;
    return out;
  } catch { return out; }
}

// API usage analytics for an owner, derived from api_request_made events.
// Headline counts are exact (count queries); the per-endpoint / per-key breakdown
// is computed from a recent sample (fine at current volume). Tolerant of missing table.
export type ApiUsage = {
  total: number; last24h: number; last7d: number; lastAt: string | null;
  byEndpoint: { endpoint: string; method: string; count: number }[];
  byPrefix: Record<string, number>;
};
export async function apiUsage(userId: string): Promise<ApiUsage> {
  const empty: ApiUsage = { total: 0, last24h: 0, last7d: 0, lastAt: null, byEndpoint: [], byPrefix: {} };
  if (!userId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const uid = userId.trim().toLowerCase();
    const base = () => s.from("v_events" as never).select("*", { count: "exact", head: true }).eq("user_id", uid).eq("event_type", "api_request_made");
    const cut = (ms: number) => new Date(Date.now() - ms).toISOString();
    const [tot, d1, d7, recent] = await Promise.all([
      base(),
      base().gte("created_at", cut(24 * 3600e3)),
      base().gte("created_at", cut(7 * 24 * 3600e3)),
      s.from("v_events" as never).select("metadata,created_at").eq("user_id", uid).eq("event_type", "api_request_made").order("created_at", { ascending: false }).limit(2000),
    ]);
    if (tot.error) return empty;
    const rows = (recent.data as unknown as { metadata: Record<string, unknown>; created_at: string }[]) ?? [];
    const epMap: Record<string, { endpoint: string; method: string; count: number }> = {};
    const byPrefix: Record<string, number> = {};
    for (const r of rows) {
      const m = r.metadata || {};
      const ep = String(m.endpoint ?? "other"); const method = String(m.method ?? "");
      const k = `${method} ${ep}`;
      (epMap[k] ??= { endpoint: ep, method, count: 0 }).count++;
      if (m.prefix) byPrefix[String(m.prefix)] = (byPrefix[String(m.prefix)] ?? 0) + 1;
    }
    return {
      total: tot.count ?? 0, last24h: d1.count ?? 0, last7d: d7.count ?? 0,
      lastAt: rows[0]?.created_at ?? null,
      byEndpoint: Object.values(epMap).sort((a, b) => b.count - a.count).slice(0, 8),
      byPrefix,
    };
  } catch { return empty; }
}

// Recent developer-relevant events for an owner (API, exports, webhooks, launches).
export async function recentDevEvents(userId: string, limit = 12): Promise<EventRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_events" as never)
      .select("id,user_id,test_id,event_type,actor_type,source,metadata,created_at")
      .eq("user_id", userId.trim().toLowerCase())
      .in("event_type", ["api_request_made", "export_downloaded", "webhook_delivered", "webhook_failed", "test_launched", "api_key_created"])
      .order("created_at", { ascending: false }).limit(limit);
    if (error) return [];
    return (data as unknown as EventRow[]) ?? [];
  } catch { return []; }
}

// Latest timestamp for a given event type for an owner (e.g. last API activity).
export async function lastEventAt(userId: string, eventType: string): Promise<string | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_events" as never)
      .select("created_at").eq("user_id", userId.trim().toLowerCase()).eq("event_type", eventType)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return (data as unknown as { created_at: string } | null)?.created_at ?? null;
  } catch { return null; }
}

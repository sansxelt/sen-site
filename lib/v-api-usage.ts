// Per-API-key usage aggregation for the public API. Data-only, OWNER-SCOPED: every
// query is pinned to the caller's own user_id, and the requested prefix is first
// verified to belong to that owner. No money/anti-abuse logic, no key_hash, no PII.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { listApiKeys } from "./v-api-keys";
import { listRecentLedger } from "./v-db";

function norm(e: string): string { return e.trim().toLowerCase(); }

export type ApiKeyUsage = {
  prefix: string;
  window: { days: number; since: string };
  api_requests: {
    total: number;
    errors: number | null;                // null — not derivable from stored events
    by_endpoint: { endpoint: string; count: number }[];
    by_day: { day: string; count: number }[];
    last_at: string | null;
  };
  credits_used: number;                    // owner's launch "hold" spend in-window
  tests_launched: number;                  // owner's tests created in-window
  judgments_collected: number;             // sum of votes_valid over those tests
};

export async function apiKeyUsage(userId: string, prefix: string, days: number): Promise<ApiKeyUsage | null> {
  if (!userId || !prefix || !isDatabaseConfigured()) return null;
  const uid = norm(userId);

  // KEY-SCOPING + OWNERSHIP: the prefix must be one of THIS owner's keys.
  // listApiKeys is .eq(user_id, uid) and never selects key_hash. A prefix that
  // isn't the caller's own key returns null (→ 404) — we never read another
  // owner's rows and never confirm a foreign prefix exists.
  const keys = await listApiKeys(uid);
  if (!keys.some((k) => k.prefix === prefix)) return null;

  const s = getSupabaseAdminClient();
  const since = new Date(Date.now() - days * 24 * 3600e3).toISOString();

  // Owner's api_request_made events in-window. metadata.prefix is per-row JSON, so
  // filter it in memory; the DB filter is always pinned to this owner + type + window.
  const { data: evData } = await s.from("v_events" as never)
    .select("route,metadata,created_at")
    .eq("user_id", uid).eq("event_type", "api_request_made")
    .gte("created_at", since)
    .order("created_at", { ascending: false }).limit(5000);
  const rows = (evData as unknown as { route: string | null; metadata: Record<string, unknown>; created_at: string }[]) ?? [];

  let total = 0; let last_at: string | null = null;
  const epMap: Record<string, number> = {};
  const dayMap: Record<string, number> = {};
  for (const r of rows) {
    const m = r.metadata || {};
    if (String(m.prefix ?? "") !== prefix) continue; // this key only
    total++;
    if (!last_at) last_at = r.created_at;             // rows are desc-sorted
    const ep = String(m.endpoint ?? r.route ?? "other");
    epMap[ep] = (epMap[ep] ?? 0) + 1;
    const day = r.created_at.slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  }
  const by_endpoint = Object.entries(epMap).map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  const by_day = Object.entries(dayMap).map(([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? 1 : -1));

  // credits_used: owner's launch holds in-window (reason "hold", delta<0). Scoped
  // to the owner (holds aren't attributable to a single key), matching credits:read.
  const ledger = await listRecentLedger(uid, 500);
  const credits_used = ledger
    .filter((l) => l.reason === "hold" && l.created_at >= since)
    .reduce((sum, l) => sum + Math.abs(l.delta), 0);

  // tests_launched + judgments_collected: owner's tests created in-window.
  const { data: tData } = await s.from("v_tests" as never)
    .select("votes_valid,created_at")
    .eq("user_id", uid).gte("created_at", since);
  const tests = (tData as unknown as { votes_valid: number; created_at: string }[]) ?? [];
  const tests_launched = tests.length;
  const judgments_collected = tests.reduce((sum, t) => sum + (t.votes_valid || 0), 0);

  return {
    prefix,
    window: { days, since },
    api_requests: {
      total,
      // Only successful requests reach logEvent (after auth passes), so per-request
      // errors aren't stored → null, not a misleading 0.
      errors: null,
      by_endpoint, by_day, last_at,
    },
    credits_used,
    tests_launched,
    judgments_collected,
  };
}

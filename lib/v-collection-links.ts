// Campaign / collection links — named per-evaluation distribution links. Each link
// carries a channel `source` + a unique utm_campaign slug; judgments collected
// through it carry that slug, so per-link stats match on (test_id, utm_campaign).
// Owner-scoped: every read/write verifies the user owns the evaluation. Tolerant of
// a missing table (pre-migration) — returns empty / ok:false.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";
import { CHANNEL_PRESETS } from "./v-sources";

const norm = (e: string) => e.trim().toLowerCase();
const CHANNEL_KEYS = new Set(CHANNEL_PRESETS.map((p) => p.key));
const VOTE_BASE = "https://vraelis.com/embed/vote/";

// Short alnum attribution slug (app runtime — Math.random is fine here).
function slug(): string { return "cl" + Math.random().toString(36).slice(2, 10); }

function linkUrl(testId: string, source: string, campaign: string | null): string {
  const u = new URL(VOTE_BASE + testId);
  if (source && source !== "direct_link") u.searchParams.set("utm_source", source);
  if (campaign) u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

export type LinkStats = { total: number; valid: number; filtered: number; filterRate: number; lastAt: string | null };
export type CollectionLink = { id: string; test_id: string; label: string; source: string; utm_source: string | null; utm_campaign: string | null; is_active: boolean; created_at: string; url: string; stats: LinkStats };

async function ownsTest(s: ReturnType<typeof getSupabaseAdminClient>, userId: string, testId: string): Promise<boolean> {
  const { data } = await s.from("v_tests" as never).select("id").eq("id", testId).eq("user_id", norm(userId)).maybeSingle();
  return !!data;
}

export async function createCollectionLink(userId: string, testId: string, label: string, source: string): Promise<{ ok: boolean; id?: string }> {
  if (!userId || !testId || !isDatabaseConfigured()) return { ok: false };
  const lbl = (label || "").trim().slice(0, 80);
  const src = CHANNEL_KEYS.has(source) ? source : "other";
  if (!lbl) return { ok: false };
  const s = getSupabaseAdminClient();
  if (!(await ownsTest(s, userId, testId))) return { ok: false };
  const utm_campaign = slug();
  const { data, error } = await s.from("v_collection_links" as never)
    .insert({ user_id: norm(userId), test_id: testId, label: lbl, source: src, utm_source: src === "direct_link" ? null : src, utm_campaign, is_active: true } as never)
    .select("id").single();
  if (error || !data) { console.error("createCollectionLink:", error?.message); return { ok: false }; }
  const id = (data as unknown as { id: string }).id;
  await logEvent({ userId: norm(userId), testId, eventType: "collection_link_created", actorType: "owner", source: "app", metadata: { test_id: testId, collection_link_id: id, source: src } });
  return { ok: true, id };
}

export async function updateCollectionLink(userId: string, id: string, patch: { label?: string; isActive?: boolean }): Promise<{ ok: boolean }> {
  if (!userId || !id || !isDatabaseConfigured()) return { ok: false };
  const s = getSupabaseAdminClient();
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.label === "string" && patch.label.trim()) set.label = patch.label.trim().slice(0, 80);
  if (typeof patch.isActive === "boolean") set.is_active = patch.isActive;
  const { data, error } = await s.from("v_collection_links" as never).update(set as never).eq("id", id).eq("user_id", norm(userId)).select("test_id");
  if (error || !data || (data as unknown[]).length === 0) return { ok: false };
  const testId = (data as unknown as { test_id: string }[])[0]?.test_id;
  const ev = patch.isActive === false ? "collection_link_disabled" : "collection_link_updated";
  await logEvent({ userId: norm(userId), testId, eventType: ev, actorType: "owner", source: "app", metadata: { test_id: testId, collection_link_id: id } });
  return { ok: true };
}

// A test's collection links (owner-scoped) with per-link signal stats.
export async function listCollectionLinks(userId: string, testId: string): Promise<CollectionLink[]> {
  if (!userId || !testId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    if (!(await ownsTest(s, userId, testId))) return [];
    const { data, error } = await s.from("v_collection_links" as never)
      .select("id,test_id,label,source,utm_source,utm_campaign,is_active,created_at")
      .eq("user_id", norm(userId)).eq("test_id", testId).order("created_at", { ascending: true });
    if (error) return [];
    const links = (data as unknown as Omit<CollectionLink, "url" | "stats">[]) ?? [];
    if (!links.length) return [];
    const { data: jud } = await s.from("v_judgments" as never).select("utm_campaign,status,created_at").eq("test_id", testId).limit(5000);
    const byCampaign: Record<string, LinkStats> = {};
    for (const j of (jud as unknown as { utm_campaign: string | null; status: string; created_at: string }[]) ?? []) {
      if (!j.utm_campaign) continue;
      const a = (byCampaign[j.utm_campaign] ??= { total: 0, valid: 0, filtered: 0, filterRate: 0, lastAt: null });
      a.total++; if (j.status === "rejected") a.filtered++; else a.valid++;
      if (!a.lastAt || j.created_at > a.lastAt) a.lastAt = j.created_at;
    }
    return links.map((l) => {
      const st = (l.utm_campaign && byCampaign[l.utm_campaign]) || { total: 0, valid: 0, filtered: 0, filterRate: 0, lastAt: null };
      st.filterRate = st.total ? Math.round((st.filtered / st.total) * 100) : 0;
      return { ...l, url: linkUrl(testId, l.source, l.utm_campaign), stats: st };
    });
  } catch { return []; }
}

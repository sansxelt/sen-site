// Vraelis webhooks — push test.completed events to API customers. The customer
// then pulls full results from the export endpoints. Payloads NEVER include owner
// email/user_id, API keys, billing, or raw ip/device data. Owner-scoped CRUD.

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getTestWithOptions, getReport, OPTION_LETTERS, type VTest } from "./v-db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vraelis.com";
const MAX_ENDPOINTS = 10;
const DELIVERY_TIMEOUT_MS = 6000;

function norm(e: string): string { return e.trim().toLowerCase(); }
function newSecret(): string { return "whsec_" + crypto.randomBytes(24).toString("hex"); }

// SSRF guard: https only, block localhost + private/reserved IP literals.
export function webhookUrlError(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return "Enter a valid URL."; }
  if (u.protocol !== "https:") return "Webhook URL must use https://.";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return "Public host required (no localhost/internal).";
  if (host.includes(":")) return "Use a public hostname, not an IPv6 literal.";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const p = host.split(".").map(Number);
    if (p.some((n) => n > 255)) return "Invalid IP.";
    if (p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] >= 224) return "Private/reserved IPs are not allowed.";
  }
  return null;
}

function sign(secret: string, timestamp: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

// ── CRUD (owner-scoped) ──
export async function createWebhook(userId: string, url: string): Promise<{ id: string; url: string; secret: string } | { error: string }> {
  const err = webhookUrlError(url);
  if (err) return { error: err };
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  const s = getSupabaseAdminClient();
  const { count } = await s.from("v_webhook_endpoints" as never).select("*", { count: "exact", head: true }).eq("user_id", norm(userId));
  if ((count ?? 0) >= MAX_ENDPOINTS) return { error: `Max ${MAX_ENDPOINTS} webhooks.` };
  const secret = newSecret();
  const { data, error } = await s.from("v_webhook_endpoints" as never).insert({ user_id: norm(userId), url, secret } as never).select("id").single();
  if (error || !data) return { error: "create_failed" };
  return { id: (data as unknown as { id: string }).id, url, secret };
}

export type WebhookRow = { id: string; url: string; enabled: boolean; event_types: string[]; failure_count: number; last_success_at: string | null; last_failure_at: string | null; created_at: string };
export async function listWebhooks(userId: string): Promise<WebhookRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_webhook_endpoints" as never).select("id,url,enabled,event_types,failure_count,last_success_at,last_failure_at,created_at").eq("user_id", norm(userId)).order("created_at", { ascending: false });
  return (data as unknown as WebhookRow[]) ?? [];
}

export async function revealWebhookSecret(userId: string, id: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_webhook_endpoints" as never).select("secret").eq("id", id).eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as { secret: string } | null)?.secret ?? null;
}

export async function updateWebhook(userId: string, id: string, patch: { enabled?: boolean; url?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false };
  if (patch.url) { const e = webhookUrlError(patch.url); if (e) return { ok: false, error: e }; }
  const s = getSupabaseAdminClient();
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.enabled === "boolean") upd.enabled = patch.enabled;
  if (patch.url) upd.url = patch.url;
  const { data } = await s.from("v_webhook_endpoints" as never).update(upd as never).eq("id", id).eq("user_id", norm(userId)).select("id").maybeSingle();
  return { ok: !!data };
}

export async function rotateWebhookSecret(userId: string, id: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const secret = newSecret();
  const { data } = await s.from("v_webhook_endpoints" as never).update({ secret, updated_at: new Date().toISOString() } as never).eq("id", id).eq("user_id", norm(userId)).select("id").maybeSingle();
  return data ? secret : null;
}

export async function deleteWebhook(userId: string, id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getSupabaseAdminClient().from("v_webhook_endpoints" as never).delete().eq("id", id).eq("user_id", norm(userId));
}

export type DeliveryRow = { id: string; test_id: string | null; event: string; status: string; response_status: number | null; error: string | null; created_at: string };
export async function listDeliveries(userId: string, endpointId: string): Promise<DeliveryRow[]> {
  if (!isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data: ep } = await s.from("v_webhook_endpoints" as never).select("id").eq("id", endpointId).eq("user_id", norm(userId)).maybeSingle();
  if (!ep) return [];
  const { data } = await s.from("v_webhook_deliveries" as never).select("id,test_id,event,status,response_status,error,created_at").eq("endpoint_id", endpointId).order("created_at", { ascending: false }).limit(20);
  return (data as unknown as DeliveryRow[]) ?? [];
}

// ── Payload (no private fields) ──
function buildCompletedPayload(test: VTest, results: unknown, deliveryId: string) {
  const r = results as { total?: number; filtered?: number; winner_option_id?: string | null; ranked?: { id: string; position: number; pct: number }[] } | null;
  const winnerRow = r?.winner_option_id ? (r.ranked ?? []).find((x) => x.id === r.winner_option_id) : null;
  return {
    event: "test.completed",
    delivery_id: deliveryId,
    created_at: new Date().toISOString(),
    test: {
      id: test.id,
      title: test.title,
      status: "completed",
      completed_at: test.completed_at,
      votes_valid: r?.total ?? test.votes_valid,
      votes_filtered: r?.filtered ?? 0,
      winner: winnerRow ? { option: OPTION_LETTERS[winnerRow.position], pct: winnerRow.pct } : null,
      inconclusive: !!r && !r.winner_option_id,
    },
    links: {
      report_url: `${SITE}/app/tests/${test.id}/report`,
      public_report_url: test.share_enabled && test.share_token ? `${SITE}/r/${test.share_token}` : null,
      export_json: `${SITE}/api/v1/tests/${test.id}/export?format=json`,
      export_csv: `${SITE}/api/v1/tests/${test.id}/export?format=csv`,
    },
  };
}

async function post(url: string, secret: string, event: string, deliveryId: string, payload: unknown): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Vraelis-Webhooks/1", "X-Vraelis-Event": event, "X-Vraelis-Signature": sign(secret, ts, body), "X-Vraelis-Timestamp": ts, "X-Vraelis-Delivery": deliveryId },
      body,
      signal: ctrl.signal,
      redirect: "manual", // don't follow redirects (SSRF hardening)
    });
    clearTimeout(to);
    const ok = r.status >= 200 && r.status < 300;
    return { ok, status: r.status, error: ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    clearTimeout(to);
    return { ok: false, status: null, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

// Fired when a test completes. Never throws. Idempotent per (endpoint, test).
export async function deliverTestCompleted(testId: string): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    const td = await getTestWithOptions(testId);
    if (!td) return;
    const test = td.test;
    const s = getSupabaseAdminClient();
    const { data: eps } = await s.from("v_webhook_endpoints" as never).select("id,url,secret").eq("user_id", norm(test.user_id)).eq("enabled", true).contains("event_types", ["test.completed"]);
    const endpoints = (eps as unknown as { id: string; url: string; secret: string }[]) ?? [];
    if (!endpoints.length) return;
    const report = await getReport(testId);
    const results = report?.results ?? null;

    await Promise.allSettled(endpoints.map(async (ep) => {
      // Claim a delivery row (unique endpoint+test+event) — dedupes double-fires.
      const { data: del, error } = await s.from("v_webhook_deliveries" as never).insert({ endpoint_id: ep.id, test_id: testId, event: "test.completed", status: "pending" } as never).select("id").single();
      if (error || !del) return; // already delivered (unique conflict) or insert failed
      const deliveryId = (del as unknown as { id: string }).id;
      if (webhookUrlError(ep.url)) { await s.from("v_webhook_deliveries" as never).update({ status: "failed", error: "unsafe_url", attempts: 1 } as never).eq("id", deliveryId); return; }
      const payload = buildCompletedPayload(test, results, deliveryId);
      const res = await post(ep.url, ep.secret, "test.completed", deliveryId, payload);
      await s.from("v_webhook_deliveries" as never).update({ status: res.ok ? "success" : "failed", response_status: res.status, error: res.error, attempts: 1, payload, delivered_at: res.ok ? new Date().toISOString() : null } as never).eq("id", deliveryId);
      if (res.ok) await s.from("v_webhook_endpoints" as never).update({ last_success_at: new Date().toISOString(), failure_count: 0 } as never).eq("id", ep.id);
      else await s.from("v_webhook_endpoints" as never).update({ last_failure_at: new Date().toISOString() } as never).eq("id", ep.id);
    }));
  } catch (e) {
    console.error("deliverTestCompleted:", e);
  }
}

// Owner-triggered test ping (a sample payload, not a real test).
export async function sendTestEvent(userId: string, endpointId: string): Promise<{ ok: boolean; status?: number | null; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_webhook_endpoints" as never).select("url,secret").eq("id", endpointId).eq("user_id", norm(userId)).maybeSingle();
  const ep = data as unknown as { url: string; secret: string } | null;
  if (!ep) return { ok: false, error: "not_found" };
  if (webhookUrlError(ep.url)) return { ok: false, error: "unsafe_url" };
  const deliveryId = crypto.randomUUID();
  const payload = {
    event: "test.completed", delivery_id: deliveryId, created_at: new Date().toISOString(), test_event: true,
    test: { id: "test_example", title: "Example test", status: "completed", completed_at: new Date().toISOString(), votes_valid: 100, votes_filtered: 8, winner: { option: "B", pct: 67 }, inconclusive: false },
    links: { report_url: `${SITE}/app/tests/test_example/report`, public_report_url: null, export_json: `${SITE}/api/v1/tests/test_example/export?format=json`, export_csv: `${SITE}/api/v1/tests/test_example/export?format=csv` },
  };
  const res = await post(ep.url, ep.secret, "test.completed", deliveryId, payload);
  await s.from("v_webhook_deliveries" as never).insert({ endpoint_id: endpointId, test_id: null, event: "test.completed", status: res.ok ? "success" : "failed", response_status: res.status, error: res.error, attempts: 1, payload, delivered_at: res.ok ? new Date().toISOString() : null } as never);
  return { ok: res.ok, status: res.status, error: res.error ?? undefined };
}

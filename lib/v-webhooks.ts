// Vraelis webhooks — push test.completed events to API customers. The customer
// then pulls full results from the export endpoints. Payloads NEVER include owner
// email/user_id, API keys, billing, or raw ip/device data. Owner-scoped CRUD.

import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import { Agent } from "undici";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getTestWithOptions, getReport, OPTION_LETTERS, type VTest } from "./v-db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vraelis.com";
const MAX_ENDPOINTS = 10;
const DELIVERY_TIMEOUT_MS = 6000;

function norm(e: string): string { return e.trim().toLowerCase(); }
function newSecret(): string { return "whsec_" + crypto.randomBytes(24).toString("hex"); }

// True if an IP literal is private/reserved/loopback/link-local (incl. cloud
// metadata 169.254.169.254). Covers IPv4 ranges + IPv6 (loopback, ULA, link-local,
// and IPv4-mapped forms). Unknown → treated as unsafe.
export function isPrivateIp(ip: string): boolean {
  let addr = ip.trim().toLowerCase();
  if (addr.startsWith("::ffff:") && net.isIP(addr.slice(7)) === 4) addr = addr.slice(7); // IPv4-mapped
  const fam = net.isIP(addr);
  if (fam === 4) {
    const p = addr.split(".").map(Number);
    if (p.some((n) => Number.isNaN(n) || n > 255)) return true;
    return (
      p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||   // CGN 100.64/10
      (p[0] === 169 && p[1] === 254) ||                // link-local / metadata
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 0 && p[2] === 0) ||    // 192.0.0.0/24
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) || // 198.18.0.0/15 benchmarking
      p[0] >= 224                                      // multicast/reserved/broadcast
    );
  }
  if (fam === 6) {
    return addr === "::1" || addr === "::" || addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe8") || addr.startsWith("fe9") || addr.startsWith("fea") || addr.startsWith("feb");
  }
  return true;
}

// SSRF guard (create-time, string only — first line of defense). https only,
// port 443 only, no localhost/internal, no private IP literals. The real defense
// is safeFetch (DNS-resolve + validate + pin) at delivery time.
export function webhookUrlError(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return "Enter a valid URL."; }
  if (u.protocol !== "https:") return "Webhook URL must use https://.";
  if (u.port && u.port !== "443") return "Only port 443 is allowed.";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return "Public host required (no localhost/internal).";
  if (host.includes(":")) return "Use a public hostname, not an IPv6 literal.";
  if (net.isIP(host) === 4 && isPrivateIp(host)) return "Private/reserved IPs are not allowed.";
  return null;
}

// Resolve the hostname, reject if ANY resolved address is private/reserved, then
// pin the connection to the validated IP (no re-resolution → defeats DNS
// rebinding). Throws "blocked" on any unsafe destination. https + port 443 only.
async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "https:" || (u.port && u.port !== "443")) throw new Error("blocked");
  let addrs: { address: string; family: number }[];
  try { addrs = await dns.lookup(u.hostname, { all: true }); } catch { throw new Error("blocked"); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("blocked");
  const pin = addrs[0];
  const agent = new Agent({ connect: { lookup: (_h: string, _o: unknown, cb: (e: Error | null, a: string, f: number) => void) => cb(null, pin.address, pin.family) } as never });
  try {
    return await fetch(url, { ...init, dispatcher: agent } as RequestInit & { dispatcher: Agent });
  } finally {
    agent.close().catch(() => {});
  }
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
    const r = await safeFetch(url, {
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
    // Coarse errors only — never expose connection-level detail (no scan oracle).
    const msg = String((e as Error)?.message ?? "");
    const coarse = msg === "blocked" ? "blocked_url" : ctrl.signal.aborted ? "timeout" : "delivery_failed";
    return { ok: false, status: null, error: coarse };
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

// Vraelis webhooks — push verification.completed events to the owner's account-level
// endpoints. Signed (HMAC-SHA256), retry-queued, and owner-safe: the payload carries
// only the verification decision + flow counts + ids + a report link (the identical
// owner-safe shape built by buildVerificationPayload in lib/preflight/webhook-dispatch).
// NEVER owner email/user_id, API keys, billing, or raw ip/device data. Owner-scoped CRUD.
// Delivery fires from the run finalizer (worker/preflight/run-store-postgres.ts), the
// same source as the per-app connection webhooks; both carry the same owner-safe payload.

import crypto from "crypto";
import net from "net";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { isPrivateIp, safeFetch } from "./safe-fetch";
import { logEvent } from "./v-events";
import type { VerificationWebhookPayload } from "./preflight/webhook-dispatch";

const MAX_ENDPOINTS = 10;
const DELIVERY_TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 5;
// Delay before the next retry, indexed by attempts-so-far: 2m, 10m, 1h, 6h.
const BACKOFF_MS = [2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function norm(e: string): string { return e.trim().toLowerCase(); }
function newSecret(): string { return "whsec_" + crypto.randomBytes(24).toString("hex"); }

// When (ISO) the next retry is due, or null if the cap is reached.
function nextRetryAt(attempts: number): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return new Date(Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]).toISOString();
}
// Retry only transient failures. A bad/unsafe URL or a 4xx (non-429) won't fix
// itself — don't hammer it.
function isRetriable(res: { status: number | null; error: string | null }): boolean {
  if (res.error === "blocked_url" || res.error === "unsafe_url") return false;
  if (res.status && res.status >= 400 && res.status < 500 && res.status !== 429) return false;
  return true; // timeout, delivery_failed, 5xx, 429
}

// isPrivateIp + safeFetch now live in lib/safe-fetch.ts (shared with the SSO OIDC fetches).
// Re-export isPrivateIp so any external importer of this module keeps working.
export { isPrivateIp };

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
  const id = (data as unknown as { id: string }).id;
  await logEvent({ userId: norm(userId), eventType: "webhook_endpoint_created", actorType: "owner", source: "app", metadata: { endpoint_id: id } });
  return { id, url, secret };
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
  if (data) await logEvent({ userId: norm(userId), eventType: "webhook_endpoint_updated", actorType: "owner", source: "app", metadata: { endpoint_id: id, ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}), url_changed: !!patch.url } });
  return { ok: !!data };
}

export async function rotateWebhookSecret(userId: string, id: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const secret = newSecret();
  const { data } = await s.from("v_webhook_endpoints" as never).update({ secret, updated_at: new Date().toISOString() } as never).eq("id", id).eq("user_id", norm(userId)).select("id").maybeSingle();
  if (data) await logEvent({ userId: norm(userId), eventType: "webhook_secret_rotated", actorType: "owner", source: "app", metadata: { endpoint_id: id } });
  return data ? secret : null;
}

export async function deleteWebhook(userId: string, id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getSupabaseAdminClient().from("v_webhook_endpoints" as never).delete().eq("id", id).eq("user_id", norm(userId));
  await logEvent({ userId: norm(userId), eventType: "webhook_endpoint_deleted", actorType: "owner", source: "app", metadata: { endpoint_id: id } });
}

// Webhook reliability summary for an owner, aggregated from v_webhook_deliveries
// across all of the owner's endpoints. No secrets or payloads leave here.
export async function webhookStats(userId: string): Promise<{ endpoints: number; total: number; success: number; failed: number; retried: number; lastAt: string | null }> {
  const empty = { endpoints: 0, total: 0, success: 0, failed: 0, retried: 0, lastAt: null as string | null };
  if (!isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const { data: eps } = await s.from("v_webhook_endpoints" as never).select("id").eq("user_id", norm(userId));
    const ids = ((eps as unknown as { id: string }[]) ?? []).map((e) => e.id);
    if (!ids.length) return empty;
    const inIds = (q: ReturnType<typeof s.from>) => q.in("endpoint_id", ids);
    const head = () => inIds(s.from("v_webhook_deliveries" as never).select("*", { count: "exact", head: true }));
    const [tot, suc, fail, ret, last] = await Promise.all([
      head(),
      head().eq("status", "success"),
      head().eq("status", "failed"),
      head().gt("attempts", 1),
      inIds(s.from("v_webhook_deliveries" as never).select("created_at")).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return {
      endpoints: ids.length, total: tot.count ?? 0, success: suc.count ?? 0, failed: fail.count ?? 0,
      retried: ret.count ?? 0, lastAt: (last.data as unknown as { created_at: string } | null)?.created_at ?? null,
    };
  } catch { return empty; }
}

export type DeliveryRow = { id: string; test_id: string | null; event: string; status: string; response_status: number | null; error: string | null; attempts: number; created_at: string };
export async function listDeliveries(userId: string, endpointId: string): Promise<DeliveryRow[]> {
  if (!isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data: ep } = await s.from("v_webhook_endpoints" as never).select("id").eq("id", endpointId).eq("user_id", norm(userId)).maybeSingle();
  if (!ep) return [];
  const { data } = await s.from("v_webhook_deliveries" as never).select("id,test_id,event,status,response_status,error,attempts,created_at").eq("endpoint_id", endpointId).order("created_at", { ascending: false }).limit(20);
  return (data as unknown as DeliveryRow[]) ?? [];
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

// Fired when a verification finalizes: deliver the owner-safe verification.completed
// payload to the owner's account-level webhook endpoints (signed + retry-queued).
// Never throws. Idempotent per (endpoint, run) via the unique (endpoint_id, test_id,
// event) delivery row — the nullable test_id column holds the run id (uuid, no FK).
// event_types is not filtered here: verification.completed is now the only event, and
// legacy endpoints default to the '{test.completed}' subscription that no longer fires.
export async function deliverVerificationCompleted(userId: string, payload: VerificationWebhookPayload): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    const runId = payload.run_id;
    const s = getSupabaseAdminClient();
    const { data: eps } = await s.from("v_webhook_endpoints" as never).select("id,url,secret").eq("user_id", norm(userId)).eq("enabled", true);
    const endpoints = (eps as unknown as { id: string; url: string; secret: string }[]) ?? [];
    if (!endpoints.length) return;

    await Promise.allSettled(endpoints.map(async (ep) => {
      // Claim a delivery row (unique endpoint+run+event) — dedupes double-fires.
      const { data: del, error } = await s.from("v_webhook_deliveries" as never).insert({ endpoint_id: ep.id, test_id: runId, event: "verification.completed", status: "pending" } as never).select("id").single();
      if (error || !del) return; // already delivered (unique conflict) or insert failed
      const deliveryId = (del as unknown as { id: string }).id;
      if (webhookUrlError(ep.url)) { await s.from("v_webhook_deliveries" as never).update({ status: "failed", error: "unsafe_url", attempts: 1 } as never).eq("id", deliveryId); return; }
      const body = { ...payload, delivery_id: deliveryId };
      const res = await post(ep.url, ep.secret, "verification.completed", deliveryId, body);
      await s.from("v_webhook_deliveries" as never).update({ status: res.ok ? "success" : "failed", response_status: res.status, error: res.error, attempts: 1, payload: body, delivered_at: res.ok ? new Date().toISOString() : null } as never).eq("id", deliveryId);
      await logEvent({ userId, testId: null, eventType: res.ok ? "webhook_delivered" : "webhook_failed", actorType: "webhook", source: "webhook", metadata: { endpoint_id: ep.id, delivery_id: deliveryId, status_code: res.status, attempt: 1, event: "verification.completed", run_id: runId } });
      if (res.ok) await s.from("v_webhook_endpoints" as never).update({ last_success_at: new Date().toISOString(), failure_count: 0 } as never).eq("id", ep.id);
      else {
        await s.from("v_webhook_endpoints" as never).update({ last_failure_at: new Date().toISOString() } as never).eq("id", ep.id);
        // Schedule an auto-retry for transient failures. Separate, tolerant update:
        // next_retry_at may not exist until the retry migration runs (ignored if so).
        if (isRetriable(res)) { const nr = nextRetryAt(1); if (nr) await s.from("v_webhook_deliveries" as never).update({ next_retry_at: nr } as never).eq("id", deliveryId); }
      }
    }));
  } catch (e) {
    console.error("deliverVerificationCompleted:", e);
  }
}

// Re-attempt one failed delivery against its endpoint. Reuses the stored payload
// (same delivery_id → the customer can dedupe). Re-checks enabled + URL safety.
// `count` true increments attempts toward the auto-retry cap. Returns the result.
async function attemptRetry(s: ReturnType<typeof getSupabaseAdminClient>, del: { id: string; endpoint_id: string; event: string; attempts: number; payload: unknown }, ep: { id: string; url: string; secret: string; enabled: boolean }): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const now = () => new Date().toISOString();
  if (!ep.enabled) { await s.from("v_webhook_deliveries" as never).update({ next_retry_at: null } as never).eq("id", del.id); return { ok: false, status: null, error: "disabled" }; }
  if (webhookUrlError(ep.url)) { await s.from("v_webhook_deliveries" as never).update({ status: "failed", error: "unsafe_url", next_retry_at: null } as never).eq("id", del.id); return { ok: false, status: null, error: "unsafe_url" }; }
  const attempts = (del.attempts || 0) + 1;
  const res = await post(ep.url, ep.secret, del.event, del.id, del.payload);
  if (res.ok) {
    await s.from("v_webhook_deliveries" as never).update({ status: "success", response_status: res.status, error: null, attempts, delivered_at: now(), next_retry_at: null } as never).eq("id", del.id);
    await s.from("v_webhook_endpoints" as never).update({ last_success_at: now(), failure_count: 0 } as never).eq("id", ep.id);
  } else {
    await s.from("v_webhook_deliveries" as never).update({ status: "failed", response_status: res.status, error: res.error, attempts, next_retry_at: isRetriable(res) ? nextRetryAt(attempts) : null } as never).eq("id", del.id);
    await s.from("v_webhook_endpoints" as never).update({ last_failure_at: now() } as never).eq("id", ep.id);
  }
  return res;
}

// Sweep: re-send failed deliveries whose backoff has elapsed. Runs from the daily
// cron AND opportunistically after completions, so concurrent sweeps must not
// double-send — each row is claimed atomically (push next_retry_at forward; only
// the winning update sees it still-due) before re-posting. Never throws.
export async function runWebhookRetries(max = 100): Promise<{ processed: number; succeeded: number; gaveUp: number }> {
  const out = { processed: 0, succeeded: 0, gaveUp: 0 };
  try {
    if (!isDatabaseConfigured()) return out;
    const s = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await s.from("v_webhook_deliveries" as never)
      .select("id,endpoint_id,event,attempts,payload")
      .eq("status", "failed").lt("attempts", MAX_ATTEMPTS)
      .not("next_retry_at", "is", null).lte("next_retry_at", nowIso)
      .order("next_retry_at", { ascending: true }).limit(max);
    if (error) return out; // column/index absent (pre-migration) → no-op
    const due = (data as unknown as { id: string; endpoint_id: string; event: string; attempts: number; payload: unknown }[]) ?? [];
    for (const d of due) {
      // Claim: only one sweep can flip a still-due row; others match 0 rows + skip.
      const lockUntil = new Date(Date.now() + 2 * 60_000).toISOString();
      const { data: claim } = await s.from("v_webhook_deliveries" as never).update({ next_retry_at: lockUntil } as never).eq("id", d.id).eq("status", "failed").lte("next_retry_at", nowIso).select("id");
      if (!claim || (claim as unknown[]).length === 0) continue; // already claimed
      const { data: epRow } = await s.from("v_webhook_endpoints" as never).select("id,url,secret,enabled").eq("id", d.endpoint_id).maybeSingle();
      const ep = epRow as unknown as { id: string; url: string; secret: string; enabled: boolean } | null;
      if (!ep) { await s.from("v_webhook_deliveries" as never).update({ next_retry_at: null } as never).eq("id", d.id); continue; } // endpoint deleted
      out.processed++;
      const res = await attemptRetry(s, d, ep);
      if (res.ok) out.succeeded++;
      else if (!isRetriable(res) || (d.attempts || 0) + 1 >= MAX_ATTEMPTS) out.gaveUp++;
    }
  } catch (e) {
    console.error("runWebhookRetries:", e);
  }
  return out;
}

// Owner-triggered "retry now" for a single failed delivery (owner+endpoint scoped).
export async function retryDelivery(userId: string, endpointId: string, deliveryId: string): Promise<{ ok: boolean; status?: number | null; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const s = getSupabaseAdminClient();
  const { data: epRow } = await s.from("v_webhook_endpoints" as never).select("id,url,secret,enabled").eq("id", endpointId).eq("user_id", norm(userId)).maybeSingle();
  const ep = epRow as unknown as { id: string; url: string; secret: string; enabled: boolean } | null;
  if (!ep) return { ok: false, error: "not_found" };
  const { data: delRow } = await s.from("v_webhook_deliveries" as never).select("id,endpoint_id,event,attempts,payload").eq("id", deliveryId).eq("endpoint_id", endpointId).maybeSingle();
  const del = delRow as unknown as { id: string; endpoint_id: string; event: string; attempts: number; payload: unknown } | null;
  if (!del) return { ok: false, error: "not_found" };
  const res = await attemptRetry(s, del, ep);
  return { ok: res.ok, status: res.status, error: res.error ?? undefined };
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
    event: "verification.completed" as const, delivery_id: deliveryId, test_event: true,
    run_id: "sample_run", application_id: "sample_app", decision: "verified",
    flows_total: 5, flows_passed: 5, deployment_url: "https://demo.example.com",
    completed_at: new Date().toISOString(),
    report_url: "https://app.vraelis.com/applications/sample_app/passes/sample_run",
  };
  const res = await post(ep.url, ep.secret, "verification.completed", deliveryId, payload);
  await s.from("v_webhook_deliveries" as never).insert({ endpoint_id: endpointId, test_id: null, event: "verification.completed", status: res.ok ? "success" : "failed", response_status: res.status, error: res.error, attempts: 1, payload, delivered_at: res.ok ? new Date().toISOString() : null } as never);
  await logEvent({ userId: norm(userId), eventType: "webhook_test_sent", actorType: "owner", source: "app", metadata: { endpoint_id: endpointId, status_code: res.status ?? null } });
  return { ok: res.ok, status: res.status, error: res.error ?? undefined };
}

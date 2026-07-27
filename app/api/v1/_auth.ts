import { verifyApiKey } from "@/lib/v-api-keys";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { logEvent } from "@/lib/v-events";
import { allow } from "@/lib/vraelis-ratelimit";
import { apiError, requestId } from "./_lib";

// Per-key rate limit for the public API. Fail-open (the limiter allows if the DB
// RPC isn't present), so normal low-volume use is never blocked.
const RATE_LIMIT = 120;     // authenticated requests per key
// Coarse per-IP bound in FRONT of the key work (fail-open). Set well above the per-key cap
// so several keys behind one corporate NAT egress IP aren't throttled before their own
// limits; it exists only to blunt a single-IP flood of bogus keys (~20 req/s), not to pace
// legitimate use (the per-key limit does that).
const IP_RATE_LIMIT = 1200;
const RATE_WINDOW = 60;     // seconds

// Coarse endpoint group from the path + method — never the full (possibly
// id-bearing) URL, so the id/prefix never lands in v_events.
function endpointGroup(url: string, method = "GET"): string {
  try {
    const p = new URL(url).pathname;
    if (p.endsWith("/api/v1/check")) return "check";
    if (p.includes("/export")) return "tests.export";
    if (p.includes("/api/v1/keys/") && p.endsWith("/usage")) return "keys.usage";
    if (/\/api\/v1\/tests\/[^/]+$/.test(p)) return method === "PATCH" ? "tests.patch" : "tests.get";
    if (p.endsWith("/api/v1/tests")) return method === "POST" ? "tests.create" : "tests.list";
    if (p.includes("/api/v1/credits")) return "credits";
    return "other";
  } catch { return "other"; }
}

export type ApiAuth = { ok: true; userId: string; scopes: string[]; prefix: string } | { ok: false; response: Response };

// Authenticates an /api/v1 request and returns either the caller context or a
// ready-to-return standard error Response. Order: key → plan → rate limit → scope.
// `scope` (when given) must be present on the key (existing keys carry
// tests:write, tests:read, credits:read, so none are locked out).
export async function apiAuth(req: Request, scope?: string): Promise<ApiAuth> {
  const rid = requestId();

  // Coarse per-IP throttle BEFORE any key work. An invalid key returns before the per-key
  // limiter (which is keyed on a VALID key), so without this a flood of bogus keys would each
  // run an unmetered hash + key lookup. Fail-open, same as the per-key limiter.
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
  if (!(await allow(`v1ip:${ip}`, IP_RATE_LIMIT, RATE_WINDOW))) {
    return { ok: false, response: apiError("rate_limited", "Rate limit exceeded. Slow down and retry.", 429, rid, { "Retry-After": String(RATE_WINDOW), "X-RateLimit-Limit": String(IP_RATE_LIMIT) }) };
  }

  const key = req.headers.get("x-api-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return { ok: false, response: apiError("unauthorized", "Missing API key. Send it as X-Api-Key or Authorization: Bearer.", 401, rid) };

  const v = await verifyApiKey(key);
  if (!v) return { ok: false, response: apiError("unauthorized", "Invalid API key.", 401, rid) };

  const v1 = await getPlanV1State(v.userId.toLowerCase()).catch(() => null);
  if (!apiAccessAllowed(await getPlan(v.userId), v.userId, v1?.plan)) {
    return { ok: false, response: apiError("forbidden", "API access requires the Scale plan.", 403, rid) };
  }

  // Per-key fixed-window rate limit (keyed on the public prefix, never the secret).
  const underLimit = await allow(`v1:${v.prefix}`, RATE_LIMIT, RATE_WINDOW);
  if (!underLimit) {
    return { ok: false, response: apiError("rate_limited", `Rate limit of ${RATE_LIMIT} requests per ${RATE_WINDOW}s exceeded. Slow down and retry.`, 429, rid, { "Retry-After": String(RATE_WINDOW), "X-RateLimit-Limit": String(RATE_LIMIT) }) };
  }

  if (scope && !v.scopes.includes(scope)) {
    return { ok: false, response: apiError("forbidden", `This API key is missing the ${scope} scope.`, 403, rid) };
  }

  // API usage analytics — coarse group + method + public key prefix only.
  const group = endpointGroup(req.url, req.method);
  await logEvent({ userId: v.userId, eventType: "api_request_made", actorType: "api", source: "api", route: group, metadata: { method: req.method, endpoint: group, prefix: v.prefix } });
  return { ok: true, userId: v.userId, scopes: v.scopes, prefix: v.prefix };
}

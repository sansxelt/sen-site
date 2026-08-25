// Fixed-window rate limiting backed by Postgres (shared across all
// serverless instances). Fail-OPEN: if the DB/function is unavailable we
// allow the request rather than break the site, but we log it.
//
// Protects public endpoints from spam, bot floods, and AI-cost abuse.

import type { NextRequest } from "next/server";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { captureError } from "./vraelis-monitor";

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Returns true if the request is allowed, false if over the limit.
export async function allow(key: string, limit: number, windowSecs: number): Promise<boolean> {
  if (!isDatabaseConfigured()) return true;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("vraelis_rate_check" as never, {
      p_key: key,
      p_limit: limit,
      p_window_secs: windowSecs,
    } as never);
    if (error) {
      // Function not migrated yet, or transient error → fail open.
      captureError("ratelimit", error, { key });
      return true;
    }
    return data !== false;
  } catch (e) {
    captureError("ratelimit", e, { key });
    return true;
  }
}

// STRICT variant for expensive / abuse-sensitive endpoints (e.g. discovery, which crawls + makes a paid
// LLM call): FAIL CLOSED. Denies whenever the limiter cannot be consulted — DB unconfigured, RPC not
// migrated, or any error — so a limiter outage can never unlock unbounded paid work. Only returns true
// when the RPC explicitly confirms the request is under the limit.
export async function allowStrict(key: string, limit: number, windowSecs: number): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const { data, error } = await getSupabaseAdminClient().rpc("vraelis_rate_check" as never, { p_key: key, p_limit: limit, p_window_secs: windowSecs } as never);
    if (error) { captureError("ratelimit-strict", error, { key }); return false; }
    return data !== false;
  } catch (e) { captureError("ratelimit-strict", e, { key }); return false; }
}

// Convenience: build a key from route + IP and check it. Returns a 429
// Response when blocked, or null when allowed.
import { NextResponse } from "next/server";
export async function limitOr429(
  req: NextRequest,
  route: string,
  limit: number,
  windowSecs: number,
  cors?: Record<string, string>,
): Promise<NextResponse | null> {
  const ok = await allow(`${route}:${clientIp(req)}`, limit, windowSecs);
  if (ok) return null;
  return NextResponse.json(
    { ok: false, error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(windowSecs), ...(cors ?? {}) } },
  );
}

// READ a bucket without consuming it.
//
// The counting RPC increments on every call, which is right for "you used one" but wrong for "have you
// already used them all". The sign-in path needs the second question: it must refuse an exhausted mailbox
// WITHOUT charging the caller, because charging on a check is what turns a failure budget into a lockout —
// a legitimate owner's correct password would burn the same counter an attacker's wrong guesses filled.
//
// FAILS OPEN (returns true = "still allowed"). This is a read used to decide whether to do expensive work;
// the authoritative consume still happens on the failure path. Treating an unreadable counter as exhausted
// would deny sign-in to everyone during a database blip.
export async function peekAllowed(key: string, limit: number, windowSecs: number): Promise<boolean> {
  if (!isDatabaseConfigured()) return true;
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("vraelis_rate_limits" as never)
      .select("count, window_start")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return true;
    const row = data as unknown as { count: number | null; window_start: string | null };
    // A window that has rolled over is a fresh budget regardless of the stored count.
    const started = row.window_start ? new Date(row.window_start).getTime() : 0;
    if (!Number.isFinite(started) || Date.now() - started > windowSecs * 1000) return true;
    return (Number(row.count) || 0) < limit;
  } catch (e) {
    captureError("ratelimit-peek", e, { key });
    return true;
  }
}

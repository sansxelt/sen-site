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

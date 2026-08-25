// Session revocation for a JWT session strategy.
//
// THE PROBLEM. auth.ts uses `strategy: "jwt"`, so a session is a signed token the server does not store.
// Sign-out clears the cookie in the user's browser and nothing else; a token already copied elsewhere
// stays valid until it expires. Password reset had the same gap — changing the password did not end the
// sessions the old password had created, which is precisely backwards from what a user resetting a
// compromised password expects.
//
// THE TRADEOFF, STATED PLAINLY. Full server-side sessions would be the thorough fix, but that is a
// migration of the whole auth surface: every route that reads a session, the OAuth flows, the auto-signin
// token path, and the cookie that currently spans two hosts. This implements a token VERSION instead:
// each user has a counter, the counter is stamped into the token at sign-in, and a token whose stamp is
// behind the stored counter is refused. Bumping the counter invalidates every token issued before it.
//
// What that buys: sign-out, password reset, and administrative revocation all become real, immediately,
// for every device. What it does not buy: revoking ONE device while leaving the others signed in — a bump
// is all-or-nothing. That is the documented limitation, and it is the right trade for the risk being
// closed here.
//
// COST. A naive implementation reads the database on every request that touches a session. The cache
// below holds a version for CACHE_MS, so the worst case is one read per user per window, and the worst
// case for a revocation is that it takes effect up to CACHE_MS late. Sign-out and reset bump through
// bumpTokenVersion, which primes the cache with the new value, so the common paths are immediate.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

const CACHE_MS = 30_000;
const cache = new Map<string, { version: number; at: number }>();

const norm = (email: string) => email.trim().toLowerCase();

/**
 * The user's current token version. Returns 0 for a user with no row — the common case, and the value the
 * jwt callback stamps for them, so an untouched account never pays a write.
 *
 * FAIL OPEN, DELIBERATELY. If the table is missing or unreadable this returns the cached or default value
 * rather than throwing. The alternative — treating an unreadable revocation store as "revoke everything" —
 * would log every user out of the product on a transient database fault. Revocation is a containment
 * control layered on top of an already-authenticated, already-signed token, not the thing standing between
 * an attacker and the account.
 */
export async function currentTokenVersion(email: string): Promise<number> {
  const uid = norm(email);
  if (!uid) return 0;
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.version;
  if (!isDatabaseConfigured()) return hit?.version ?? 0;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s
      .from("v_session_revocation" as never)
      .select("token_version")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      // Pre-migration databases have no such table. Keep whatever we knew, do not lock anyone out.
      return hit?.version ?? 0;
    }
    const version = Number((data as unknown as { token_version?: number } | null)?.token_version ?? 0) || 0;
    cache.set(uid, { version, at: Date.now() });
    return version;
  } catch {
    return hit?.version ?? 0;
  }
}

/**
 * Invalidate every token issued for this user before now. Returns the new version, or null when it could
 * not be recorded — a caller that must guarantee revocation should surface that rather than assume success.
 */
export async function bumpTokenVersion(email: string, reason: string): Promise<number | null> {
  const uid = norm(email);
  if (!uid || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const current = await currentTokenVersion(uid);
    const next = current + 1;
    const { error } = await s
      .from("v_session_revocation" as never)
      .upsert({ user_id: uid, token_version: next, updated_at: new Date().toISOString(), last_reason: reason } as never, {
        onConflict: "user_id",
      } as never);
    if (error) {
      console.error("[session-revocation] bump failed:", error.message);
      return null;
    }
    // Prime the cache so the revocation is effective immediately on this instance, and let other instances
    // pick it up within CACHE_MS.
    cache.set(uid, { version: next, at: Date.now() });
    console.warn("[session-revocation] sessions invalidated for a user:", reason, `version=${next}`);
    return next;
  } catch (e) {
    console.error("[session-revocation] bump threw:", e);
    return null;
  }
}

/** True when a token carrying `stamped` is still current for this user. */
export async function tokenVersionIsCurrent(email: string, stamped: unknown): Promise<boolean> {
  const v = typeof stamped === "number" && Number.isFinite(stamped) ? stamped : 0;
  const current = await currentTokenVersion(email);
  return v >= current;
}

/** Test seam: drop the in-process cache. */
export function _resetTokenVersionCache(): void {
  cache.clear();
}

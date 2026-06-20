// Vraelis Rank — credit engine. The append-only ledger (v_credit_ledger) is the
// source of truth; balance is derived. Launching a test ESCROWS (holds) credits;
// unfilled credits are refunded on completion. Buyers only pay for valid votes.
//
// Idempotency: grants that carry an `extRef` (Stripe invoice/session id) are
// deduped by a partial unique index on (user_id, reason, ext_ref), so a replayed
// or raced webhook can never double-grant. Spends against the expiring "monthly"
// bucket are tagged with that bucket's expiry so they fall out of balance with
// the credits they consumed (no negative carry-over across a cycle reset).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { SIGNUP_FREE_CREDITS } from "./v-entitlements";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

type LedgerRow = { delta: number; bucket: string | null; expires_at: string | null; ext_ref: string | null };

// All ledger rows for a user that are not yet expired.
async function liveRows(userId: string): Promise<LedgerRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select("delta, bucket, expires_at, ext_ref")
    .eq("user_id", norm(userId));
  const rows = (data as unknown as LedgerRow[]) ?? [];
  const now = Date.now();
  return rows.filter((r) => r.expires_at === null || new Date(r.expires_at).getTime() > now);
}

export async function balance(userId: string): Promise<number> {
  const rows = await liveRows(userId);
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

type GrantOpts = { bucket?: string; expiresAt?: string | null; refType?: string; refId?: string; extRef?: string | null };

// Append a ledger row. Returns false if it was a duplicate (extRef already used)
// or failed — true on a fresh insert. Idempotent when extRef is provided.
export async function grant(userId: string, delta: number, reason: string, opts: GrantOpts = {}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_credit_ledger" as never).insert({
    user_id: norm(userId),
    delta,
    reason,
    bucket: opts.bucket ?? "purchased",
    expires_at: opts.expiresAt ?? null,
    ref_type: opts.refType ?? null,
    ref_id: opts.refId ?? null,
    ext_ref: opts.extRef ?? null,
  } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false; // already granted — idempotent no-op
    console.error("grant:", error.message);
    return false;
  }
  return true;
}

// One-time free credits for a brand-new account.
export async function ensureSignupGrant(userId: string): Promise<void> {
  if (!userId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  const { count } = await s
    .from("v_credit_ledger" as never)
    .select("*", { count: "exact", head: true })
    .eq("user_id", norm(userId))
    .eq("reason", "signup");
  if ((count ?? 0) > 0) return;
  await grant(userId, SIGNUP_FREE_CREDITS, "signup", { bucket: "purchased" });
}

// Escrow `amount` credits for a test launch. Returns false if insufficient.
// Spends the expiring monthly bucket first, tagging that portion of the debit
// with the monthly expiry so it expires alongside the credits it consumed.
export async function hold(userId: string, testId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const rows = await liveRows(userId);
  const bal = rows.reduce((s, r) => s + r.delta, 0);
  if (bal < amount) return false;

  const monthlyNet = rows.filter((r) => r.bucket === "monthly").reduce((s, r) => s + r.delta, 0);
  const monthlyExpiry = latestMonthlyExpiry(rows);
  const fromMonthly = Math.max(0, Math.min(amount, monthlyNet));
  const fromPurchased = amount - fromMonthly;

  if (fromMonthly > 0) await grant(userId, -fromMonthly, "hold", { bucket: "monthly", expiresAt: monthlyExpiry, refType: "test", refId: testId });
  if (fromPurchased > 0) await grant(userId, -fromPurchased, "hold", { bucket: "purchased", refType: "test", refId: testId });
  return true;
}

export async function refund(userId: string, testId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  // Refund into the monthly bucket (with its expiry) when one is active, so
  // unfilled monthly credits stay this-cycle and can't be laundered into
  // permanent credits; otherwise refund as purchased.
  const exp = latestMonthlyExpiry(await liveRows(userId));
  await grant(userId, amount, "refund", { bucket: exp ? "monthly" : "purchased", expiresAt: exp, refType: "test", refId: testId });
}

function latestMonthlyExpiry(rows: LedgerRow[]): string | null {
  return rows
    .filter((r) => r.bucket === "monthly" && r.delta > 0 && r.expires_at)
    .map((r) => r.expires_at as string)
    .sort()
    .pop() ?? null;
}

// Monthly subscription credits — the "monthly" bucket, expiring at the period
// end. extRef (the invoice id) makes the grant idempotent. The next cycle grants
// a fresh bucket; the old one expires (so monthly credits reset). Purchased
// top-up credits use the "purchased" bucket and persist.
export async function grantMonthly(userId: string, credits: number, expiresAt: string, extRef?: string): Promise<boolean> {
  if (credits <= 0) return false;
  return grant(userId, credits, "monthly_reset", { bucket: "monthly", expiresAt, extRef });
}

// Zero out the user's remaining (unspent) monthly bucket. `exceptExtRef` spares
// the rows from a specific invoice grant — so calling this right AFTER a fresh
// monthly grant clears only the PRIOR tier (mid-cycle plan change) and never the
// credits just granted. With no exception it clears all monthly (early/hard cancel).
export async function expireMonthly(userId: string, exceptExtRef?: string): Promise<void> {
  const rows = await liveRows(userId);
  const net = rows
    .filter((r) => r.bucket === "monthly" && (!exceptExtRef || r.ext_ref !== exceptExtRef))
    .reduce((s, r) => s + r.delta, 0);
  if (net > 0) await grant(userId, -net, "monthly_reset", { bucket: "monthly" });
}

// Count credits earned via vote-to-earn today (UTC) — used to cap farming.
export async function rewardsToday(userId: string): Promise<number> {
  if (!userId || !isDatabaseConfigured()) return 0;
  const s = getSupabaseAdminClient();
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select("delta")
    .eq("user_id", norm(userId))
    .eq("reason", "reward")
    .gte("created_at", since.toISOString());
  const rows = (data as unknown as { delta: number }[]) ?? [];
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

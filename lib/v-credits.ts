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

type LedgerRow = { delta: number; bucket: string | null; expires_at: string | null; ext_ref: string | null; reason?: string | null; ref_type?: string | null; ref_id?: string | null };

// All ledger rows for a user that are not yet expired.
async function liveRows(userId: string): Promise<LedgerRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select("delta, bucket, expires_at, ext_ref, reason, ref_type, ref_id")
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
  // ext_ref makes this atomic against a race: if two concurrent calls both pass the count
  // check, the second grant() hits the ext_ref unique constraint and no-ops (23505). The
  // count check above is just a fast path; the unique index is the real guard.
  await grant(userId, SIGNUP_FREE_CREDITS, "signup", { bucket: "purchased", extRef: `signup:${norm(userId)}` });
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
  const s = getSupabaseAdminClient();

  // Compatibility guard: older refunds used a single ext_ref `refund:<testId>`.
  // This function now writes split keys (`:p`/`:m`), which would NOT collide with a
  // pre-existing legacy row — so a test already refunded before this deploy could be
  // refunded twice. If the legacy row exists, this refund already happened; no-op.
  const { count: legacy } = await s.from("v_credit_ledger" as never)
    .select("*", { count: "exact", head: true })
    .eq("user_id", norm(userId)).eq("reason", "refund").eq("ext_ref", `refund:${testId}`);
  if ((legacy ?? 0) > 0) return;

  // Refund each escrowed credit back to the SAME bucket it was held from, so we
  // never mint permanent credit out of monthly credit. A monthly-sourced hold that
  // already expired with its cycle is simply gone — refunding it as purchased would
  // resurrect expired value as never-expiring credit (the laundering we prevent).
  const rows = await liveRows(userId);
  const held = rows.filter((r) => r.reason === "hold" && r.ref_type === "test" && r.ref_id === testId);
  // hold deltas are negative; live purchased hold magnitude = -sum(purchased holds).
  const purchasedHeld = -held.filter((r) => r.bucket === "purchased").reduce((sum, r) => sum + r.delta, 0);
  const exp = latestMonthlyExpiry(rows);

  const toPurchased = Math.min(amount, Math.max(0, purchasedHeld));
  const remainder = amount - toPurchased; // the monthly-sourced portion

  // extRef (split :p/:m) keeps each leg idempotent per test, so a completion race
  // can't refund twice.
  if (toPurchased > 0) {
    await grant(userId, toPurchased, "refund", { bucket: "purchased", refType: "test", refId: testId, extRef: `refund:${testId}:p` });
  }
  // Only refund the monthly remainder if a live monthly bucket still exists to hold
  // it (with that bucket's expiry). If the cycle already ended, the held monthly
  // credit expired — drop it rather than converting it to permanent credit.
  if (remainder > 0 && exp) {
    await grant(userId, remainder, "refund", { bucket: "monthly", expiresAt: exp, refType: "test", refId: testId, extRef: `refund:${testId}:m` });
  }
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
//
// `clawbackRef` makes the -net debit idempotent (ledger ext_ref unique index):
// Stripe is at-least-once and Vercel runs webhooks concurrently, so a redelivered
// or raced cancel/invoice event could otherwise read the same `net` twice and
// double-debit (spilling past the monthly bucket into paid purchased credits).
// Callers pass a key that is STABLE across redeliveries of the same termination
// (e.g. cancel:<subscription_id>) so the second delivery hits 23505 and no-ops.
export async function expireMonthly(userId: string, exceptExtRef?: string, clawbackRef?: string): Promise<void> {
  const rows = await liveRows(userId);
  const net = rows
    .filter((r) => r.bucket === "monthly" && (!exceptExtRef || r.ext_ref !== exceptExtRef))
    .reduce((s, r) => s + r.delta, 0);
  if (net > 0) await grant(userId, -net, "monthly_reset", { bucket: "monthly", extRef: clawbackRef });
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

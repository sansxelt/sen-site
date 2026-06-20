// Vraelis Rank — credit engine. The append-only ledger (v_credit_ledger) is the
// source of truth; balance is derived. Launching a test ESCROWS (holds) credits;
// unfilled credits are refunded on completion. Buyers only pay for valid votes.
//
// NOTE (MVP): balance-check-then-insert has a small race under high concurrency.
// Fine for launch volume; harden with a Postgres function/transaction later.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { SIGNUP_FREE_CREDITS } from "./v-entitlements";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

export async function balance(userId: string): Promise<number> {
  if (!userId || !isDatabaseConfigured()) return 0;
  const s = getSupabaseAdminClient();
  const { data } = await s
    .from("v_credit_ledger" as never)
    .select("delta, expires_at")
    .eq("user_id", norm(userId));
  const rows = (data as unknown as { delta: number; expires_at: string | null }[]) ?? [];
  const now = Date.now();
  return rows.reduce(
    (sum, r) => sum + (r.expires_at === null || new Date(r.expires_at).getTime() > now ? r.delta : 0),
    0,
  );
}

export async function grant(
  userId: string,
  delta: number,
  reason: string,
  opts: { bucket?: string; expiresAt?: string | null; refType?: string; refId?: string } = {},
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  await s.from("v_credit_ledger" as never).insert({
    user_id: norm(userId),
    delta,
    reason,
    bucket: opts.bucket ?? "purchased",
    expires_at: opts.expiresAt ?? null,
    ref_type: opts.refType ?? null,
    ref_id: opts.refId ?? null,
  } as never);
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
export async function hold(userId: string, testId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const bal = await balance(userId);
  if (bal < amount) return false;
  await grant(userId, -amount, "hold", { refType: "test", refId: testId });
  return true;
}

export async function refund(userId: string, testId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await grant(userId, amount, "refund", { refType: "test", refId: testId });
}

// Monthly subscription credits — the "monthly" bucket, expiring at the period
// end. The next cycle grants a fresh bucket; the old one expires (so monthly
// credits reset). Purchased top-up credits use the "purchased" bucket and persist.
export async function grantMonthly(userId: string, credits: number, expiresAt: string): Promise<void> {
  if (credits <= 0) return;
  await grant(userId, credits, "monthly_reset", { bucket: "monthly", expiresAt });
}

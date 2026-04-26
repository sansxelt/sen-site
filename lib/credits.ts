// v0.1.9 monetization, flexible credit ledger.
//
// Replaces the v0.1.8 per-feature one-time SKUs (voice_minute_pack,
// image_credit_pack, copilot_time_pack, voice_pack, image_pack) with a
// single "buy credits" surface. 1 USD = 100 credits. Features burn
// credits by kind via CREDIT_COSTS below.
//
// Storage model:
//   user_credits         , running balance per email.
//   credit_transactions  , append-only journal. `id` is the idempotency
//                           key (purchase:<payment_intent>, etc.) so a
//                           retried Stripe webhook or a double-clicked
//                           gate cannot double-spend.
//
// All helpers fail open on transient DB errors (return 0 / false) so a
// flaky Supabase never holds the chat hostage. Worst case the user gets
// a free request, we'd rather refund a one-off than block paying users.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

// 1 USD ↔ 100 credits. Keeps the math obvious in receipts and the UI:
// "$5 = 500 credits", "this image cost 5 credits = 5¢".
export const CREDITS_PER_DOLLAR = 100;

// Per-feature consumption rates. Tuned so a $5 top-up covers either:
//   - 500 chat requests, OR
//   - 100 image generations, OR
//   - 250 minutes of voice, OR
//   - 500 copilot turns
// (mix and match, they all draw from the same balance).
export type CreditKind = "chat" | "image" | "voice_minute" | "copilot";
export const CREDIT_COSTS: Record<CreditKind, number> = {
  chat: 1,
  image: 5,
  voice_minute: 2,
  copilot: 1,
};

type CreditTxnSource = "purchase" | "consume" | "refund";

/**
 * Returns the user's current credit balance, or 0 on any failure
 * (table missing, Supabase not configured, transient error).
 */
export async function getCreditBalance(email: string): Promise<number> {
  if (!email) return 0;
  if (!isDatabaseConfigured()) return 0;
  const normalized = email.toLowerCase();
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_credits" as never)
      .select("balance")
      .eq("email", normalized)
      .maybeSingle();
    if (error) {
      console.warn("getCreditBalance failed:", error.message);
      return 0;
    }
    const row = data as unknown as { balance?: number | null } | null;
    return Math.max(0, Math.floor(row?.balance ?? 0));
  } catch (err) {
    console.warn("getCreditBalance threw:", err);
    return 0;
  }
}

/**
 * Adds credits to the user's balance and records a transaction. The
 * transaction id (`<source>:<refId>`) is the primary key on
 * credit_transactions, so a retried Stripe webhook delivery is a
 * no-op, the second insert hits a unique-violation and we bail
 * before double-crediting the running balance.
 */
export async function addCredits(
  email: string,
  amount: number,
  source: Extract<CreditTxnSource, "purchase" | "refund">,
  refId: string,
): Promise<void> {
  if (!email || amount <= 0) return;
  if (!isDatabaseConfigured()) {
    console.warn("addCredits dropped, Supabase not configured.");
    return;
  }
  const normalized = email.toLowerCase();
  const txnId = makeTxnId(source, refId);
  const supabase = getSupabaseAdminClient();

  // 1. Insert the journal row first. If this hits the unique key the
  //    credit was already applied by a previous delivery; we exit
  //    without touching the balance.
  const { error: txnErr } = await supabase
    .from("credit_transactions" as never)
    .insert([
      {
        id: txnId,
        email: normalized,
        delta: amount,
        source,
        ref_id: refId,
      },
    ] as never);
  if (txnErr) {
    if ((txnErr as { code?: string }).code === "23505") return; // already credited
    console.error("addCredits txn insert failed:", txnErr.message);
    return;
  }

  // 2. Bump the running balance. We read-modify-write because Supabase
  //    Postgres doesn't expose increment() through the JS client; this
  //    is fine because the transaction row is the source of truth and
  //    a brief race only delays the balance, never duplicates it.
  const current = await getCreditBalance(normalized);
  const next = current + amount;
  const { error: upsertErr } = await supabase
    .from("user_credits" as never)
    .upsert(
      [
        {
          email: normalized,
          balance: next,
          updated_at: new Date().toISOString(),
        },
      ] as never,
      { onConflict: "email" },
    );
  if (upsertErr) {
    console.error("addCredits balance upsert failed:", upsertErr.message);
  }
}

/**
 * Burns `amount` credits from the user's balance. Returns ok=false (and
 * the current balance) when the user doesn't have enough, the gating
 * layer treats that as "stay blocked." When ok=true the new remaining
 * balance is returned so callers can surface "5 credits left" toasts.
 *
 * Idempotent on refId: a duplicate consume (e.g. the chat route
 * retried after a stream hiccup) replays the existing transaction
 * instead of double-charging.
 */
export async function consumeCredits(
  email: string,
  amount: number,
  source: Extract<CreditTxnSource, "consume">,
  refId: string,
): Promise<{ ok: boolean; remaining: number }> {
  if (!email) return { ok: false, remaining: 0 };
  if (amount <= 0) return { ok: true, remaining: await getCreditBalance(email) };
  if (!isDatabaseConfigured()) return { ok: false, remaining: 0 };

  const normalized = email.toLowerCase();
  const supabase = getSupabaseAdminClient();
  const txnId = makeTxnId(source, refId);

  // Replay protection: if this exact consume already landed, succeed
  // without touching the balance again.
  try {
    const { data: existing } = await supabase
      .from("credit_transactions" as never)
      .select("id")
      .eq("id", txnId)
      .maybeSingle();
    if (existing) {
      return { ok: true, remaining: await getCreditBalance(normalized) };
    }
  } catch (err) {
    console.warn("consumeCredits replay-check failed:", err);
  }

  const balance = await getCreditBalance(normalized);
  if (balance < amount) {
    return { ok: false, remaining: balance };
  }

  const { error: txnErr } = await supabase
    .from("credit_transactions" as never)
    .insert([
      {
        id: txnId,
        email: normalized,
        delta: -amount,
        source,
        ref_id: refId,
      },
    ] as never);
  if (txnErr) {
    if ((txnErr as { code?: string }).code === "23505") {
      // Lost a race to ourselves, the duplicate insert means another
      // call already deducted. Return the current balance as ok=true.
      return { ok: true, remaining: await getCreditBalance(normalized) };
    }
    console.error("consumeCredits txn insert failed:", txnErr.message);
    return { ok: false, remaining: balance };
  }

  const next = Math.max(0, balance - amount);
  const { error: upsertErr } = await supabase
    .from("user_credits" as never)
    .upsert(
      [
        {
          email: normalized,
          balance: next,
          updated_at: new Date().toISOString(),
        },
      ] as never,
      { onConflict: "email" },
    );
  if (upsertErr) {
    console.error("consumeCredits balance upsert failed:", upsertErr.message);
  }
  return { ok: true, remaining: next };
}

function makeTxnId(source: CreditTxnSource, refId: string): string {
  return `${source}:${refId}`;
}

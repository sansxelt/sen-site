// Vraelis Rank — data access (Supabase service-role). Scoped by user_id in code.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }

// THE ONE PLACE AN ACCOUNT COMES INTO EXISTENCE, which is why the signup event is recorded here and not in
// the sign-up routes. There are several ways to arrive (email and password, the OAuth providers, an
// invite, domain auto-join) and every one of them lands on this call. Instrumenting the routes instead
// would have meant four call sites to keep in step and a fifth one missed the next time a way in is added.
//
// ignoreDuplicates makes this an upsert that does nothing on conflict, so asking for the inserted rows back
// is a reliable first-creation signal: a returning row means the account did not exist a moment ago, and an
// empty result means this was one of the many calls that just re-assert an existing profile.
export async function ensureProfile(userId: string, displayName?: string): Promise<void> {
  if (!userId || !isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_profiles" as never).upsert(
    { user_id: norm(userId), display_name: displayName ?? null } as never,
    { onConflict: "user_id", ignoreDuplicates: true } as never,
  ).select("user_id");
  const created = Array.isArray(data) && data.length > 0;
  if (!created) return;
  // Imported lazily so this module keeps its current import graph: v-db is pulled into a lot of request
  // paths and the event writer is only needed on the rare call that actually creates something.
  const [{ logEvent }, { EV_SIGNUP }] = await Promise.all([import("./v-events"), import("./funnel")]);
  await logEvent({ userId: norm(userId), eventType: EV_SIGNUP, actorType: "owner", source: "app" });
}

export async function getPlan(userId: string): Promise<string> {
  if (!userId || !isDatabaseConfigured()) return "free";
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_subscriptions" as never).select("plan,status").eq("user_id", norm(userId)).maybeSingle();
  const r = data as unknown as { plan: string; status: string } | null;
  // past_due keeps the tier during Stripe's dunning/retry grace (credits simply
  // don't refresh); only a true cancellation drops to free.
  return r && (r.status === "active" || r.status === "past_due") ? r.plan : "free";
}

// Credit pack purchase — deduped by Stripe session id so a webhook retry can't
// double-grant. Returns true only on the first (fresh) processing.
export async function recordPackPurchase(userId: string, sku: string, credits: number, stripeId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  // Insert-first dedup: the unique index on v_payments(stripe_id) makes this
  // atomic, so concurrent/retried deliveries can't both pass (23505 = already done).
  const { error } = await s.from("v_payments" as never).insert({ user_id: norm(userId), stripe_id: stripeId, kind: "credit_pack", sku, credits, status: "paid" } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("recordPackPurchase:", error.message);
    return false;
  }
  return true;
}

export type VSubscription = { user_id: string; plan: string; status: string; cycle: string | null; stripe_subscription_id: string | null; monthly_credits: number; current_period_end: string | null };

export async function setSubscription(args: {
  userId: string; plan: string; status: string; cycle?: string | null;
  stripeSubscriptionId?: string | null; monthlyCredits?: number; currentPeriodEnd?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const s = getSupabaseAdminClient();
  await s.from("v_subscriptions" as never).upsert({
    user_id: norm(args.userId), plan: args.plan, status: args.status,
    cycle: args.cycle ?? null, stripe_subscription_id: args.stripeSubscriptionId ?? null,
    monthly_credits: args.monthlyCredits ?? 0, current_period_end: args.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "user_id" } as never);
}

export async function getSubscription(userId: string): Promise<VSubscription | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_subscriptions" as never).select("*").eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as VSubscription) ?? null;
}

// Record a subscription-invoice payment, deduped by Stripe invoice id via the
// unique index on v_payments(stripe_id) (insert-first; 23505 = already recorded).
// This is the payment audit row — the credit grant itself is separately made
// idempotent via the ledger ext_ref.
export async function recordInvoiceGrant(userId: string, plan: string, credits: number, invoiceId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_payments" as never).insert({ user_id: norm(userId), stripe_id: invoiceId, kind: "subscription", sku: plan, credits, status: "paid" } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("recordInvoiceGrant:", error.message);
    return false;
  }
  return true;
}

export async function listRecentLedger(userId: string, limit = 12): Promise<{ delta: number; reason: string; created_at: string }[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_credit_ledger" as never).select("delta,reason,created_at").eq("user_id", norm(userId)).order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as { delta: number; reason: string; created_at: string }[]) ?? [];
}

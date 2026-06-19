// Flip Engine — Supabase (service-role) data access. Reuses the existing
// admin client (lib/supabase-admin); every call is scoped by user_id / anon_id.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import type { FlipListing } from "./flip-ai";

export const FLIP_FREE_SIGNED_IN = 3;
export const FLIP_FREE_ANON = 1;

export type FlipAccount = {
  user_id: string;
  plan: string;
  plan_status: string;
  free_used: number;
  stripe_customer_id: string | null;
};

const ACCOUNT_COLS = "user_id, plan, plan_status, free_used, stripe_customer_id";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

export async function getOrCreateFlipAccount(userId: string): Promise<FlipAccount | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const id = norm(userId);
  try {
    const existing = await supabase
      .from("flip_accounts" as never)
      .select(ACCOUNT_COLS)
      .eq("user_id", id)
      .maybeSingle();
    if (existing.data) return existing.data as unknown as FlipAccount;

    const inserted = await supabase
      .from("flip_accounts" as never)
      .insert({ user_id: id } as never)
      .select(ACCOUNT_COLS)
      .single();
    if (inserted.error) {
      // Likely a concurrent insert — re-read the winning row.
      const reread = await supabase
        .from("flip_accounts" as never)
        .select(ACCOUNT_COLS)
        .eq("user_id", id)
        .maybeSingle();
      return (reread.data as unknown as FlipAccount) ?? null;
    }
    return inserted.data as unknown as FlipAccount;
  } catch (e) {
    console.error("getOrCreateFlipAccount failed:", e);
    return null;
  }
}

export async function incrementFreeUsed(userId: string): Promise<void> {
  if (!userId || !isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const id = norm(userId);
  // No atomic increment without an RPC; read-modify-write is fine at this scale.
  const { data } = await supabase
    .from("flip_accounts" as never)
    .select("free_used")
    .eq("user_id", id)
    .maybeSingle();
  const cur = (data as unknown as { free_used: number } | null)?.free_used ?? 0;
  await supabase
    .from("flip_accounts" as never)
    .update({ free_used: cur + 1 } as never)
    .eq("user_id", id);
}

export async function countAnonItems(anonId: string): Promise<number> {
  if (!anonId || !isDatabaseConfigured()) return 0;
  const supabase = getSupabaseAdminClient();
  const { count } = await supabase
    .from("flip_items" as never)
    .select("*", { count: "exact", head: true })
    .eq("anon_id", anonId);
  return count ?? 0;
}

export async function insertFlipItem(args: {
  userId?: string | null;
  anonId?: string | null;
  listing: FlipListing;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const l = args.listing;
  const detected = {
    item_type: l.item_type,
    brand: l.brand,
    model: l.model,
    colorway: l.colorway,
    size: l.size,
    condition_grade: l.condition_grade,
    condition_notes: l.condition_notes,
    key_features: l.key_features,
    visible_flaws: l.visible_flaws,
    measurements_to_take: l.measurements_to_take,
    category: l.category,
  };
  const generated = {
    titles: l.titles,
    description: l.description,
    keywords: l.keywords,
    hashtags: l.hashtags,
  };
  const { data, error } = await supabase
    .from("flip_items" as never)
    .insert({
      user_id: args.userId ? norm(args.userId) : null,
      anon_id: args.anonId ?? null,
      detected,
      generated,
      suggested_price: l.price,
    } as never)
    .select("id")
    .single();
  if (error) {
    console.error("insertFlipItem failed:", error.message);
    return null;
  }
  return (data as unknown as { id: string }).id;
}

// Used by the Stripe webhook to flip a user to/from Pro.
export async function setFlipPlan(args: {
  userId?: string | null;
  stripeCustomerId?: string | null;
  plan: string;
  planStatus: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { plan: args.plan, plan_status: args.planStatus };
  if (args.stripeCustomerId) patch.stripe_customer_id = args.stripeCustomerId;
  try {
    if (args.userId) {
      const id = norm(args.userId);
      await getOrCreateFlipAccount(id); // ensure the row exists
      await supabase.from("flip_accounts" as never).update(patch as never).eq("user_id", id);
      return;
    }
    if (args.stripeCustomerId) {
      await supabase
        .from("flip_accounts" as never)
        .update({ plan: args.plan, plan_status: args.planStatus } as never)
        .eq("stripe_customer_id", args.stripeCustomerId);
    }
  } catch (e) {
    console.error("setFlipPlan failed:", e);
  }
}

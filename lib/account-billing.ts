import { getSupabaseAdminClient } from "./supabase-admin";
import type { PlanKey } from "./ai-models";

export type SubscriptionRecord = {
  email: string;
  plan_key: PlanKey;
  billing_cycle: "monthly" | "yearly";
  status: string;
  seat_count: number;
  current_period_end: string | null;
};

// Returns the user's current plan key. Defaults to "free" when there's
// no subscription row, the column is missing, or the lookup fails, we
// never want a transient DB hiccup to grant unintended access.
export async function getPlanForEmail(email: string): Promise<PlanKey> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("account_subscriptions" as never)
      .select("plan_key")
      .eq("email", email)
      .maybeSingle();
    const row = data as { plan_key?: PlanKey } | null;
    return row?.plan_key ?? "free";
  } catch (err) {
    console.warn("getPlanForEmail fallback to free:", err);
    return "free";
  }
}

export async function getSubscriptionForEmail(
  email: string,
): Promise<SubscriptionRecord | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("account_subscriptions" as never)
      .select(
        "email, plan_key, billing_cycle, status, seat_count, current_period_end",
      )
      .eq("email", email)
      .maybeSingle();
    return (data as unknown as SubscriptionRecord) ?? null;
  } catch (err) {
    console.warn("getSubscriptionForEmail failed:", err);
    return null;
  }
}

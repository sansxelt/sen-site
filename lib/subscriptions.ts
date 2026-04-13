import { cache } from "react";
import {
  type BillingCycle,
  getDefaultPricingSnapshot,
  getPricingPlan,
  type PricingPlanKey,
  type PricingSnapshot,
  type SubscriptionStatus,
} from "./pricing";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type SubscriptionRecord = {
  billing_cycle: BillingCycle;
  created_at: string;
  current_period_end: string | null;
  email: string;
  enterprise_verified_business: boolean;
  plan_key: PricingPlanKey;
  seat_count: number;
  status: SubscriptionStatus;
  updated_at: string;
};

type SubscriptionSelectionInput = {
  billingCycle?: BillingCycle;
  planKey: PricingPlanKey;
  seatCount?: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === "yearly" || value === "custom" ? value : "monthly";
}

function normalizePlanKey(value: unknown): PricingPlanKey {
  if (
    value === "apprentice" ||
    value === "studio" ||
    value === "pro" ||
    value === "teams" ||
    value === "enterprise"
  ) {
    return value;
  }

  return "free";
}

function normalizeStatus(value: unknown): SubscriptionStatus {
  if (
    value === "selection_pending" ||
    value === "active" ||
    value === "contact_required" ||
    value === "canceled"
  ) {
    return value;
  }

  return "free";
}

function normalizeSeatCount(value: unknown, planKey: PricingPlanKey) {
  const parsed = typeof value === "number" ? value : Number(value);
  const fallback = planKey === "teams" ? 3 : 1;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.max(Math.floor(parsed), fallback);
  return planKey === "teams" ? Math.max(normalized, 3) : 1;
}

function normalizeSubscriptionRecord(
  data: Partial<SubscriptionRecord> & { email: string },
) {
  const planKey = normalizePlanKey(data.plan_key);

  return {
    billing_cycle: normalizeBillingCycle(data.billing_cycle),
    created_at:
      typeof data.created_at === "string"
        ? data.created_at
        : new Date().toISOString(),
    current_period_end:
      typeof data.current_period_end === "string"
        ? data.current_period_end
        : null,
    email: normalizeEmail(data.email),
    enterprise_verified_business: Boolean(data.enterprise_verified_business),
    plan_key: planKey,
    seat_count: normalizeSeatCount(data.seat_count, planKey),
    status: normalizeStatus(data.status),
    updated_at:
      typeof data.updated_at === "string"
        ? data.updated_at
        : new Date().toISOString(),
  } satisfies SubscriptionRecord;
}

export function readPricingSnapshot(
  subscription: SubscriptionRecord | null,
): PricingSnapshot {
  if (!subscription) {
    return getDefaultPricingSnapshot();
  }

  const plan = getPricingPlan(subscription.plan_key);

  return {
    billingCycle: subscription.billing_cycle,
    monthlyLabel: plan.monthlyLabel,
    plan,
    seatCount: subscription.seat_count,
    status: subscription.status,
  };
}

export const getSubscriptionByEmail = cache(async function getSubscriptionByEmail(
  email: string | null | undefined,
) {
  if (!email || !isDatabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("account_subscriptions" as never)
      .select(
        "billing_cycle, created_at, current_period_end, email, enterprise_verified_business, plan_key, seat_count, status, updated_at",
      )
      .eq("email", normalizeEmail(email))
      .maybeSingle();

    if (error) {
      console.error("Subscription lookup failed:", error);
      return null;
    }

    return data ? normalizeSubscriptionRecord(data) : null;
  } catch (error) {
    console.error("Subscription lookup threw:", error);
    return null;
  }
});

export async function upsertActiveSubscription(input: {
  email: string;
  planKey: string;
  billingCycle: string;
  currentPeriodEnd: number | null; // unix timestamp from Stripe
  stripeStatus: string; // Stripe subscription status
}) {
  const planKey = normalizePlanKey(input.planKey);
  const billingCycle = normalizeBillingCycle(input.billingCycle);

  const isActive = input.stripeStatus === "active" || input.stripeStatus === "trialing";
  const isCanceled =
    input.stripeStatus === "canceled" ||
    input.stripeStatus === "unpaid" ||
    input.stripeStatus === "incomplete_expired";

  const status: SubscriptionStatus = isActive
    ? "active"
    : isCanceled
    ? "canceled"
    : "selection_pending";

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  const payload = {
    email: normalizeEmail(input.email),
    plan_key: isActive ? planKey : "free",
    billing_cycle: billingCycle,
    status,
    current_period_end: input.currentPeriodEnd
      ? new Date(input.currentPeriodEnd * 1000).toISOString()
      : null,
    enterprise_verified_business: false,
    seat_count: normalizeSeatCount(1, planKey),
    updated_at: now,
  };

  const { error } = await supabase
    .from("account_subscriptions" as never)
    .upsert(payload as never, { onConflict: "email" });

  if (error) {
    console.error("[subscriptions] upsertActiveSubscription failed:", error);
    throw error;
  }
}

export async function upsertSubscriptionSelection(
  email: string,
  input: SubscriptionSelectionInput,
) {
  const plan = getPricingPlan(input.planKey);
  const billingCycle =
    input.planKey === "enterprise"
      ? "custom"
      : input.billingCycle === "yearly"
        ? "yearly"
        : "monthly";
  const seatCount = normalizeSeatCount(input.seatCount, input.planKey);
  const status: SubscriptionStatus =
    input.planKey === "free"
      ? "free"
      : input.planKey === "enterprise"
        ? "contact_required"
        : "selection_pending";
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  const payload = {
    billing_cycle: billingCycle,
    email: normalizeEmail(email),
    enterprise_verified_business: false,
    plan_key: plan.key,
    seat_count: seatCount,
    status,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("account_subscriptions" as never)
    .upsert(payload as never, {
      onConflict: "email",
    })
    .select(
      "billing_cycle, created_at, current_period_end, email, enterprise_verified_business, plan_key, seat_count, status, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeSubscriptionRecord(data);
}


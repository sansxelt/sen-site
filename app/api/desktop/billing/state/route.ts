import { NextResponse } from "next/server";
import { getSubscriptionForEmail, getPlanForEmail } from "../../../../../lib/account-billing";
import { getBillingState } from "../../../../../lib/billing-state";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { billingAddons, pricingPlanMap, pricingPlans } from "../../../../../lib/pricing";
import { getStripePublishableKey, isStripeConfigured } from "../../../../../lib/stripe";

export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    const stripeConfigured = isStripeConfigured();
    const [planKey, subscription, billingState] = await Promise.all([
      getPlanForEmail(normalizedEmail),
      getSubscriptionForEmail(normalizedEmail),
      stripeConfigured ? getBillingState(normalizedEmail) : Promise.resolve(null),
    ]);

    const currentPlan = pricingPlanMap[planKey] ?? pricingPlanMap.free;

    return NextResponse.json({
      stripeConfigured,
      publishableKey: getStripePublishableKey(),
      currentPlanKey: currentPlan.key,
      currentPlanName: currentPlan.name,
      currentPlanDescription: currentPlan.description,
      currentPlanMemoryWindow: currentPlan.memoryWindow,
      currentPlanMonthlyCredits: currentPlan.monthlyCredits,
      currentPlanApiRequestLimit: currentPlan.apiRequestLimit,
      subscription: subscription
        ? {
            status: subscription.status,
            billingCycle: subscription.billing_cycle,
            seatCount: subscription.seat_count,
            currentPeriodEnd: subscription.current_period_end,
          }
        : null,
      state: {
        cancelAtPeriodEnd: billingState?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd:
          billingState?.currentPeriodEnd ?? subscription?.current_period_end ?? null,
        cycle: billingState?.cycle ?? subscription?.billing_cycle ?? null,
        invoices: billingState?.invoices ?? [],
        paymentMethod: billingState?.paymentMethod ?? null,
        planKey: billingState?.plan?.key ?? currentPlan.key,
        status: billingState?.status ?? subscription?.status ?? null,
        activeAddons:
          billingState?.activeAddons.map(({ addon, itemId }) => ({
            addon: {
              key: addon.key,
              name: addon.name,
              description: addon.description,
              monthlyLabel: addon.monthlyLabel,
              yearlyLabel: addon.yearlyLabel,
              note: addon.note,
              points: addon.points,
            },
            itemId,
          })) ?? [],
      },
      plans: pricingPlans.map((plan) => ({
        key: plan.key,
        name: plan.name,
        description: plan.description,
        badge: plan.badge,
        note: plan.note,
        memoryWindow: plan.memoryWindow,
        monthlyCredits: plan.monthlyCredits,
        monthlyLabel: plan.monthlyLabel,
        yearlyLabel: plan.yearlyLabel,
        apiRequestLimit: plan.apiRequestLimit,
        points: plan.points,
      })),
      addons: billingAddons.map((addon) => ({
        key: addon.key,
        name: addon.name,
        description: addon.description,
        monthlyLabel: addon.monthlyLabel,
        yearlyLabel: addon.yearlyLabel,
        note: addon.note,
        points: addon.points,
      })),
    });
  } catch (err) {
    console.error("desktop/billing/state failed:", err);
    return NextResponse.json(
      { error: "Could not load desktop billing state." },
      { status: 500 },
    );
  }
}

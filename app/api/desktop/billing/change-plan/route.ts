import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getPriceId,
  getStripe,
  STRIPE_PRICES,
  type BillingCycle,
} from "../../../../../lib/stripe";
import { billingAddonMap, pricingPlanMap } from "../../../../../lib/pricing";

export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    planKey?: string;
    cycle?: string;
  };

  const planKey = payload.planKey?.toLowerCase() ?? "";
  if (!(planKey in pricingPlanMap) || planKey === "free" || planKey === "enterprise") {
    return NextResponse.json({ error: "Unsupported plan for self-serve change." }, { status: 400 });
  }
  const cycle: BillingCycle = payload.cycle === "yearly" ? "yearly" : "monthly";

  const priceId = getPriceId(planKey, cycle);
  if (!priceId) {
    return NextResponse.json({ error: "No Stripe price for that plan." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email.toLowerCase());
    const subscription = await findUsableSubscription(customer.id);
    if (!subscription) {
      return NextResponse.json({ error: "No active subscription to change." }, { status: 400 });
    }

    const addonPriceIds = new Set<string>();
    for (const addonKey of Object.keys(billingAddonMap)) {
      const prices = STRIPE_PRICES[addonKey as keyof typeof STRIPE_PRICES];
      if (prices.monthly) addonPriceIds.add(prices.monthly);
      if (prices.yearly) addonPriceIds.add(prices.yearly);
    }

    const planItem = subscription.items.data.find(
      (item) => !addonPriceIds.has(item.price.id),
    ) ?? subscription.items.data[0];

    if (!planItem) {
      return NextResponse.json({ error: "Subscription has no line items." }, { status: 500 });
    }

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: planItem.id, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { ...subscription.metadata, planKey, cycle, surface: "desktop" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[desktop change-plan] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

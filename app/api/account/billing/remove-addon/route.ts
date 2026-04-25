import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getStripe,
  STRIPE_PRICES,
} from "../../../../../lib/stripe";
import type { BillingAddonKey } from "../../../../../lib/pricing";

/**
 * POST /api/account/billing/remove-addon
 * Body: { addonKey }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { addonKey?: string };
  const addonKey = payload.addonKey?.toLowerCase() as BillingAddonKey | undefined;
  if (!addonKey || !(addonKey in STRIPE_PRICES)) {
    return NextResponse.json({ error: "Unknown addon." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(session.user.email.toLowerCase());
    const subscription = await findUsableSubscription(customer.id);
    if (!subscription) {
      return NextResponse.json({ error: "No active subscription." }, { status: 400 });
    }

    const addonPriceIds = new Set<string>();
    const prices = STRIPE_PRICES[addonKey];
    if (prices.monthly) addonPriceIds.add(prices.monthly);
    if (prices.yearly)  addonPriceIds.add(prices.yearly);

    const item = subscription.items.data.find((i) => addonPriceIds.has(i.price.id));
    if (!item) {
      return NextResponse.json({ error: "Addon is not active." }, { status: 400 });
    }

    await stripe.subscriptionItems.del(item.id, {
      proration_behavior: "create_prorations",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[remove-addon] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

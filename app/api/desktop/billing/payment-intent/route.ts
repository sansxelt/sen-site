import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getPriceId,
  getStripe,
  isStripeConfigured,
  type BillingCycle,
} from "../../../../../lib/stripe";
import { extractBillingErrorMessage, extractClientSecret, buildBillingPaymentSettings } from "../../../../../lib/desktop-billing";
import { upsertSubscriptionSelection } from "../../../../../lib/subscriptions";
import type { PricingPlanKey } from "../../../../../lib/pricing";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { planKey?: string; addonKey?: string; cycle?: string; seats?: number };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const planKey = payload.planKey?.toLowerCase() ?? "";
  const addonKey = payload.addonKey?.toLowerCase() ?? "";
  const cycle: BillingCycle = payload.cycle === "yearly" ? "yearly" : "monthly";
  const seats = planKey === "teams" ? Math.max(3, Math.floor(payload.seats ?? 3)) : 1;
  const pricedKey = addonKey || planKey;

  if (!pricedKey) {
    return NextResponse.json({ error: "Choose a plan or addon first." }, { status: 400 });
  }

  const priceId = getPriceId(pricedKey, cycle);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for "${pricedKey}" (${cycle}).` },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(normalizedEmail);

    if (addonKey) {
      const existing = await findUsableSubscription(customer.id);
      if (existing) {
        const alreadyHas = existing.items.data.some((item) => item.price.id === priceId);
        if (alreadyHas) {
          return NextResponse.json({ error: "You already have this addon." }, { status: 409 });
        }
        await stripe.subscriptionItems.create({
          subscription: existing.id,
          price: priceId,
          quantity: 1,
          proration_behavior: "create_prorations",
        });
        return NextResponse.json({ status: "addon_added", subscriptionId: existing.id });
      }
      return NextResponse.json({ error: "Pick a plan before adding addons." }, { status: 400 });
    }

    try {
      await upsertSubscriptionSelection(normalizedEmail, {
        planKey: planKey as PricingPlanKey,
        billingCycle: cycle,
        seatCount: seats,
      });
    } catch (dbErr) {
      console.error("[desktop payment-intent] Supabase upsert failed (non-fatal):", extractBillingErrorMessage(dbErr));
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: seats }],
      payment_behavior: "default_incomplete",
      payment_settings: buildBillingPaymentSettings(),
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
      metadata: {
        cycle,
        planKey,
        purchaseKind: "plan",
        userEmail: normalizedEmail,
        surface: "desktop",
      },
    });

    const secret = extractClientSecret(subscription);
    if (!secret) {
      console.error("[desktop payment-intent] no client_secret on subscription", subscription.id);
      return NextResponse.json(
        { error: "Stripe did not return a client secret." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "ready",
      clientSecret: secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
    });
  } catch (err) {
    const message = extractBillingErrorMessage(err);
    console.error("[desktop payment-intent] failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

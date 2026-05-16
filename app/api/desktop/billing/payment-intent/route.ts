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
import { isOneTimeBoost, planIncludesAddon, type BillingAddonKey, type PricingPlanKey } from "../../../../../lib/pricing";
import { getPlanForEmail } from "../../../../../lib/account-billing";
import { invalidateAddonsCache } from "../../../../../lib/active-addons";

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

  // Server-side guard: refuse to charge for an addon the user's plan
  // already includes. Mirrors the web payment-intent route.
  if (addonKey) {
    try {
      const currentPlan = await getPlanForEmail(normalizedEmail);
      if (planIncludesAddon(currentPlan, addonKey as BillingAddonKey)) {
        return NextResponse.json(
          {
            error: `Your ${currentPlan} plan already includes ${addonKey.replace(/_/g, " ")}. No need to buy it.`,
          },
          { status: 409 },
        );
      }
    } catch (err) {
      console.warn("[desktop payment-intent] plan inclusion check failed:", err);
    }
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(normalizedEmail);

    if (addonKey) {
      // v0.1.4, one-time boost top-ups go through a single PaymentIntent
      // rather than a recurring subscription item. We look up the price's
      // unit_amount + currency from Stripe so we don't have to maintain a
      // duplicate price table on our side; checkout.sessions.create with
      // mode: "payment" is also supported but PaymentIntent keeps the
      // user inside the desktop app's existing Stripe Elements flow.
      //
      // TODO(stripe-dashboard): Each *_BOOST / *_PACK env var must point
      // at a one-time price (not a recurring price) for this branch to
      // work. The dashboard step is: Products → New → "One time" → set
      // price → copy price id into the matching env var.
      if (isOneTimeBoost(addonKey)) {
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount;
        if (!amount || !price.currency) {
          return NextResponse.json(
            { error: `Stripe price "${priceId}" is missing a unit amount.` },
            { status: 500 },
          );
        }

        const intent = await stripe.paymentIntents.create({
          amount,
          currency: price.currency,
          customer: customer.id,
          // Explicit allow-list, Amazon Pay / Klarna / etc. need
          // separate setup we haven't done. Match the recurring set.
          payment_method_types: ["card", "link", "cashapp"],
          metadata: {
            addonKey,
            purchaseKind: "one_time_boost",
            userEmail: normalizedEmail,
            surface: "desktop",
            priceId,
          },
          description: `VRAELIS ${addonKey} top-up`,
        });

        if (!intent.client_secret) {
          return NextResponse.json(
            { error: "Stripe did not return a client secret for the boost." },
            { status: 500 },
          );
        }

        return NextResponse.json({
          status: "one_time_ready",
          clientSecret: intent.client_secret,
          customerId: customer.id,
        });
      }

      // v0.1.16, Require a default payment method before attaching
      // a recurring addon. Mirrors the web payment-intent route fix.
      // Without this the addon flips to Active on a card-less
      // subscription and the next renewal fails to charge.
      const customerForPm = await stripe.customers.retrieve(customer.id);
      const defaultPmRecurring =
        (customerForPm as { invoice_settings?: { default_payment_method?: unknown } })
          .invoice_settings?.default_payment_method;
      if (!defaultPmRecurring) {
        return NextResponse.json(
          { error: "Add a payment method first, then try this addon again." },
          { status: 400 },
        );
      }
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
        invalidateAddonsCache(normalizedEmail);
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

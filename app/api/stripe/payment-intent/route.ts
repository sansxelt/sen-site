import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "../../../../auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getPriceId,
  getStripe,
  isStripeConfigured,
} from "../../../../lib/stripe";
import type { BillingCycle } from "../../../../lib/stripe";
import { upsertSubscriptionSelection } from "../../../../lib/subscriptions";
import type { PricingPlanKey } from "../../../../lib/pricing";

/**
 * POST /api/stripe/payment-intent
 *
 * Creates (or reuses) a Stripe Customer, then creates a Subscription with
 * `payment_behavior: "default_incomplete"`.  Returns the PaymentIntent
 * client_secret for the browser to confirm via Stripe Payment Element.
 *
 * Body: { planKey?: string, addonKey?: string, cycle?: "monthly"|"yearly", seats?: number }
 *
 * - If `planKey` is set, the subscription's base line item is the plan.
 * - If `addonKey` is set and the user already has a subscription, we attach
 *   the addon as an extra line item on that subscription (no new sub created).
 * - Teams/Enterprise always redirect to /contact and never hit this route.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let payload: { planKey?: string; addonKey?: string; cycle?: string; seats?: number };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const planKey  = payload.planKey?.toLowerCase() ?? "";
  const addonKey = payload.addonKey?.toLowerCase() ?? "";
  const cycle: BillingCycle = payload.cycle === "yearly" ? "yearly" : "monthly";
  const seats    = planKey === "teams" ? Math.max(3, Math.floor(payload.seats ?? 3)) : 1;
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

  const email = session.user.email.toLowerCase();

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email);

    // Addon purchase on top of an existing subscription: add a line item.
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
        // Stripe generates a prorated invoice that may require payment
        // confirmation.  If so we return its client_secret; otherwise no
        // payment action is needed and we tell the client "done".
        return NextResponse.json({
          status: "addon_added",
          subscriptionId: existing.id,
        });
      }
      // No existing subscription — user needs a plan first.
      return NextResponse.json(
        { error: "Pick a plan before adding addons." },
        { status: 400 },
      );
    }

    // Plan purchase: create a new incomplete subscription, return its
    // PaymentIntent client_secret for the browser to confirm.
    await upsertSubscriptionSelection(email, {
      planKey: planKey as PricingPlanKey,
      billingCycle: cycle,
      seatCount: seats,
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: seats }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: {
        cycle,
        planKey,
        purchaseKind: "plan",
        userEmail: email,
      },
    });

    // Newer Stripe API: pull the PaymentIntent client_secret from the
    // latest invoice's confirmation_secret.
    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    const secret = (invoice as unknown as { confirmation_secret?: { client_secret?: string } } | null)
      ?.confirmation_secret?.client_secret ?? null;

    if (!secret) {
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
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[payment-intent] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

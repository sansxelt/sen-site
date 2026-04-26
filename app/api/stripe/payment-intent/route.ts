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
import type { BillingAddonKey, PricingPlanKey } from "../../../../lib/pricing";
import { isOneTimeBoost, planIncludesAddon } from "../../../../lib/pricing";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { invalidateAddonsCache } from "../../../../lib/active-addons";

/**
 * Extract a human-readable error message from anything Stripe/Supabase/native
 * throws at us.  Without this we were falling back to a blanket "Stripe error."
 * that hid the actual problem.
 */
function extractErrorMessage(err: unknown): string {
  if (!err) return "Unknown error.";
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.raw === "object" && obj.raw !== null) {
      const raw = obj.raw as Record<string, unknown>;
      if (typeof raw.message === "string") return raw.message;
    }
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}

/**
 * Pull the PaymentIntent client_secret off the subscription's latest invoice.
 * Stripe's 2025.x API renamed `payment_intent` → `confirmation_secret`;
 * older versions still use `payment_intent`.  Handle both so an API-version
 * mismatch doesn't kill the checkout.
 */
function extractClientSecret(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice as (Stripe.Invoice | string | null);
  if (!invoice || typeof invoice === "string") return null;
  const raw = invoice as unknown as {
    confirmation_secret?: { client_secret?: string } | null;
    payment_intent?: { client_secret?: string } | string | null;
  };
  if (raw.confirmation_secret?.client_secret) return raw.confirmation_secret.client_secret;
  if (raw.payment_intent && typeof raw.payment_intent === "object" && raw.payment_intent.client_secret) {
    return raw.payment_intent.client_secret;
  }
  return null;
}

/**
 * Subscription-compatible payment methods.  Every type here must be
 * activated in the Stripe Dashboard (Settings → Payment methods) or
 * Stripe rejects the whole subscription create call.  Add a type here
 * ONLY after confirming it's switched on in the dashboard.
 *
 * Card covers Apple Pay + Google Pay automatically as wallet buttons.
 * To add PayPal later: enable in Stripe → add "paypal" to this list.
 */
function buildPaymentSettings(): Stripe.SubscriptionCreateParams.PaymentSettings {
  return {
    save_default_payment_method: "on_subscription",
    payment_method_types: ["card", "link", "cashapp"],
  };
}

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
      { error: `No Stripe price configured for "${pricedKey}" (${cycle}). Add STRIPE_PRICE_${pricedKey.toUpperCase()}_${cycle.toUpperCase()} to Vercel env vars.` },
      { status: 400 },
    );
  }

  const email = session.user.email.toLowerCase();

  // v0.1.16 — Server-side guard against buying an addon that the
  // user's current plan already includes. The billing UI hides the
  // buy button via planIncludesAddon, but a direct API hit would
  // still get processed and silently double-charge. Block here.
  // Plan-only purchases (no addonKey) skip this check.
  if (addonKey) {
    try {
      const currentPlan = await getPlanForEmail(email);
      if (planIncludesAddon(currentPlan, addonKey as BillingAddonKey)) {
        return NextResponse.json(
          {
            error: `Your ${currentPlan} plan already includes ${addonKey.replace(/_/g, " ")}. No need to buy it.`,
          },
          { status: 409 },
        );
      }
    } catch (err) {
      // Plan lookup failure is non-fatal — fall through and let the
      // existing Stripe path handle it. Worst case the user gets a
      // useful error from Stripe; best case they're a free user with
      // no inclusions to enforce.
      console.warn("[payment-intent] plan inclusion check failed:", err);
    }
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email);

    // ── Addon on top of existing subscription ────────────────────────
    if (addonKey) {
      // v0.1.16 r9 — Two distinct addon flows:
      //   ONE-TIME boosts (session_boost, weekly_boost): the Stripe
      //     price is type=one_time. Cannot be added as a subscription
      //     item — has to be a separate PaymentIntent. Webhook then
      //     credits boost_credits via the existing one_time_boost
      //     branch in /api/stripe/webhook.
      //   RECURRING addons (copilot_pro_pack, power_pack): Stripe
      //     price is type=recurring. Add to the existing subscription.
      const oneTime = isOneTimeBoost(addonKey);

      if (oneTime) {
        // Look up the price to get its amount + currency.
        const price = await stripe.prices.retrieve(priceId);
        if (!price.unit_amount || !price.currency) {
          return NextResponse.json(
            { error: "Stripe price is missing amount or currency." },
            { status: 500 },
          );
        }
        // Need a default payment method on file to charge off-session.
        const customerObj = await stripe.customers.retrieve(customer.id);
        const defaultPm =
          (customerObj as Stripe.Customer).invoice_settings?.default_payment_method;
        if (!defaultPm) {
          return NextResponse.json(
            { error: "Add a payment method first, then try this addon again." },
            { status: 400 },
          );
        }
        const intent = await stripe.paymentIntents.create({
          amount: price.unit_amount,
          currency: price.currency,
          customer: customer.id,
          payment_method: typeof defaultPm === "string" ? defaultPm : defaultPm.id,
          off_session: true,
          confirm: true,
          metadata: {
            purchaseKind: "one_time_boost",
            addonKey,
            userEmail: email,
          },
          description: `sansxel one-time boost: ${addonKey}`,
        });
        if (intent.status === "succeeded") {
          return NextResponse.json({ status: "boost_charged", intentId: intent.id });
        }
        return NextResponse.json(
          { error: `Payment ${intent.status}. Check your card and try again.` },
          { status: 402 },
        );
      }

      // Recurring addon — add to the existing subscription.
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
        // Cache miss the next chat/image/voice request so the new
        // unlimited addon takes effect immediately rather than after
        // the 5-min TTL expires.
        invalidateAddonsCache(email);
        return NextResponse.json({ status: "addon_added", subscriptionId: existing.id });
      }
      return NextResponse.json({ error: "Pick a plan before adding addons." }, { status: 400 });
    }

    // ── Plan purchase: create incomplete subscription ───────────────
    // Persist the user's selection in Supabase.  Wrap in try/catch so a
    // Supabase misconfiguration never blocks the Stripe payment — the
    // webhook will sync the final state anyway.
    try {
      await upsertSubscriptionSelection(email, {
        planKey: planKey as PricingPlanKey,
        billingCycle: cycle,
        seatCount: seats,
      });
    } catch (dbErr) {
      console.error("[payment-intent] Supabase upsert failed (non-fatal):", extractErrorMessage(dbErr));
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: seats }],
      payment_behavior: "default_incomplete",
      payment_settings: buildPaymentSettings(),
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
      metadata: {
        cycle,
        planKey,
        purchaseKind: "plan",
        userEmail: email,
      },
    });

    const secret = extractClientSecret(subscription);
    if (!secret) {
      console.error("[payment-intent] no client_secret on subscription", subscription.id);
      return NextResponse.json(
        { error: "Stripe did not return a client secret. Check the Stripe dashboard — subscription may have been created but requires manual cleanup." },
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
    const message = extractErrorMessage(err);
    console.error("[payment-intent] failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email);

    // ── Addon on top of existing subscription ────────────────────────
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
      payment_settings: { save_default_payment_method: "on_subscription" },
      // Expand BOTH field names — Stripe returns whichever matches the
      // account's API version.  The expand itself is tolerant of unknown
      // fields in newer API versions.
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

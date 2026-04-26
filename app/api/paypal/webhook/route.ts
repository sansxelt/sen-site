import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getPaypalSubscription,
  verifyPaypalWebhook,
  type PaypalSubscription,
} from "../../../../lib/paypal";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";
import { invalidateAddonsCache } from "../../../../lib/active-addons";

/**
 * Map PayPal's subscription state to the same normalized-status format our
 * Stripe webhook uses, so upsertActiveSubscription handles both cleanly.
 */
function normalizePaypalStatus(status: PaypalSubscription["status"]): string {
  switch (status) {
    case "ACTIVE":           return "active";
    case "SUSPENDED":        return "past_due";
    case "CANCELLED":        return "canceled";
    case "EXPIRED":          return "canceled";
    case "APPROVAL_PENDING": return "incomplete";
    case "APPROVED":         return "incomplete";
    default:                 return "incomplete";
  }
}

type CustomPayload = { email: string; planKey: string; cycle: "monthly" | "yearly" };

function parseCustomId(custom: string | undefined): CustomPayload | null {
  if (!custom) return null;
  try {
    const parsed = JSON.parse(custom) as Partial<CustomPayload>;
    if (!parsed.email || !parsed.planKey) return null;
    return {
      email:   String(parsed.email),
      planKey: String(parsed.planKey),
      cycle:   parsed.cycle === "yearly" ? "yearly" : "monthly",
    };
  } catch {
    return null;
  }
}

/**
 * Handle subscription-related events.  We query PayPal for the fresh
 * subscription every time (cheap, always-correct) rather than trusting the
 * event payload alone, because event payloads can lag.
 */
async function handleSubscriptionEvent(event: WebhookEvent) {
  const resource = event.resource as Record<string, unknown> | undefined;
  const subscriptionId = typeof resource?.id === "string" ? resource.id : null;
  if (!subscriptionId) {
    console.warn("[paypal webhook] no subscription id in event", event.event_type);
    return;
  }

  const subscription = await getPaypalSubscription(subscriptionId);
  const custom = parseCustomId((resource?.custom_id as string | undefined) ?? undefined);
  if (!custom) {
    console.warn("[paypal webhook] no custom_id on subscription, cannot map to user");
    return;
  }

  const nextBilling = subscription.billing_info?.next_billing_time;
  const periodEndUnix = nextBilling ? Math.floor(new Date(nextBilling).getTime() / 1000) : null;

  await upsertActiveSubscription({
    email:                  custom.email,
    planKey:                custom.planKey,
    billingCycle:           custom.cycle,
    currentPeriodEnd:       periodEndUnix,
    stripeStatus:           normalizePaypalStatus(subscription.status),
    provider:               "paypal",
    providerSubscriptionId: subscription.id,
  });
  // Plan change can flip what's "Owned with [Plan]", drop the cached
  // addon set so the cap-lift logic re-resolves immediately. Mirrors
  // the same call in the Stripe webhook.
  invalidateAddonsCache(custom.email);
}

type WebhookEvent = {
  event_type: string;
  resource: unknown;
};

export async function POST(request: Request) {
  const bodyText = await request.text();
  const headersList = await headers();

  const headerMap: Record<string, string | null> = {
    "paypal-auth-algo":         headersList.get("paypal-auth-algo"),
    "paypal-cert-url":          headersList.get("paypal-cert-url"),
    "paypal-transmission-id":   headersList.get("paypal-transmission-id"),
    "paypal-transmission-sig":  headersList.get("paypal-transmission-sig"),
    "paypal-transmission-time": headersList.get("paypal-transmission-time"),
  };

  let event: WebhookEvent;
  try {
    event = JSON.parse(bodyText) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Signature check, if PAYPAL_WEBHOOK_ID isn't set we refuse rather than
  // silently accepting anything.  Set it after you create the webhook in
  // PayPal Developer.
  const verified = await verifyPaypalWebhook({ headers: headerMap, body: event });
  if (!verified) {
    console.warn("[paypal webhook] signature verification failed");
    return NextResponse.json({ error: "Unverified." }, { status: 400 });
  }

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    case "PAYMENT.SALE.COMPLETED":
      await handleSubscriptionEvent(event);
      break;
    default:
      // unknown, log and ignore
      break;
  }

  return NextResponse.json({ received: true });
}

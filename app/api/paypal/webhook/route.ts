import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getPaypalSubscription,
  verifyPaypalWebhook,
  type PaypalSubscription,
} from "../../../../lib/paypal";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";
import { invalidateAddonsCache } from "../../../../lib/active-addons";
import { maybeProvisionAgentNumber, releaseAgentNumber } from "../../../../lib/vraelis-sms";
import { setWorkspacePlan } from "../../../../lib/vraelis-db";
import { isPlanKey, vraelisPlanFromPaypalPlanId } from "../../../../lib/vraelis-plans";
import { notifyOwnerPlanLapse } from "../../../../lib/vraelis-notify";

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

  // Mirror the lifecycle onto the Vraelis workspace too. Without this, a PayPal
  // cancel/expire/suspend never downgrades the workspace (it kept paid features
  // + the agent number forever). Maps PayPal status → our 3-way plan_status;
  // 'incomplete' (pre-activation) is left for the activation event to resolve.
  const ppStatus = normalizePaypalStatus(subscription.status);
  // Canonical Vraelis tier comes from PayPal's own plan_id, and ONLY from there (finding H1).
  //
  // There is deliberately no custom_id fallback. custom_id is chosen by whoever created the subscription
  // and merely relayed back by PayPal, so falling back to it whenever plan_id fails to resolve reproduces
  // the exact escalation this fix exists to close — and an unrecognised plan_id is cheap to obtain, so the
  // fallback branch was the reachable one, not the rare one. If plan_id is not in the Vraelis catalogue,
  // the subscription is not a Vraelis subscription and no Vraelis tier is written. custom_id is used only
  // for identity (which account), never for entitlement (which tier).
  const derivedTier = vraelisPlanFromPaypalPlanId(subscription.plan_id);
  const vraelisPlan = derivedTier?.plan ?? null;
  const vraelisCycle = derivedTier?.cycle ?? "monthly";
  if (!derivedTier && isPlanKey(custom.planKey)) {
    // A custom_id claiming a Vraelis tier while the plan_id says otherwise is either a stale subscription
    // or a forgery attempt. Refuse it and say so loudly rather than silently trusting the claim.
    console.warn(
      "[paypal webhook] refusing Vraelis tier from custom_id: plan_id",
      subscription.plan_id,
      "is not in the Vraelis catalogue",
    );
  }
  if (vraelisPlan) {
    const vraelisStatus =
      ppStatus === "active"
        ? "active"
        : ppStatus === "past_due"
          ? "past_due"
          : ppStatus === "canceled"
            ? "canceled"
            : null;
    if (vraelisStatus) {
      try {
        const { statusChanged } = await setWorkspacePlan(custom.email, {
          plan: vraelisPlan,
          cycle: vraelisCycle,
          status: vraelisStatus,
          provider: "paypal",
          subscriptionId: subscription.id,
          periodEndISO: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
        });
        // Lapse → reap the agent number (fire-and-forget; reap cron backstops).
        if (vraelisStatus === "canceled") void releaseAgentNumber(custom.email).catch(() => {});
        // Email the owner once on a real transition into a lapse state.
        if (statusChanged && (vraelisStatus === "canceled" || vraelisStatus === "past_due")) {
          void notifyOwnerPlanLapse(custom.email, vraelisStatus).catch(() => {});
        }
      } catch (err) {
        console.error("[paypal webhook] vraelis plan record failed:", err);
      }
    }
  }

  // Assign the agent's phone number if this activated a paid Vraelis plan.
  // Gated + idempotent: re-checks the workspace plan/onboarding/existing number
  // and no-ops otherwise. Fire-and-forget so a slow Twilio call can't delay the
  // webhook response (its internals are timeout-bounded + self-catching).
  if (normalizePaypalStatus(subscription.status) === "active") {
    void maybeProvisionAgentNumber(custom.email).catch(() => {});
  }
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

  try {
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
  } catch (err) {
    // Verified event but the handler threw (DB hiccup, etc). Return 200 anyway
    // so PayPal doesn't retry-storm against our own bug; the reconcile cron
    // self-heals any state we missed.
    console.error(`[paypal webhook] handler failed for ${event.event_type}:`, err);
  }

  return NextResponse.json({ received: true });
}

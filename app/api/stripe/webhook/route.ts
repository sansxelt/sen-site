import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, STRIPE_PRICES } from "../../../../lib/stripe";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";
import {
  sendPaymentFailedEmail,
  sendRenewalSucceededEmail,
  sendRenewalUpcomingEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancellationScheduledEmail,
  sendSubscriptionEndedEmail,
} from "../../../../lib/email";
import { getPricingPlan, type PricingPlanKey, pricingPlanMap } from "../../../../lib/pricing";
import { getUserProfileByEmail } from "../../../../lib/user-profile";

/**
 * Look up the customer's display name so every billing email greets
 * them by name.  Missing profiles (deleted / guest customers) fall
 * back to "" which renders as a plain "Hi," in the templates.
 */
async function displayNameFor(email: string): Promise<string> {
  try {
    const profile = await getUserProfileByEmail(email);
    return profile?.display_name ?? "";
  } catch {
    return "";
  }
}

// Reverse-lookup a Stripe price ID to its plan key / cycle.
function resolvePlanFromPriceId(priceId: string | null): { planKey: string; cycle: "monthly" | "yearly" } | null {
  if (!priceId) return null;
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId) return { planKey: key, cycle: "monthly" };
    if (cycles.yearly  === priceId) return { planKey: key, cycle: "yearly"  };
  }
  return null;
}

function pickPlanItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | null {
  const items = subscription.items.data;
  if (items.length === 0) return null;
  const addonKeys = new Set(["memory_boost", "api_boost", "key_pack"]);
  for (const item of items) {
    const resolved = resolvePlanFromPriceId(item.price.id);
    if (resolved && !addonKeys.has(resolved.planKey)) return item;
  }
  return items[0] ?? null;
}

function formatDate(unix: number | null): string {
  if (!unix) return "your next billing date";
  try {
    return new Date(unix * 1000).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return "your next billing date"; }
}

// ── Resolve email + plan context from a subscription ──────────────────────
async function resolveContext(subscription: Stripe.Subscription): Promise<{
  email:    string;
  planKey:  string;
  planName: string;
  cycle:    "monthly" | "yearly";
  periodEndUnix: number | null;
} | null> {
  let email = subscription.metadata?.userEmail ?? "";
  if (!email) {
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) return null;
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted || !customer.email) return null;
    email = customer.email;
  }

  const planItem = pickPlanItem(subscription);
  const resolved = planItem ? resolvePlanFromPriceId(planItem.price.id) : null;
  const planKey  = resolved?.planKey ?? subscription.metadata?.planKey ?? "free";
  const cycle    = (resolved?.cycle ?? subscription.metadata?.cycle ?? "monthly") as "monthly" | "yearly";

  const planName = planKey in pricingPlanMap
    ? getPricingPlan(planKey as PricingPlanKey).name
    : planKey;

  const periodEndRaw = (subscription as unknown as Record<string, unknown>)["current_period_end"];
  const periodEndUnix = typeof periodEndRaw === "number" ? periodEndRaw : null;

  return { email, planKey, planName, cycle, periodEndUnix };
}

async function handleSubscriptionChange(event: Stripe.Event, subscription: Stripe.Subscription) {
  const ctx = await resolveContext(subscription);
  if (!ctx) {
    console.warn("[stripe webhook] missing email context — skipping");
    return;
  }

  // Keep the Supabase snapshot in sync.
  await upsertActiveSubscription({
    email:            ctx.email,
    planKey:          ctx.planKey,
    billingCycle:     ctx.cycle,
    currentPeriodEnd: ctx.periodEndUnix,
    stripeStatus:     subscription.status,
  });

  // ── Email side effects ─────────────────────────────────────────
  // Only send for events where a user-facing state changed.  Event
  // data.previous_attributes lets us detect specific transitions
  // (e.g. just-scheduled cancellation) without misfiring on every update.
  const prev = (event.data as unknown as { previous_attributes?: Record<string, unknown> })
    .previous_attributes ?? {};
  const plan = ctx.planKey in pricingPlanMap
    ? getPricingPlan(ctx.planKey as PricingPlanKey)
    : null;

  const name = await displayNameFor(ctx.email);

  switch (event.type) {
    case "customer.subscription.created": {
      if (subscription.status === "active" || subscription.status === "trialing") {
        const amountLabel = plan
          ? (ctx.cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel)
          : "";
        await sendSubscriptionActivatedEmail({
          email:       ctx.email,
          name,
          planName:    ctx.planName,
          cycle:       ctx.cycle,
          amountLabel,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const prevCancel = Boolean(prev.cancel_at_period_end);
      const currCancel = Boolean((subscription as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end);

      // Transition: cancellation was JUST scheduled (was false, now true).
      if (currCancel && !prevCancel) {
        await sendSubscriptionCancellationScheduledEmail({
          email:    ctx.email,
          name,
          planName: ctx.planName,
          endsOn:   formatDate(ctx.periodEndUnix),
        });
      }

      // Transition: previously-active sub became inactive via update
      // (e.g. status moved to "unpaid" after retries exhausted).
      const prevStatus = typeof prev.status === "string" ? prev.status : null;
      if (
        prevStatus && prevStatus !== subscription.status &&
        ["unpaid", "canceled", "incomplete_expired"].includes(subscription.status)
      ) {
        await sendSubscriptionEndedEmail({
          email:    ctx.email,
          name,
          planName: ctx.planName,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Period ended on a scheduled cancel, or admin hard-canceled.
      await sendSubscriptionEndedEmail({
        email:    ctx.email,
        name,
        planName: ctx.planName,
      });
      break;
    }
  }
}

/**
 * Dig the price id out of an invoice line item.  Stripe deprecated
 * `line.price` at the type level in the API version we pin (moved under
 * `pricing`) but still returns it in the wire response — narrow cast
 * keeps runtime correct while satisfying TS.
 */
function priceIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const lineItem = invoice.lines?.data?.[0];
  return (lineItem as unknown as { price?: { id?: string } | null } | undefined)
    ?.price?.id ?? null;
}

/**
 * Best-effort plan name lookup for invoice-triggered emails.  Falls back
 * to a generic label so the subject line never reads "$12 — undefined".
 */
function planNameFromInvoice(invoice: Stripe.Invoice): string {
  const resolved = resolvePlanFromPriceId(priceIdFromInvoice(invoice));
  if (resolved && resolved.planKey in pricingPlanMap) {
    return getPricingPlan(resolved.planKey as PricingPlanKey).name;
  }
  return "your";
}

function formatInvoiceAmount(invoice: Stripe.Invoice): string {
  const amount = invoice.amount_paid || invoice.amount_due || invoice.total;
  const currency = (invoice.currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const email = invoice.customer_email ?? null;
  if (!email) return;
  await sendPaymentFailedEmail({
    email,
    name:     await displayNameFor(email),
    planName: planNameFromInvoice(invoice),
  });
}

/**
 * invoice.paid — fires on successful renewal charges AND on the initial
 * subscription charge.  We dedupe against the initial case by only
 * emailing when billing_reason === "subscription_cycle" (scheduled
 * renewal).  Initial checkouts are already covered by the welcome email
 * from customer.subscription.created.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const email = invoice.customer_email ?? null;
  if (!email) return;
  const reason = (invoice as unknown as { billing_reason?: string }).billing_reason;
  if (reason !== "subscription_cycle") return;

  const periodEndUnix = (invoice as unknown as { period_end?: number }).period_end;
  const nextPeriod = typeof periodEndUnix === "number"
    ? new Date(periodEndUnix * 1000).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "your next billing date";

  await sendRenewalSucceededEmail({
    email,
    name:        await displayNameFor(email),
    planName:    planNameFromInvoice(invoice),
    amountLabel: formatInvoiceAmount(invoice),
    periodEnd:   nextPeriod,
    invoiceUrl:  invoice.hosted_invoice_url ?? null,
  });
}

/**
 * invoice.upcoming — Stripe sends this roughly 7 days before a renewal.
 * Pure heads-up: gives the user a window to cancel / downgrade / swap
 * cards before money moves.
 */
async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  const email = invoice.customer_email ?? null;
  if (!email) return;

  // Stripe sends this with `next_payment_attempt` or `period_end` as
  // the target date depending on configuration.
  const anyInvoice = invoice as unknown as {
    next_payment_attempt?: number | null;
    period_end?: number;
  };
  const chargeAt = anyInvoice.next_payment_attempt ?? anyInvoice.period_end ?? null;
  const chargeDate = chargeAt
    ? new Date(chargeAt * 1000).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "your next billing date";

  await sendRenewalUpcomingEmail({
    email,
    name:        await displayNameFor(email),
    planName:    planNameFromInvoice(invoice),
    amountLabel: formatInvoiceAmount(invoice),
    chargeDate,
  });
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type}:`, err);
    // Still return 200 so Stripe doesn't retry on our application bugs.
  }

  return NextResponse.json({ received: true });
}

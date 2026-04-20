import type Stripe from "stripe";
import {
  billingAddonMap,
  type BillingAddonKey,
  getPricingPlan,
  type PricingPlan,
  pricingPlanMap,
} from "./pricing";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  STRIPE_PRICES,
  getStripe,
  type BillingCycle,
} from "./stripe";

export type BillingState = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  cycle: BillingCycle | null;
  invoices: Array<{
    amountDue: number;
    currency: string;
    date: string;
    hostedUrl: string | null;
    number: string | null;
    pdfUrl: string | null;
    status: Stripe.Invoice.Status | null;
  }>;
  paymentMethod: {
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
    last4: string | null;
  } | null;
  plan: PricingPlan | null;
  planItemId: string | null;
  activeAddons: Array<{
    addon: (typeof billingAddonMap)[BillingAddonKey];
    itemId: string;
  }>;
  status: Stripe.Subscription.Status | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
};

/**
 * Reverse-lookup: price ID → { key, cycle }.  "key" may be a plan key OR an
 * addon key.  Returns null if the price doesn't belong to any configured
 * product.
 */
function resolveKeyFromPrice(priceId: string): { key: string; cycle: BillingCycle } | null {
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId) return { key, cycle: "monthly" };
    if (cycles.yearly  === priceId) return { key, cycle: "yearly"  };
  }
  return null;
}

/**
 * Reads everything the native billing page needs in one shot.  Creates the
 * Stripe customer if it doesn't exist yet so downstream updates (payment
 * method, etc.) always have a stable customer ID to work with.
 */
export async function getBillingState(email: string): Promise<BillingState> {
  const stripe   = getStripe();
  const customer = await getOrCreateCustomer(email);
  const subscription = await findUsableSubscription(customer.id);

  const result: BillingState = {
    cancelAtPeriodEnd:   false,
    currentPeriodEnd:    null,
    cycle:               null,
    invoices:            [],
    paymentMethod:       null,
    plan:                null,
    planItemId:          null,
    activeAddons:        [],
    status:              null,
    stripeCustomerId:    customer.id,
    stripeSubscriptionId: null,
  };

  if (subscription) {
    result.status               = subscription.status;
    result.stripeSubscriptionId = subscription.id;
    result.cancelAtPeriodEnd    = Boolean((subscription as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end);

    const periodEnd = (subscription as unknown as Record<string, unknown>)["current_period_end"];
    if (typeof periodEnd === "number") {
      result.currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
    }

    for (const item of subscription.items.data) {
      const resolved = resolveKeyFromPrice(item.price.id);
      if (!resolved) continue;
      result.cycle = resolved.cycle;
      if (resolved.key in pricingPlanMap) {
        result.plan       = getPricingPlan(resolved.key as keyof typeof pricingPlanMap);
        result.planItemId = item.id;
      } else if (resolved.key in billingAddonMap) {
        result.activeAddons.push({
          addon:  billingAddonMap[resolved.key as BillingAddonKey],
          itemId: item.id,
        });
      }
    }
  }

  // Default payment method — prefer subscription's, then customer's.
  let pmId: string | null = null;
  if (subscription) {
    const sub = subscription as unknown as { default_payment_method?: string | Stripe.PaymentMethod | null };
    const raw = sub.default_payment_method;
    pmId = typeof raw === "string" ? raw : raw?.id ?? null;
  }
  if (!pmId) {
    const invoiceSettings = (customer as unknown as { invoice_settings?: { default_payment_method?: string | Stripe.PaymentMethod | null } }).invoice_settings;
    const raw = invoiceSettings?.default_payment_method;
    pmId = typeof raw === "string" ? raw : raw?.id ?? null;
  }
  if (pmId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.card) {
        result.paymentMethod = {
          brand:    pm.card.brand,
          expMonth: pm.card.exp_month,
          expYear:  pm.card.exp_year,
          last4:    pm.card.last4,
        };
      }
    } catch {
      // swallow — missing/invalid payment method is fine for rendering
    }
  }

  // Recent invoices (up to 6 paid).
  // v0.1.13 \u2014 filter to status === "paid" only. The previous version
  // listed every invoice including draft / open / uncollectible / void,
  // which surfaced a wall of "$X.XX \u00b7 void" rows for failed-to-finalize
  // test invoices. Users (rightly) read this as "you're showing me
  // charges that didn't go through." Only paid ones are real receipts.
  // Pull a wider page (24) since we're filtering, then cap at 6 paid.
  try {
    const invoices = await stripe.invoices.list({ customer: customer.id, limit: 24 });
    result.invoices = invoices.data
      .filter((invoice) => invoice.status === "paid")
      .slice(0, 6)
      .map((invoice) => ({
        amountDue: invoice.amount_paid || invoice.amount_due,
        currency:  invoice.currency,
        date:      new Date((invoice.created ?? 0) * 1000).toISOString(),
        hostedUrl: invoice.hosted_invoice_url ?? null,
        number:    invoice.number ?? null,
        pdfUrl:    invoice.invoice_pdf ?? null,
        status:    invoice.status,
      }));
  } catch {
    // leave empty
  }

  return result;
}

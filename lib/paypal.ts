/**
 * Thin server-side wrapper around PayPal's REST API.
 *
 * PayPal subscriptions flow:
 *   1. Create a Product  (one per pricing-tier "family", reused forever)
 *   2. Create a Billing Plan  (one per tier × cycle, the thing users subscribe to)
 *   3. Create a Subscription against a plan
 *   4. PayPal redirects the user to an approval URL
 *   5. On return, poll getSubscription until status === "ACTIVE"
 *   6. Webhooks keep us informed of renewals, cancellations, failures
 *
 * All API calls share an OAuth bearer token from /v1/oauth2/token that we
 * cache in-process until expiry (tokens last ~9h).
 */

import type { PricingPlanKey } from "./pricing";
import { getPricingPlan } from "./pricing";
import { PLAN_CATALOG } from "./v-plans";

const PAYPAL_API = {
  live:    "https://api-m.paypal.com",
  sandbox: "https://api-m.sandbox.paypal.com",
} as const;

export function paypalBase(): string {
  return process.env.PAYPAL_ENV === "sandbox" ? PAYPAL_API.sandbox : PAYPAL_API.live;
}

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// ── Access token cache ────────────────────────────────────────────────────
type TokenCache = { token: string; expiresAt: number } | null;
let cachedToken: TokenCache = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  const clientId     = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured.");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.token;
}

async function paypalFetch<T = unknown>(
  path: string,
  init: RequestInit & { jsonBody?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const { jsonBody, ...rest } = init;
  const res = await fetch(`${paypalBase()}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...rest.headers,
    },
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`PayPal ${path} failed (${res.status}): ${text}`);
  }
  return body as T;
}

// ── Products + Plans (setup util) ─────────────────────────────────────────

type PaypalProduct = { id: string; name: string };
type PaypalPlan    = { id: string; status: string; name: string };

async function createProduct(name: string, description: string): Promise<PaypalProduct> {
  return await paypalFetch<PaypalProduct>("/v1/catalogs/products", {
    method: "POST",
    jsonBody: {
      name,
      description,
      type: "SERVICE",
      category: "SOFTWARE",
    },
  });
}

async function createPlan(args: {
  productId: string;
  name: string;
  description: string;
  priceUsd: number;
  cycle: "monthly" | "yearly";
}): Promise<PaypalPlan> {
  const interval_unit = args.cycle === "yearly" ? "YEAR" : "MONTH";
  return await paypalFetch<PaypalPlan>("/v1/billing/plans", {
    method: "POST",
    jsonBody: {
      product_id: args.productId,
      name: args.name,
      description: args.description,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // infinite
          pricing_scheme: {
            fixed_price: { value: args.priceUsd.toFixed(2), currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    },
  });
}

export type PlanIdMap = Record<string, { monthly?: string; yearly?: string }>;

/**
 * Creates PayPal products + billing plans for every subscription-capable
 * pricing tier.  Call once from an admin-only route; copy the returned
 * ids into env vars (PAYPAL_PLAN_<KEY>_<CYCLE>).
 */
export async function setupPaypalPlans(): Promise<PlanIdMap> {
  const keysToCreate: PricingPlanKey[] = ["apprentice", "studio", "pro"];
  const result: PlanIdMap = {};

  for (const key of keysToCreate) {
    const plan = getPricingPlan(key);
    // One product per tier, reused for both monthly and yearly plans.
    const product = await createProduct(
      `Vraelis ${plan.name}`,
      plan.description,
    );

    const monthly = await createPlan({
      productId: product.id,
      name:        `Vraelis ${plan.name} (monthly)`,
      description: plan.description,
      priceUsd:    plan.monthlyValue ?? 0,
      cycle:       "monthly",
    });

    // Derive yearly price from yearlyLabel ("$120 / year" → 120).
    const yearlyMatch = (plan.yearlyLabel ?? "").match(/\$([\d,.]+)/);
    const yearlyPrice = yearlyMatch ? Number(yearlyMatch[1].replace(/,/g, "")) : (plan.monthlyValue ?? 0) * 10;

    const yearly = await createPlan({
      productId: product.id,
      name:        `Vraelis ${plan.name} (yearly)`,
      description: plan.description,
      priceUsd:    yearlyPrice,
      cycle:       "yearly",
    });

    result[key] = { monthly: monthly.id, yearly: yearly.id };
  }

  return result;
}

// ── Subscriptions ─────────────────────────────────────────────────────────

export function getPaypalPlanId(key: PricingPlanKey, cycle: "monthly" | "yearly"): string | null {
  const varName = `PAYPAL_PLAN_${key.toUpperCase()}_${cycle.toUpperCase()}`;
  return process.env[varName] ?? null;
}

export type PaypalSubscription = {
  id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  plan_id: string;
  subscriber?: { email_address?: string };
  billing_info?: { next_billing_time?: string };
  links?: Array<{ rel: string; href: string; method: string }>;
};

/**
 * Creates a pending PayPal subscription and returns it (including the
 * approval link the user must visit to consent to recurring billing).
 */
export async function createPaypalSubscription(args: {
  planId: string;
  userEmail: string;
  returnUrl: string;
  cancelUrl: string;
  customId: string;
}): Promise<PaypalSubscription> {
  return await paypalFetch<PaypalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    jsonBody: {
      plan_id: args.planId,
      subscriber: { email_address: args.userEmail },
      application_context: {
        brand_name: "Vraelis",
        locale: "en-US",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
        return_url: args.returnUrl,
        cancel_url: args.cancelUrl,
      },
      custom_id: args.customId,
    },
  });
}

export async function getPaypalSubscription(id: string): Promise<PaypalSubscription> {
  return await paypalFetch<PaypalSubscription>(`/v1/billing/subscriptions/${id}`);
}

// ── Vraelis Rank plans (starter/creator/pro/scale) ────────────────────────
// PayPal billing plans are provisioned once (setupVraelisPaypalPlans, admin route) and
// their ids stored in env as PAYPAL_PLAN_<PLAN>_<CYCLE>, mirroring the Stripe price env.

// Provision a PayPal product + monthly/yearly billing plan for every Vraelis tier. Returns
// the ids to paste into env. Idempotent-ish: re-running creates NEW plans, so run once.
export async function setupVraelisPaypalPlans(): Promise<Record<string, { monthly: string; yearly: string }>> {
  const out: Record<string, { monthly: string; yearly: string }> = {};
  for (const p of PLAN_CATALOG) {
    const product = await createProduct(`Vraelis ${p.name}`, p.blurb);
    const monthly = await createPlan({ productId: product.id, name: `Vraelis ${p.name} (monthly)`, description: p.blurb, priceUsd: p.price.monthly, cycle: "monthly" });
    const yearly = await createPlan({ productId: product.id, name: `Vraelis ${p.name} (yearly)`, description: p.blurb, priceUsd: p.price.yearly, cycle: "yearly" });
    out[p.plan] = { monthly: monthly.id, yearly: yearly.id };
  }
  return out;
}

export function vraelisPaypalPlanId(plan: string, cycle: string): string | null {
  return process.env[`PAYPAL_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}`] || null;
}

// Reverse: a PayPal plan id -> which Vraelis plan/cycle it is (for the webhook).
export function vraelisPlanFromPaypalPlanId(planId: string | null | undefined): { plan: string; cycle: "monthly" | "yearly" } | null {
  if (!planId) return null;
  for (const p of PLAN_CATALOG) {
    for (const cycle of ["monthly", "yearly"] as const) {
      if (process.env[`PAYPAL_PLAN_${p.plan.toUpperCase()}_${cycle.toUpperCase()}`] === planId) return { plan: p.plan, cycle };
    }
  }
  return null;
}

// ── One-time orders (used for addons) ────────────────────────────────────
//
// PayPal Orders v2 API, `intent: CAPTURE` means the funds are pulled
// in a single confirmed step after the user approves. This is the
// right fit for addons (one-time top-ups + 1-month addon activations
// without requiring a pre-created subscription plan in the PayPal
// dashboard).

export type PaypalOrder = { id: string; status: string };

export async function createPaypalOrder(args: {
  amountUsd: number;
  description: string;
  customId: string;
}): Promise<PaypalOrder> {
  return await paypalFetch<PaypalOrder>("/v2/checkout/orders", {
    method: "POST",
    jsonBody: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: args.amountUsd.toFixed(2),
          },
          description: args.description.slice(0, 127),
          custom_id: args.customId.slice(0, 127),
        },
      ],
      // We render a "Pay" button inside our own UI; no PayPal-hosted
      // landing page is needed.
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    },
  });
}

export async function capturePaypalOrder(orderId: string): Promise<{
  id: string;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}> {
  const result = await paypalFetch<{ id: string; status: string }>(
    `/v2/checkout/orders/${orderId}/capture`,
    { method: "POST" },
  );
  return { id: result.id, status: result.status, raw: result };
}

export async function cancelPaypalSubscription(id: string, reason = "user requested"): Promise<void> {
  await paypalFetch(`/v1/billing/subscriptions/${id}/cancel`, {
    method: "POST",
    jsonBody: { reason },
  });
}

// ── Webhook verification ──────────────────────────────────────────────────

/**
 * Verifies a webhook signature with PayPal.  PayPal's recommended
 * server-side verification, we POST all the relevant headers back to
 * them along with the raw body and they confirm authenticity.
 */
export async function verifyPaypalWebhook(args: {
  headers: Record<string, string | null>;
  body: unknown;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  try {
    const res = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        jsonBody: {
          auth_algo:        args.headers["paypal-auth-algo"],
          cert_url:         args.headers["paypal-cert-url"],
          transmission_id:  args.headers["paypal-transmission-id"],
          transmission_sig: args.headers["paypal-transmission-sig"],
          transmission_time: args.headers["paypal-transmission-time"],
          webhook_id:       webhookId,
          webhook_event:    args.body,
        },
      },
    );
    return res.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] webhook verification failed:", err);
    return false;
  }
}

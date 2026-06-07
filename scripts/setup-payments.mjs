// One-off: create Vraelis plans in LIVE Stripe + PayPal, print the IDs.
// Run: node --env-file=.env.local scripts/setup-payments.mjs
// IDs printed are NOT secrets — paste them into lib/vraelis-plans.ts.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const out = { stripe: {}, paypal: {} };

async function stripePlan(name, prices) {
  const product = await stripe.products.create({ name });
  const ids = { product: product.id };
  for (const [key, p] of Object.entries(prices)) {
    const params = { product: product.id, unit_amount: p.amount, currency: "usd" };
    if (p.interval) params.recurring = { interval: p.interval };
    const price = await stripe.prices.create(params);
    ids[key] = price.id;
  }
  return ids;
}

out.stripe.solo = await stripePlan("Vraelis Solo", {
  monthly: { amount: 3900, interval: "month" },
  yearly: { amount: 39000, interval: "year" },
  lifetime: { amount: 59000 },
});
out.stripe.growth = await stripePlan("Vraelis Growth", {
  monthly: { amount: 8900, interval: "month" },
  yearly: { amount: 89000, interval: "year" },
  lifetime: { amount: 149000 },
});
out.stripe.addon_workspace = await stripePlan("Vraelis — Extra workspace", { monthly: { amount: 1900, interval: "month" } });
out.stripe.addon_whitelabel = await stripePlan("Vraelis — White-label", { monthly: { amount: 2900, interval: "month" } });
out.stripe.addon_priority = await stripePlan("Vraelis — Priority support", { monthly: { amount: 4900, interval: "month" } });

// ── PayPal (live) ───────────────────────────────────────────────────
const PP = "https://api-m.paypal.com";
const cid = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
const auth = Buffer.from(`${cid}:${secret}`).toString("base64");

const tokRes = await fetch(`${PP}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const token = (await tokRes.json()).access_token;
if (!token) {
  console.error("PayPal token failed — skipping PayPal.");
} else {
  const ppProduct = async (name) => {
    const r = await fetch(`${PP}/v1/catalogs/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "SERVICE", category: "SOFTWARE" }),
    });
    return (await r.json()).id;
  };
  const ppPlan = async (productId, name, value, interval) => {
    const r = await fetch(`${PP}/v1/billing/plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        name,
        status: "ACTIVE",
        billing_cycles: [{
          frequency: { interval_unit: interval, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value, currency_code: "USD" } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });
    const j = await r.json();
    return j.id ?? JSON.stringify(j);
  };

  const soloProd = await ppProduct("Vraelis Solo");
  out.paypal.solo_monthly = await ppPlan(soloProd, "Vraelis Solo Monthly", "39.00", "MONTH");
  out.paypal.solo_yearly = await ppPlan(soloProd, "Vraelis Solo Yearly", "390.00", "YEAR");
  const growthProd = await ppProduct("Vraelis Growth");
  out.paypal.growth_monthly = await ppPlan(growthProd, "Vraelis Growth Monthly", "89.00", "MONTH");
  out.paypal.growth_yearly = await ppPlan(growthProd, "Vraelis Growth Yearly", "890.00", "YEAR");
}

console.log("RESULT_JSON_START");
console.log(JSON.stringify(out, null, 2));
console.log("RESULT_JSON_END");

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PLAN_CATALOG, priceIdFor } from "@/lib/v-plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ amount?: string; plan?: string; cycle?: string }> }) {
  const sp = await searchParams;
  const planKey = sp.plan && PLAN_CATALOG.some((p) => p.plan === sp.plan) ? sp.plan : "";
  const cycle: "monthly" | "yearly" = sp.cycle === "yearly" ? "yearly" : "monthly";
  // Nothing chosen → send them to pick, don't silently start a $5 checkout.
  if (!planKey && !sp.amount) redirect("/app/credits");
  const amount = Math.max(5, Math.min(9999, parseInt(sp.amount || "0", 10) || 0));

  const session = await auth();
  if (!session?.user?.email) {
    const back = planKey ? `/app/checkout?plan=${planKey}&cycle=${cycle}` : `/app/checkout?amount=${amount}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const plan = PLAN_CATALOG.find((p) => p.plan === planKey);
  let planAmount = plan?.price[cycle] ?? 0;
  if (plan && isStripeConfigured()) {
    try {
      const id = priceIdFor(planKey, cycle);
      if (id) planAmount = ((await getStripe().prices.retrieve(id)).unit_amount ?? 0) / 100;
    } catch { /* fall back to catalog price */ }
  }
  const heading = plan
    ? `${plan.name} — $${planAmount.toLocaleString()}/${cycle === "yearly" ? "yr" : "mo"}`
    : `${(amount * 10).toLocaleString()} credits — $${amount}`;
  const sub = plan
    ? `${plan.monthlyCredits.toLocaleString()} credits every month. Cancel anytime.`
    : "Secure checkout, right here on Vraelis. Powered by Stripe.";

  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(24px, 3vw, 44px)" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <p className="eyebrow">Checkout</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 6 }}>{heading}</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 24 }}>{sub}</p>
        {plan ? <CheckoutClient plan={planKey} cycle={cycle} /> : <CheckoutClient amount={amount} />}
      </div>
    </section>
  );
}

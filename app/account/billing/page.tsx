import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { BillingPanel } from "../../../components/billing-panel";
import { getBillingState } from "../../../lib/billing-state";
import { getStripePublishableKey, isStripeConfigured } from "../../../lib/stripe";
import { getSubscriptionByEmail, readPricingSnapshot } from "../../../lib/subscriptions";
import { pricingPlanMap, getPricingPlan } from "../../../lib/pricing";
import type { PricingPlanKey } from "../../../lib/pricing";

// v0.1.16: real billing page (was a redirect to /account#billing
// after the v0.1.12 inline-merge). Splitting the surfaces back out
// because /account and /account/billing rendering identical content
// read as a bug to users.

export const metadata: Metadata = {
  title: "Billing",
  description: "Plan, addons, payment, and invoices for your sansxel account.",
};

export default async function AccountBillingPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const stripeReady = isStripeConfigured();
  const publishableKey = getStripePublishableKey();

  const [rawSubscription, billingState] = await Promise.all([
    getSubscriptionByEmail(email),
    stripeReady && email ? getBillingState(email.toLowerCase()) : Promise.resolve(null),
  ]);
  const subscription = readPricingSnapshot(rawSubscription);

  // Reconcile the Supabase subscription snapshot with the Stripe
  // billing state. Comped users (founders, internal) are Pro in our
  // DB but have no Stripe subscription, so getBillingState returns
  // plan: null and BillingPanel falls back to "Free", which
  // contradicts every other place we render their plan. When Stripe
  // doesn't know the plan but our DB does, inject the snapshot's
  // plan so the panel renders Pro · Comped instead of Free.
  const reconciledBilling = (() => {
    if (!billingState) return null;
    if (billingState.plan) return billingState;
    const snapshotKey = subscription.plan.key as PricingPlanKey;
    if (snapshotKey === "free" || !(snapshotKey in pricingPlanMap)) {
      return billingState;
    }
    return { ...billingState, plan: getPricingPlan(snapshotKey) };
  })();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300/85">
          Billing
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Plan, addons, payment, and invoices
        </h1>
        <p className="max-w-xl text-sm leading-6 text-neutral-400">
          Manage your subscription, add or remove addons, update your payment method,
          and download invoices. Credits top up here too.
        </p>
      </header>

      {!stripeReady && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Billing is not configured on this server.
        </div>
      )}

      {stripeReady && reconciledBilling ? (
        <BillingPanel state={reconciledBilling} publishableKey={publishableKey ?? ""} />
      ) : stripeReady ? (
        <p className="text-sm text-neutral-400">
          Sign in to manage your subscription. Visit{" "}
          <Link href="/pricing" className="sansxel-subtle-link">
            pricing
          </Link>{" "}
          to compare plans.
        </p>
      ) : null}
    </div>
  );
}

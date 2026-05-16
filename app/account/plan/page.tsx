import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { BillingPanel } from "../../../components/billing-panel";
import { getBillingState } from "../../../lib/billing-state";
import { getStripePublishableKey, isStripeConfigured } from "../../../lib/stripe";
import { getSubscriptionByEmail, readPricingSnapshot } from "../../../lib/subscriptions";
import { pricingPlanMap, getPricingPlan } from "../../../lib/pricing";
import type { PricingPlanKey } from "../../../lib/pricing";

// Plan + payment method + invoices. Splits the legacy single
// /account/billing one-pager into focused entries under Shop so
// each sidebar item does what its label says.

export const metadata: Metadata = {
  title: "Plan",
  description: "Subscription plan, payment method, and invoices for your VRAELIS account.",
};

export default async function AccountPlanPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const stripeReady = isStripeConfigured();
  const publishableKey = getStripePublishableKey();

  const [rawSubscription, billingState] = await Promise.all([
    getSubscriptionByEmail(email),
    stripeReady && email ? getBillingState(email.toLowerCase()) : Promise.resolve(null),
  ]);
  const subscription = readPricingSnapshot(rawSubscription);
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
          Plan
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Subscription, payment method, and invoices
        </h1>
        <p className="max-w-xl text-sm leading-6 text-neutral-400">
          Pick a tier, swap your card, download receipts. Addons and credits live on their own pages.
        </p>
      </header>

      {!stripeReady && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Billing is not configured on this server.
        </div>
      )}

      {stripeReady && reconciledBilling ? (
        <BillingPanel
          state={reconciledBilling}
          publishableKey={publishableKey ?? ""}
          sections={["payment", "plan", "invoices"]}
        />
      ) : stripeReady ? (
        <p className="text-sm text-neutral-400">
          Sign in to manage your subscription. Visit{" "}
          <Link href="/pricing" className="VRAELIS-subtle-link">
            pricing
          </Link>{" "}
          to compare plans.
        </p>
      ) : null}
    </div>
  );
}

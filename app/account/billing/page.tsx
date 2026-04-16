import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { BillingPanel } from "../../../components/billing-panel";
import { getBillingState } from "../../../lib/billing-state";
import { isStripeConfigured, getStripePublishableKey } from "../../../lib/stripe";
import { getSignInPath } from "../../../lib/auth-ui";

export const metadata = {
  title: "Billing",
  description: "Manage your sansxel subscription, payment method, and invoices.",
};

export default async function AccountBillingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect(getSignInPath("/account/billing"));

  if (!isStripeConfigured()) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
        Billing is not configured yet.
      </div>
    );
  }

  const publishableKey = getStripePublishableKey();
  const state = await getBillingState(session.user.email.toLowerCase());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Billing</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage your plan, addons, payment method, and invoices.
        </p>
      </div>
      <BillingPanel state={state} publishableKey={publishableKey ?? ""} />
    </div>
  );
}

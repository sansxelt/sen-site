// Canonical subscription-checkout return route (V1.1 S1): app.vraelis.com/billing/success.
// The Stripe redirect is NEVER trusted: the webhook is the only activation authority, and this page
// only OBSERVES activation by polling /api/v/me until the webhook's write (plan_v1, plan, or balance)
// becomes visible. The ?session_id is used for DISPLAY ONLY (which plan to say is activating), and only
// after verifying the session belongs to the signed-in owner.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { v1Included, type V1Cycle } from "../../checkout/checkout-v1";
import { ActivationPoller, type PlanDisplay } from "./activation-poller";

export const metadata: Metadata = { title: "Payment received" };

export default async function BillingSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent("/billing/success")}`);

  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]{8,}$/.test(sp.session_id) ? sp.session_id : null;

  // Display-only session lookup: which plan should this page SAY is activating. Ownership-checked
  // (metadata.user_id must be the signed-in owner) and never used to activate anything.
  let expectedPlan: string | null = null;
  let expectedCycle: V1Cycle | null = null;
  if (sessionId && isStripeConfigured()) {
    try {
      const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
      const meta = (checkout.metadata ?? {}) as Record<string, string>;
      const owner = (meta.user_id ?? checkout.client_reference_id ?? "").toLowerCase();
      if (owner === email.toLowerCase() && meta.type === "v_plan" && meta.plan) {
        expectedPlan = meta.plan;
        expectedCycle = meta.cycle === "yearly" ? "yearly" : "monthly";
      }
    } catch { /* display fallback: generic confirmation copy */ }
  }

  // Entitlement copy per plan, precomputed server-side from the catalog so the poller can render the
  // activated plan natively whichever plan the webhook lands.
  const plans: Record<string, PlanDisplay> = {};
  for (const p of PLAN_CATALOG_V1) {
    const cycle: V1Cycle = expectedPlan === p.key && expectedCycle ? expectedCycle : "monthly";
    plans[p.key] = { name: p.name, included: v1Included(p, cycle) };
  }

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Billing</p>
          <h1 className="display">Payment received</h1>
          <p>{email}</p>
        </div>
      </div>
      <ActivationPoller expectedPlan={expectedPlan} expectedCycle={expectedCycle} plans={plans} />
    </div>
  );
}

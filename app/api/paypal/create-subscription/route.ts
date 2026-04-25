import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  createPaypalSubscription,
  getPaypalPlanId,
  isPaypalConfigured,
} from "../../../../lib/paypal";
import { pricingPlanMap, type PricingPlanKey } from "../../../../lib/pricing";
import { APP_URL } from "../../../../lib/stripe";

/**
 * POST /api/paypal/create-subscription
 * Body: { planKey, cycle }
 *
 * Called by the PayPal button in createSubscription() before PayPal
 * opens its own approval flow.  Returns { subscriptionId } which the
 * PayPal JS SDK takes and uses to resolve the popup.
 *
 * The subscription starts in APPROVAL_PENDING — it only becomes ACTIVE
 * after the user approves and our webhook (BILLING.SUBSCRIPTION.ACTIVATED)
 * fires.  Nothing is charged before approval.
 */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    planKey?: string;
    cycle?: string;
  };

  const planKey = payload.planKey?.toLowerCase() as PricingPlanKey | undefined;
  if (!planKey || !(planKey in pricingPlanMap) || planKey === "free" || planKey === "teams" || planKey === "enterprise") {
    return NextResponse.json({ error: "Pick a self-serve plan to subscribe to." }, { status: 400 });
  }

  const cycle: "monthly" | "yearly" = payload.cycle === "yearly" ? "yearly" : "monthly";

  const planId = getPaypalPlanId(planKey, cycle);
  if (!planId) {
    return NextResponse.json(
      { error: `PayPal plan not set up yet. An admin must POST /api/paypal/setup-plans and add PAYPAL_PLAN_${planKey.toUpperCase()}_${cycle.toUpperCase()} to env vars.` },
      { status: 500 },
    );
  }

  try {
    const email = session.user.email.toLowerCase();
    const subscription = await createPaypalSubscription({
      planId,
      userEmail: email,
      returnUrl: `${APP_URL}/checkout/success?plan=${planKey}&cycle=${cycle}&provider=paypal`,
      cancelUrl: `${APP_URL}/checkout?plan=${planKey}&cycle=${cycle}&paypal=canceled`,
      // custom_id lets the webhook match back to our user + plan without
      // needing an extra lookup.
      customId: JSON.stringify({ email, planKey, cycle }),
    });

    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PayPal error.";
    console.error("[paypal create-subscription] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createPaypalOrder, isPaypalConfigured } from "../../../../lib/paypal";
import { billingAddonMap, type BillingAddonKey, planIncludesAddon } from "../../../../lib/pricing";
import { getPlanForEmail } from "../../../../lib/account-billing";

export const runtime = "nodejs";

/**
 * POST /api/paypal/create-addon-order
 * Body: { addonKey }
 *
 * Creates a PayPal Order (one-time CAPTURE intent) for the addon's
 * monthly USD price. Returns { orderId } which the PayPal JS SDK
 * resolves the popup with. After approval the client calls
 * /api/paypal/capture-addon-order to finalize + activate the addon.
 *
 * This sidesteps PayPal subscription plans (no pre-config required)
 * by treating each addon purchase as a single PayPal payment that
 * activates the addon for one billing cycle. Works for both one-time
 * boosts (session_boost, weekly_boost) and recurring addons
 * (copilot_pro_pack, power_pack, billed as 1-month activations).
 */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { addonKey?: string };
  const addonKey = payload.addonKey?.toLowerCase() as BillingAddonKey | undefined;
  if (!addonKey || !(addonKey in billingAddonMap)) {
    return NextResponse.json({ error: "Unknown addon." }, { status: 400 });
  }

  const addon = billingAddonMap[addonKey];
  if (!addon || !(addon.monthlyValue > 0)) {
    return NextResponse.json({ error: "Addon has no purchasable price." }, { status: 400 });
  }

  const email = session.user.email.toLowerCase();

  // v0.1.16, Same plan-inclusion guard as the Stripe path. Don't
  // let PayPal create an order for an addon the user's plan already
  // bundles. The UI hides this case, but a direct API hit would
  // otherwise charge them for something they already get.
  try {
    const currentPlan = await getPlanForEmail(email);
    if (planIncludesAddon(currentPlan, addonKey)) {
      return NextResponse.json(
        {
          error: `Your ${currentPlan} plan already includes ${addonKey.replace(/_/g, " ")}. No need to buy it.`,
        },
        { status: 409 },
      );
    }
  } catch (err) {
    console.warn("[paypal create-addon-order] plan inclusion check failed:", err);
  }

  try {
    const order = await createPaypalOrder({
      amountUsd: addon.monthlyValue,
      description: `sansxel · ${addon.name}`,
      // custom_id round-trips through PayPal so the capture step can
      // identify which addon + user without trusting client-supplied data.
      customId: JSON.stringify({ email, addonKey }),
    });
    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PayPal error.";
    console.error("[paypal create-addon-order] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

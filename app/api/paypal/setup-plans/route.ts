import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { isPaypalConfigured, setupPaypalPlans } from "../../../../lib/paypal";

/**
 * POST /api/paypal/setup-plans
 *
 * One-time admin utility.  Creates a PayPal Product + Monthly + Yearly
 * Billing Plan for every subscription-capable pricing tier, and returns
 * the ids.  Paste them into Vercel env vars as:
 *
 *   PAYPAL_PLAN_APPRENTICE_MONTHLY = P-xxxxx
 *   PAYPAL_PLAN_APPRENTICE_YEARLY  = P-xxxxx
 *   ... etc
 *
 * After redeploying the site picks the ids up and the PayPal button on
 * /checkout starts working for that tier/cycle.
 *
 * ADMIN ONLY. This was previously gated on "is signed in", with a note that it was safe because PayPal
 * charges nothing to create a plan. That reasoning was wrong on two counts: it writes real products and
 * ACTIVE billing plans into the LIVE merchant account, and it RETURNS their ids. Those ids are outside the
 * Vraelis plan catalogue, which made them the raw material for a tier forgery — subscribe to a plan the
 * catalogue does not know, and any code path that fell back to a client-supplied tier would grant it.
 * The fallback is gone (see app/api/paypal/webhook/route.ts), and this route is admin-gated so the
 * unknown-plan primitive is not self-serve either. Mirrors the check its sibling
 * /api/v/paypal/setup-plans already had.
 *
 * isAdminEmail reads ADMIN_EMAILS and fails closed when the var is unset.
 */
export async function POST() {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal credentials are not configured." }, { status: 503 });
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) {
    // Uniform 403 for signed-out and non-admin alike: no signal about whether the route exists for others.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const plans = await setupPaypalPlans();

    // Build a copy-pasteable env var block for the response.
    const envVarLines: string[] = [];
    for (const [key, cycles] of Object.entries(plans)) {
      if (cycles.monthly) envVarLines.push(`PAYPAL_PLAN_${key.toUpperCase()}_MONTHLY=${cycles.monthly}`);
      if (cycles.yearly)  envVarLines.push(`PAYPAL_PLAN_${key.toUpperCase()}_YEARLY=${cycles.yearly}`);
    }

    return NextResponse.json({
      ok: true,
      plans,
      envVarBlock: envVarLines.join("\n"),
      instructions: "Paste envVarBlock into Vercel → Settings → Environment Variables (one line per var), then redeploy.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error("[paypal setup-plans] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

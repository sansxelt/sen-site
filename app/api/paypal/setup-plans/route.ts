import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
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
 * Gated behind simple auth — only logged-in users can call it.  Safe
 * because PayPal itself charges nothing just to create plans.
 */
export async function POST() {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal credentials are not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
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

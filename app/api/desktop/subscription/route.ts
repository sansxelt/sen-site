import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  getPlanForEmail,
  getSubscriptionForEmail,
} from "../../../../lib/account-billing";
import { tiersForPlan } from "../../../../lib/ai-models";

// GET /api/desktop/subscription, returns the signed-in user's plan,
// the tiers their plan unlocks, and (when relevant) the next billing
// renewal date.
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [plan, sub] = await Promise.all([
      getPlanForEmail(email),
      getSubscriptionForEmail(email),
    ]);

    return NextResponse.json({
      plan,
      status: sub?.status ?? "free",
      billing_cycle: sub?.billing_cycle ?? null,
      seat_count: sub?.seat_count ?? 1,
      current_period_end: sub?.current_period_end ?? null,
      tiers: tiersForPlan(plan).map((m) => ({
        tier: m.tier,
        display_name: m.display_name,
        blurb: m.blurb,
      })),
    });
  } catch (err) {
    console.error("desktop/subscription.get failed:", err);
    return NextResponse.json(
      { error: "Could not load subscription." },
      { status: 500 },
    );
  }
}

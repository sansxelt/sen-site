import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  pricingPlans,
  type BillingCycle,
  type PricingPlanKey,
} from "../../../../lib/pricing";
import {
  getSubscriptionByEmail,
  readPricingSnapshot,
  upsertSubscriptionSelection,
} from "../../../../lib/subscriptions";

type SubscriptionPayload = {
  billingCycle?: BillingCycle;
  planKey?: PricingPlanKey;
  seatCount?: number;
};

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const subscription = await getSubscriptionByEmail(email);

  return NextResponse.json({
    plans: pricingPlans,
    subscription: readPricingSnapshot(subscription),
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: SubscriptionPayload;

  try {
    payload = (await request.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const planKey = payload.planKey;

  if (!planKey) {
    return NextResponse.json(
      { error: "Choose a plan before continuing." },
      { status: 400 },
    );
  }

  if (planKey === "enterprise") {
    return NextResponse.json(
      {
        error:
          "Enterprise onboarding is handled manually. Contact support with your verified business details to continue.",
      },
      { status: 400 },
    );
  }

  try {
    const subscription = await upsertSubscriptionSelection(email, {
      billingCycle: payload.billingCycle,
      planKey,
      seatCount: payload.seatCount,
    });

    return NextResponse.json({
      subscription: readPricingSnapshot(subscription),
    });
  } catch (error) {
    console.error("Subscription save failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't save that billing choice right now. Please try again shortly.",
      },
      { status: 400 },
    );
  }
}

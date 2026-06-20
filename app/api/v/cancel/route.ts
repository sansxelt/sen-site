// POST /api/v/cancel — cancel (or resume) the subscription IN-APP, no off-site
// redirect. { action: "cancel" | "resume" } → sets cancel_at_period_end. The
// plan stays active until period end. The webhook syncs state.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscription } from "@/lib/v-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });

  const resume = (await req.json().catch(() => ({})))?.action === "resume";
  const sub = await getSubscription(email);
  if (!sub?.stripe_subscription_id) return NextResponse.json({ error: "no_subscription" }, { status: 404 });

  try {
    await getStripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: !resume });
    return NextResponse.json({ ok: true, canceling: !resume });
  } catch (e) {
    console.error("[v cancel] failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

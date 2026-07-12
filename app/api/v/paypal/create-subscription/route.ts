// POST /api/v/paypal/create-subscription — start a Vraelis Rank plan subscription via PayPal.
// Body: { plan, cycle }. Returns { approveUrl } for the client to redirect to. PayPal handles
// approval; our webhook (/api/v/paypal/webhook) grants credits + sets plan state on payment.
// Needs the plans provisioned first (setup-plans) with PAYPAL_PLAN_<PLAN>_<CYCLE> in env.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { isPaypalConfigured, createPaypalSubscription, vraelisPaypalPlanId } from "@/lib/paypal";
import { APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const CYCLES = new Set(["monthly", "yearly"]);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isPaypalConfigured()) return NextResponse.json({ error: "paypal_unavailable" }, { status: 503 });
  await ensureProfile(email, session?.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const plan = PLANS.has(body?.plan) ? String(body.plan) : "";
  const cycle = CYCLES.has(body?.cycle) ? String(body.cycle) : "monthly";
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const planId = vraelisPaypalPlanId(plan, cycle);
  if (!planId) return NextResponse.json({ error: "plan_unavailable", plan, cycle }, { status: 503 });

  try {
    const sub = await createPaypalSubscription({
      planId,
      userEmail: email,
      returnUrl: `${SITE}/plans?paypal_sub=1`,
      cancelUrl: `${SITE}/plans?paypal_cancel=1`,
      // Round-trips through PayPal so the webhook can attribute payments to this user + plan.
      customId: JSON.stringify({ type: "v_plan", email, plan, cycle }),
    });
    const approve = sub.links?.find((l) => l.rel === "approve")?.href;
    if (!approve) return NextResponse.json({ error: "no_approve_url" }, { status: 500 });
    return NextResponse.json({ subscriptionId: sub.id, approveUrl: approve });
  } catch (e) {
    console.error("[v paypal create-subscription] failed:", e);
    return NextResponse.json({ error: "paypal_error" }, { status: 500 });
  }
}

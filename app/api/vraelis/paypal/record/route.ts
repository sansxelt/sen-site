// After the user approves a PayPal subscription in the browser, the
// client posts the subscription id here. We verify it with PayPal
// (server-side, using the secret) and record the plan on the workspace.
//
// SECURITY (finding H1): the tier is derived ONLY from the plan_id PayPal
// reports on the verified subscription. The request body contributes nothing
// but the subscription id. Previously this route took `plan` and `cycle` from
// the body and validated them merely as syntactically valid enum members, so
// any caller holding the cheapest subscription could post plan:"growth" and cut
// the platform's take (cutRateFor) from 20% to 5% on every booking and payment.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isSubscriptionClaimedByAnother, setWorkspacePlan } from "@/lib/vraelis-db";
import { vraelisPlanFromPaypalPlanId, vraelisPlanStatusFromPaypal } from "@/lib/vraelis-plans";

const PP_BASE =
  (process.env.PAYPAL_ENV ?? "").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function paypalToken(): Promise<string | null> {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!cid || !secret) return null;
  const auth = Buffer.from(`${cid}:${secret}`).toString("base64");
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // The subscription id is the ONLY thing we accept from the caller. Any `plan`
  // or `cycle` in the body is deliberately ignored, not validated — there is no
  // client-supplied tier to validate.
  const subscriptionId = String(body.subscriptionID ?? "");
  if (!subscriptionId) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  try {
    const token = await paypalToken();
    if (!token) return NextResponse.json({ ok: false, error: "PayPal not configured" }, { status: 500 });

    const subRes = await fetch(`${PP_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!subRes.ok) {
      return NextResponse.json({ ok: false, error: "Subscription not found" }, { status: 400 });
    }
    const sub = (await subRes.json()) as {
      status?: string;
      plan_id?: string;
      billing_info?: { next_billing_time?: string };
    };

    // Canonical tier, from PayPal's plan_id. Unknown plan id → fail closed.
    const tier = vraelisPlanFromPaypalPlanId(sub.plan_id);
    if (!tier) {
      console.warn("[paypal record] unrecognised plan_id on subscription", subscriptionId);
      return NextResponse.json({ ok: false, error: "Unrecognized plan" }, { status: 400 });
    }

    // Only a genuinely paid, live subscription grants an entitlement. APPROVED
    // and APPROVAL_PENDING mean the buyer consented but no money has moved.
    const status = vraelisPlanStatusFromPaypal(sub.status);
    if (status !== "active") {
      return NextResponse.json(
        { ok: false, error: `Subscription ${sub.status ?? "unknown"} is not active` },
        { status: 400 },
      );
    }

    // One subscription funds one workspace: refuse a subscription id already
    // recorded against a different account.
    if (await isSubscriptionClaimedByAnother(subscriptionId, email)) {
      return NextResponse.json({ ok: false, error: "Subscription already claimed" }, { status: 409 });
    }

    // Persist the subscription id + next billing date so the reconcile cron can
    // re-poll PayPal and self-heal a cancel/expire even if the webhook never
    // routes this sub (Vraelis PayPal subs are created without a custom_id).
    const nextBilling = sub.billing_info?.next_billing_time;
    const periodEndISO = nextBilling ? new Date(nextBilling).toISOString() : null;
    await setWorkspacePlan(email, {
      plan: tier.plan,
      cycle: tier.cycle,
      status: "active",
      provider: "paypal",
      subscriptionId,
      periodEndISO,
    });
    // Echo the server-derived tier so the client renders what was actually
    // granted rather than what it asked for.
    return NextResponse.json({ ok: true, plan: tier.plan, cycle: tier.cycle });
  } catch (error) {
    console.error("paypal record failed:", error);
    return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 500 });
  }
}

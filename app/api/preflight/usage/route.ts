// GET /api/preflight/usage — the signed-in owner's current subscription-month usage for the _v1 plans
// (pricing cutover step 11). Session-authenticated and owner-scoped; 404 until VRAELIS_PASS_PRICING=1 so
// the flag-off world is unchanged. Returns { subscribed: false } without an active _v1 plan, else the
// passes-equivalent used ("3.4 of 10 passes"), the plan's monthly pass count, and when the anchor-based
// window ends (docs/pricing-verdict-final.md: windows are computed from the subscription anchor at
// request time, which is what releases annual usage month by month). The UI degrades to absent on any
// non-OK response, so this route may fail closed freely.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { passPricingEnabled, planV1, monthlyWindow, passesEquivalent } from "@/lib/preflight/pass-pricing";
import { getPlanV1State, flowUnitsUsedInWindow } from "@/lib/preflight/entitlements-v1";

export const runtime = "nodejs";

export async function GET() {
  if (!passPricingEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const owner = email.toLowerCase();
  const state = await getPlanV1State(owner);
  const plan = state ? planV1(state.plan) : null;
  // No plan, or a plan whose anchor never landed (webhook raced/degraded): report unsubscribed rather
  // than invent a window — the plans page simply omits the usage line.
  if (!plan || !state?.anchor) return NextResponse.json({ subscribed: false });

  const nowIso = new Date().toISOString();
  const { end } = monthlyWindow(state.anchor, nowIso);
  const units = await flowUnitsUsedInWindow(owner, state.anchor, nowIso);
  return NextResponse.json({
    subscribed: true,
    plan: plan.key,
    cycle: state.cycle,
    passesUsed: passesEquivalent(units, plan),
    passesPerMonth: plan.passesPerMonth,
    windowEnd: end,
  });
}

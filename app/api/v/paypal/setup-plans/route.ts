// POST /api/v/paypal/setup-plans — one-time provisioning (admin only). Creates the PayPal
// products + billing plans for every Vraelis tier and returns their ids. Copy the returned
// ids into env as PAYPAL_PLAN_<PLAN>_<CYCLE>, then subscriptions work. Re-running creates NEW
// plans, so run it once.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPaypalConfigured, setupVraelisPaypalPlans } from "@/lib/paypal";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAdmin(email: string): boolean {
  const list = `${process.env.ADMIN_EMAILS || ""},${process.env.VRAELIS_ADMIN || ""}`
    .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdmin(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isPaypalConfigured()) return NextResponse.json({ error: "paypal_unavailable" }, { status: 503 });

  try {
    const plans = await setupVraelisPaypalPlans();
    // Also emit the ready-to-paste env lines.
    const env: string[] = [];
    for (const [plan, ids] of Object.entries(plans)) {
      env.push(`PAYPAL_PLAN_${plan.toUpperCase()}_MONTHLY=${ids.monthly}`);
      env.push(`PAYPAL_PLAN_${plan.toUpperCase()}_YEARLY=${ids.yearly}`);
    }
    return NextResponse.json({ ok: true, plans, env });
  } catch (e) {
    console.error("[v paypal setup-plans] failed:", e);
    return NextResponse.json({ error: "setup_failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

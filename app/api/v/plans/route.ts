// GET /api/v/plans — live plan prices straight from Stripe, so the UI always
// shows exactly what will be charged (no hardcoded drift). Missing/unset price
// ids come back available:false so the UI can disable that plan.

import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { PLAN_CATALOG, priceIdFor, type PlanCycle } from "@/lib/v-plans";

export const runtime = "nodejs";
export const revalidate = 300; // cache 5 min — prices rarely change

type Cell = { available: boolean; amount?: number; interval?: string };

export async function GET() {
  if (!isStripeConfigured()) return NextResponse.json({ plans: {} });
  const stripe = getStripe();
  const out: Record<string, Record<string, Cell>> = {};

  await Promise.all(
    PLAN_CATALOG.flatMap((p) =>
      (["monthly", "yearly"] as PlanCycle[]).map(async (cycle) => {
        (out[p.plan] ??= {});
        const id = priceIdFor(p.plan, cycle);
        if (!id) { out[p.plan][cycle] = { available: false }; return; }
        try {
          const pr = await stripe.prices.retrieve(id);
          out[p.plan][cycle] = { available: !!pr.active, amount: (pr.unit_amount ?? 0) / 100, interval: pr.recurring?.interval };
        } catch {
          out[p.plan][cycle] = { available: false };
        }
      }),
    ),
  );

  return NextResponse.json({ plans: out });
}

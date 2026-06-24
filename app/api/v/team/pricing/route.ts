// GET /api/v/team/pricing — public, SAFE team-seat pricing. Returns per-seat unit
// amounts + interval availability only (NO price/Stripe ids). Used by /pricing and the
// owner team card. Cached in-memory in the lib.
import { NextResponse } from "next/server";
import { teamSeatPricing } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function GET() {
  const pricing = await teamSeatPricing();
  return NextResponse.json(pricing);
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// RETIRED (and previously exploitable). This route activated the addon named by the CLIENT
// request body rather than by the captured order, so a cheap order could claim an expensive
// addon. The whole addon flow belongs to the previous product (boost_credits), which Vraelis
// Rank no longer uses, so it is disabled outright. PayPal now grants Vraelis credits via
// /api/v/paypal/capture-order, which derives the amount from PayPal's capture, not the client.
export async function POST() {
  return NextResponse.json({ error: "This purchase flow has been retired." }, { status: 410 });
}

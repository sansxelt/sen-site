import { NextResponse } from "next/server";

export const runtime = "nodejs";

// RETIRED. The PayPal "addon" purchase flow belonged to the previous product (boost_credits /
// plan addons), which no longer exists in Vraelis Rank. It also trusted a client-supplied
// addon key, so it is disabled outright now that PayPal is wired for Vraelis credit top-ups
// via /api/v/paypal/*. Kept as a 410 stub so any stray old client just fails safely.
export async function POST() {
  return NextResponse.json({ error: "This purchase flow has been retired." }, { status: 410 });
}

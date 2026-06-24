// POST /api/v/team/checkout — start a team-seat subscription checkout for the OWNER's
// workspace. Returns a Stripe-hosted URL. Gated on STRIPE_TEAM_SEAT_PRICE_ID.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ownedWorkspaceForBilling } from "@/lib/v-workspace";
import { startTeamCheckout, type BillingInterval } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const interval: BillingInterval = body?.interval === "yearly" ? "yearly" : "monthly";
  const ws = await ownedWorkspaceForBilling(email, (await cookies()).get("vws")?.value);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  const res = await startTeamCheckout(ws.id, email, session.user?.name ?? null, interval);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "not_configured" ? 503 : 500 });
  return NextResponse.json({ url: res.url });
}

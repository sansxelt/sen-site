// GET /api/v/team/billing — safe team-seat state for the signed-in OWNER's workspace.
// Never returns Stripe customer/subscription ids.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ownedWorkspaceForBilling } from "@/lib/v-workspace";
import { teamSeatState } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const ws = await ownedWorkspaceForBilling(email, (await cookies()).get("vws")?.value);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  return NextResponse.json(await teamSeatState(ws.id));
}

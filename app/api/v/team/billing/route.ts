// GET /api/v/team/billing — safe team-seat state for the signed-in OWNER's workspace.
// Never returns Stripe customer/subscription ids.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { billingManageableWorkspace } from "@/lib/v-workspace";
import { teamSeatState } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  // Owner OR billing admin of the selected workspace sees its state; otherwise their own
  // (a workspace they don't manage falls back to personal — never the owner's billing).
  const ws = await billingManageableWorkspace(email, (await cookies()).get("vws")?.value);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  return NextResponse.json(await teamSeatState(ws.id));
}

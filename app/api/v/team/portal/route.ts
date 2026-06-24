// POST /api/v/team/portal — open the Stripe billing portal for the OWNER's workspace
// team-seat subscription (manage seats / payment / cancel). Returns a hosted URL.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ownedWorkspaceForBilling } from "@/lib/v-workspace";
import { openTeamPortal } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const intent = body?.intent === "invoices" ? "invoices" : "manage";
  const ws = await ownedWorkspaceForBilling(email, (await cookies()).get("vws")?.value);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  const res = await openTeamPortal(ws.id, email, session.user?.name ?? null, intent);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "billing_unavailable" || res.error === "not_configured" ? 503 : 500 });
  return NextResponse.json({ url: res.url });
}

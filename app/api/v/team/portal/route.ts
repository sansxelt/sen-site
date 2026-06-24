// POST /api/v/team/portal — open the Stripe billing portal for the OWNER's workspace
// team-seat subscription (manage seats / payment / cancel). Returns a hosted URL.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { billingManageableWorkspace } from "@/lib/v-workspace";
import { openTeamPortal } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const intent = body?.intent === "invoices" ? "invoices" : "manage";
  // Owner OR billing admin of the selected workspace; selecting one they can't manage 403s.
  const ws = await billingManageableWorkspace(email, (await cookies()).get("vws")?.value);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  if (ws.unauthorizedSelection) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const res = await openTeamPortal(ws.id, email, session.user?.name ?? null, intent, ws.isOwner ? "owner" : "admin");
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "billing_unavailable" || res.error === "not_configured" ? 503 : 500 });
  return NextResponse.json({ url: res.url });
}

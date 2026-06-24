// POST /api/v/team/portal — open the Stripe billing portal for the OWNER's workspace
// team-seat subscription (manage seats / payment / cancel). Returns a hosted URL.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreatePersonalWorkspace } from "@/lib/v-workspace";
import { openTeamPortal } from "@/lib/v-team-billing";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const ws = await getOrCreatePersonalWorkspace(email);
  if (!ws) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  const res = await openTeamPortal(ws.id, email, session.user?.name ?? null);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.error === "billing_unavailable" || res.error === "not_configured" ? 503 : 500 });
  return NextResponse.json({ url: res.url });
}

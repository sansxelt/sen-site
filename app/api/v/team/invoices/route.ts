// GET /api/v/team/invoices — recent team-billing invoices for the selected workspace.
// Owner OR billing-admin only; SAFE fields (no Stripe ids). POST logs an invoice-open.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { billingManageableWorkspace } from "@/lib/v-workspace";
import { listTeamInvoices } from "@/lib/v-team-billing";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const acc = await billingManageableWorkspace(email, (await cookies()).get("vws")?.value);
  if (!acc) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  if (acc.unauthorizedSelection) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const invoices = await listTeamInvoices(acc.id);
  await logEvent({ userId: email.trim().toLowerCase(), eventType: "team_invoices_viewed", actorType: acc.isOwner ? "owner" : "admin", source: "web", metadata: { workspace_id: acc.id, action: "view", count: invoices.length } });
  return NextResponse.json({ invoices });
}

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const acc = await billingManageableWorkspace(email, (await cookies()).get("vws")?.value);
  if (!acc || acc.unauthorizedSelection) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await logEvent({ userId: email.trim().toLowerCase(), eventType: "team_invoice_opened", actorType: acc.isOwner ? "owner" : "admin", source: "web", metadata: { workspace_id: acc.id, action: "open" } });
  return NextResponse.json({ ok: true });
}

// POST /api/v/account/delete — INTAKE ONLY. Creates a confirm-gated account
// deletion REQUEST that an admin reviews manually. It deletes nothing: no user
// row, tests, reports, billing, keys, webhooks, assets, Stripe records, or events.
// Real deletion stays a manual, dedicated data-safety pass.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDataRequest } from "@/lib/v-data-requests";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const confirm = String((await req.json().catch(() => ({})))?.confirm || "");
  if (confirm !== "DELETE MY ACCOUNT") return NextResponse.json({ error: "confirm_required" }, { status: 400 });
  const r = await createDataRequest(email, "account_deletion", "Account deletion requested from account settings.");
  if (!r.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, message: "Your account deletion request has been received and will be reviewed manually." });
}

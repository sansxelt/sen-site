// POST /api/v/workspace/ownership-transfer/[id]/accept — the TARGET accepts a pending
// ownership transfer and starts a team-billing checkout under their own customer.
// Returns a Stripe-hosted checkout URL. Target-only; no Stripe ids exposed.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptOwnershipTransfer } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const res = await acceptOwnershipTransfer(email, id);
  if (!res.ok) {
    const status = res.error === "not_found" ? 404 : res.error === "forbidden" ? 403 : res.error === "not_configured" ? 503 : 409;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, url: res.url });
}

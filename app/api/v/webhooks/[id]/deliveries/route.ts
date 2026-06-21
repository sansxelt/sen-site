// GET  /api/v/webhooks/[id]/deliveries          — recent delivery log.
// POST /api/v/webhooks/[id]/deliveries {deliveryId} — retry one failed delivery now.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDeliveries, retryDelivery } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ deliveries: await listDeliveries(email, id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const deliveryId = String((await req.json().catch(() => ({})))?.deliveryId || "");
  if (!deliveryId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const res = await retryDelivery(email, id, deliveryId);
  if (res.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res);
}

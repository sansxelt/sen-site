// GET /api/v/webhooks/[id]/deliveries — recent delivery log for the endpoint.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDeliveries } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ deliveries: await listDeliveries(email, id) });
}

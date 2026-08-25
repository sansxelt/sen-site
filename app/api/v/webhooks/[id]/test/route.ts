// POST /api/v/webhooks/[id]/test — send a sample test.completed to the endpoint.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { limitOr429 } from "@/lib/vraelis-ratelimit";
import { auth } from "@/auth";
import { sendTestEvent } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  // This drives an outbound POST to a customer-supplied URL. Authenticated, but unlimited it is a
  // request-amplification relay: one cheap account, unbounded traffic aimed wherever the endpoint points.
  const limited = await limitOr429(req, `webhook-test:${email}`, 10, 600);
  if (limited) return limited;
  const { id } = await params;
  const res = await sendTestEvent(email, id);
  if (res.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res);
}

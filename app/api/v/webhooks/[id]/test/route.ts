// POST /api/v/webhooks/[id]/test — send a sample test.completed to the endpoint.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendTestEvent } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const res = await sendTestEvent(email, id);
  if (res.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(res);
}

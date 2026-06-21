// GET  /api/v/webhooks/[id]/secret — reveal the signing secret (owner only).
// POST /api/v/webhooks/[id]/secret — rotate it (returns the new secret).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { revealWebhookSecret, rotateWebhookSecret } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const secret = await revealWebhookSecret(email, id);
  if (!secret) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ secret });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const secret = await rotateWebhookSecret(email, id);
  if (!secret) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ secret });
}

// PATCH /api/v/webhooks/[id] {enabled?, url?} — update. DELETE — remove.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateWebhook, deleteWebhook } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: { enabled?: boolean; url?: string } = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.url === "string") patch.url = body.url.trim();
  const res = await updateWebhook(email, id, patch);
  if (!res.ok) return NextResponse.json({ error: res.error || "not_found" }, { status: res.error ? 400 : 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  await deleteWebhook(email, id);
  return NextResponse.json({ ok: true });
}

// GET  /api/v/webhooks      — list the owner's webhook endpoints (no secrets).
// POST /api/v/webhooks {url} — create one; returns the secret ONCE.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listWebhooks, createWebhook } from "@/lib/v-webhooks";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  return NextResponse.json({ webhooks: await listWebhooks(email) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const url = String((await req.json().catch(() => ({})))?.url || "").trim();
  const res = await createWebhook(email, url);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}

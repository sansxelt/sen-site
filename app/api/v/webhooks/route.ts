// GET  /api/v/webhooks      — list the owner's webhook endpoints (no secrets).
// POST /api/v/webhooks {url} — create one; returns the secret ONCE.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listWebhooks, createWebhook } from "@/lib/v-webhooks";

export const runtime = "nodejs";

// Env-overridable so it can be raised without a deploy.
const MAX_WEBHOOKS_PER_USER = Number(process.env.MAX_WEBHOOKS_PER_USER || 20) || 20;

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

  // RESOURCE CAP. Each endpoint is an outbound destination this server will POST to on every
  // matching event, so an unbounded set is a request-amplification primitive as well as a
  // configuration mess. Counts only live endpoints.
  const existingHooks = await listWebhooks(email);
  if (existingHooks.length >= MAX_WEBHOOKS_PER_USER) {
    return NextResponse.json(
      { error: "webhook_limit_reached", limit: MAX_WEBHOOKS_PER_USER },
      { status: 409 },
    );
  }
  const url = String((await req.json().catch(() => ({})))?.url || "").trim();
  const res = await createWebhook(email, url);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(res);
}

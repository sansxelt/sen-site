// Account deletion is NOT self-serve yet. This endpoint intentionally performs no
// destructive action. Real deletion needs a dedicated data-safety pass (Stripe
// subscription + customer records, public report links, billing retention rules,
// credits, API keys, webhooks, and accidental-deletion guards). Until then,
// deletion is handled manually via support (help@vraelis.com).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  return NextResponse.json(
    { error: "not_available", message: "Email help@vraelis.com to request account deletion." },
    { status: 503 },
  );
}

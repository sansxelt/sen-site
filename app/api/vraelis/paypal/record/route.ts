// After the user approves a PayPal subscription in the browser, the
// client posts the subscription id here. We verify it with PayPal
// (server-side, using the secret) and record the plan on the workspace.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { setWorkspacePlan } from "@/lib/vraelis-db";
import { isCycle, isPlanKey } from "@/lib/vraelis-plans";

const PP_BASE =
  (process.env.PAYPAL_ENV ?? "").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function paypalToken(): Promise<string | null> {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!cid || !secret) return null;
  const auth = Buffer.from(`${cid}:${secret}`).toString("base64");
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const subscriptionId = String(body.subscriptionID ?? "");
  const plan = String(body.plan ?? "");
  const cycle = String(body.cycle ?? "");
  if (!subscriptionId || !isPlanKey(plan) || !isCycle(cycle)) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  try {
    const token = await paypalToken();
    if (!token) return NextResponse.json({ ok: false, error: "PayPal not configured" }, { status: 500 });

    const subRes = await fetch(`${PP_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sub = (await subRes.json()) as { status?: string };
    const ok = sub.status === "ACTIVE" || sub.status === "APPROVED";
    if (!ok) {
      return NextResponse.json({ ok: false, error: `Subscription ${sub.status ?? "unknown"}` }, { status: 400 });
    }

    await setWorkspacePlan(email, { plan, cycle, status: "active", provider: "paypal" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("paypal record failed:", error);
    return NextResponse.json({ ok: false, error: "Verification failed" }, { status: 500 });
  }
}

// POST /api/v/share — owner-only. Enable / disable / regenerate a test's public
// read-only share link. { testId, action }. setShare verifies ownership.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setShare } from "@/lib/v-db";
import { APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL || "https://vraelis.com";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const testId = String(body?.testId || "");
  const action = body?.action;
  if (!testId || !["enable", "disable", "regenerate"].includes(action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const res = await setShare(testId, email, action);
  if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = res.enabled && res.token ? `${SITE_URL}/r/${res.token}` : null;
  return NextResponse.json({ enabled: res.enabled, token: res.token, url });
}

// Admin data-request queue. GET lists all requests; POST changes status / adds a
// note. ADMIN ONLY (VRAELIS_ADMIN allowlist, same gate as the audit view).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";
import { listAllRequests, updateRequest, type RequestStatus } from "@/lib/v-data-requests";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") || undefined;
  return NextResponse.json({ requests: await listAllRequests(status) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!isAdmin(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const r = await updateRequest(email!, id, { status: body?.status as RequestStatus | undefined, note: typeof body?.note === "string" ? body.note : undefined });
  return NextResponse.json({ ok: r.ok });
}

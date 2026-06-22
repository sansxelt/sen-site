// User data/privacy requests. POST creates a request (export, correction, or a
// privacy question); GET lists the signed-in user's own requests. Account deletion
// goes through /api/v/account/delete (confirm-gated). Intake only — never destructive.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDataRequest, listMyRequests } from "@/lib/v-data-requests";

export const runtime = "nodejs";

const ALLOWED = new Set(["data_export", "data_correction", "privacy_question"]);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || "");
  if (!ALLOWED.has(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  const r = await createDataRequest(email, type as "data_export" | "data_correction" | "privacy_question", String(body?.message || ""));
  if (!r.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, id: r.id });
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ requests: [] });
  return NextResponse.json({ requests: await listMyRequests(email) });
}

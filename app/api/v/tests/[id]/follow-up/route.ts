// POST /api/v/tests/[id]/follow-up — launch a one-click confirmation round from an
// evaluation whose decision isn't ready. Owner or editor+ only. Reuses the normal launch
// path (credit escrow + plan checks). Body: { type, target?, title? }.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFollowup } from "@/lib/v-followup";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || "");
  const target = body?.target ? parseInt(String(body.target), 10) : undefined;
  const titleOverride = typeof body?.title === "string" ? body.title : undefined;
  const res = await createFollowup(email, id, type, target, titleOverride);
  if (!res.ok) {
    const status = res.error === "forbidden" ? 403 : res.error === "not_found" ? 404 : res.error === "insufficient_credits" ? 402 : res.error === "plan_limit" ? 403 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, id: res.id, url: res.url, target: res.target, type: res.type });
}

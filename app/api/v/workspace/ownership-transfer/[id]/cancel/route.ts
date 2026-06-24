// POST /api/v/workspace/ownership-transfer/[id]/cancel — the current owner cancels a
// pending ownership transfer. Owner-only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelOwnershipTransfer } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const res = await cancelOwnershipTransfer(email, id);
  if (!res.ok) {
    const status = res.error === "not_found" ? 404 : res.error === "forbidden" ? 403 : 409;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true });
}

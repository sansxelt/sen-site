// POST /api/v/workspace/members/[id]/billing-admin — owner grants/revokes billing-admin
// on an active internal member. Body: { value: boolean }. Owner-only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setBillingAdmin } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await setBillingAdmin(email, id, body?.value === true);
  if (!res.ok) {
    const status = res.error === "not_found" ? 404 : res.error === "forbidden" ? 403 : res.error === "not_eligible" ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/v/workspace/members/[id] — change role. DELETE — revoke. Owner/admin only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { changeMemberRole, revokeMember, type Role } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const role = String((await req.json().catch(() => ({})))?.role || "") as Role;
  const res = await changeMemberRole(email, id, role);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const res = await revokeMember(email, id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

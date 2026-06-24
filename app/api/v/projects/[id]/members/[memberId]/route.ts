// PATCH /api/v/projects/[id]/members/[memberId] — change role. DELETE — revoke.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { changeProjectMemberRole, revokeProjectMember, type ProjectRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { memberId } = await params;
  const role = String((await req.json().catch(() => ({})))?.role || "") as ProjectRole;
  const res = await changeProjectMemberRole(email, memberId, role);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { memberId } = await params;
  const res = await revokeProjectMember(email, memberId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

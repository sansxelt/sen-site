// GET  /api/v/projects/[id]/members — list project members (manager only).
// POST /api/v/projects/[id]/members — invite by email to THIS project only.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listProjectMembers, inviteProjectMember, canManageProjectMembers, type ProjectRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  if (!(await canManageProjectMembers(email, id))) return NextResponse.json({ error: "forbidden", members: [] }, { status: 403 });
  return NextResponse.json({ members: await listProjectMembers(email, id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await inviteProjectMember(email, id, String(body?.email || ""), String(body?.role || "client_viewer") as ProjectRole);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

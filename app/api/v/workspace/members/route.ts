// POST /api/v/workspace/members — invite a member by email (owner/admin only).
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { inviteMember, getOrCreatePersonalWorkspace, type Role } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const inviteEmail = String(body?.email || "").trim();
  const role = String(body?.role || "viewer") as Role;
  // workspace_id optional — defaults to the actor's personal workspace.
  let workspaceId = typeof body?.workspace_id === "string" ? body.workspace_id : "";
  if (!workspaceId) { const ws = await getOrCreatePersonalWorkspace(email); workspaceId = ws?.id ?? ""; }
  if (!workspaceId) return NextResponse.json({ error: "no_workspace" }, { status: 400 });
  const res = await inviteMember(email, workspaceId, inviteEmail, role);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

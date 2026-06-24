// POST /api/v/workspace/transfer-owner — transfer workspace ownership to an active
// internal member. Owner-only; blocked while team billing is active. Body:
// { workspace_id, target_member_id, confirmation }. Returns no Stripe ids.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transferWorkspaceOwnership } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await transferWorkspaceOwnership(email, String(body?.workspace_id || ""), String(body?.target_member_id || ""), String(body?.confirmation || ""));
  if (!res.ok) {
    const status = res.error === "forbidden" ? 403 : res.error === "billing_active" ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, workspace_id: res.workspace_id, old_role: res.old_role, new_role: res.new_role });
}

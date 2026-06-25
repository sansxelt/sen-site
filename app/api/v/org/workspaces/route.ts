// POST /api/v/org/workspaces — link or unlink a workspace to/from the caller's organization.
// action: link | unlink. Only a user who OWNS the workspace (and, for link, manages the org)
// can do this. Billing is NEVER moved — it stays workspace-level.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { linkWorkspaceToOrganization, unlinkWorkspaceFromOrganization } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) => (e === "forbidden" ? 403 : e === "no_organization" || e === "no_workspace" ? 400 : e === "unavailable" ? 503 : 500);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body?.workspaceId ?? "");
  let res;
  if (body?.action === "link") res = await linkWorkspaceToOrganization(email, workspaceId);
  else if (body?.action === "unlink") res = await unlinkWorkspaceFromOrganization(email, workspaceId);
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true });
}

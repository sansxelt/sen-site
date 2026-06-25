// POST /api/v/org/members — manage organization members. action: add | role | revoke.
// Owner/admin only (enforced in lib). The org is resolved server-side from the caller's
// primary org, so no org id is trusted from the client.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addOrganizationMember, setOrganizationMemberRole, revokeOrganizationMember, type OrgRole } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "forbidden" ? 403 : e === "no_organization" || e === "not_found" ? 404 : e.startsWith("invalid") ? 400 : e === "already_member" ? 409 : e.startsWith("cannot_") ? 400 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const role = body?.role as OrgRole;
  let res;
  if (action === "add") res = await addOrganizationMember(email, typeof body?.email === "string" ? body.email : "", role);
  else if (action === "role") res = await setOrganizationMemberRole(email, String(body?.memberId ?? ""), role);
  else if (action === "revoke") res = await revokeOrganizationMember(email, String(body?.memberId ?? ""));
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true });
}

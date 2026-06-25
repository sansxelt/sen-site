// POST /api/v/org/join — a signed-in user requests access to (or auto-joins, if the org enables
// it) an organization whose VERIFIED domain matches their email domain. action: request | cancel.
// Eligibility is re-validated server-side against the caller's authenticated email domain — a
// client can never request access to an org their domain doesn't match. Never grants more than a
// safe org role; never touches workspace/project/billing/API access.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requestOrganizationAccess, cancelOrganizationJoinRequest } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "not_eligible" || e === "join_disabled" || e === "domain_paused" ? 403 : e === "not_found" ? 404 : e === "already_member" ? 409 : e === "no_domain" ? 400 : e === "unavailable" ? 503 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const orgId = String(body?.organizationId ?? "");
  let res;
  if (body?.action === "request") res = await requestOrganizationAccess(email, orgId);
  else if (body?.action === "cancel") res = await cancelOrganizationJoinRequest(email, orgId);
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json(res);
}

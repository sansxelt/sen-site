// POST /api/v/org/domains — manage org domains. action: add | verify | regenerate | remove.
// Owner/admin only (enforced in lib). The org is resolved server-side from the caller — no org
// id is trusted. Real DNS TXT verification runs here, so force the Node runtime (DNS needs it).
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addOrganizationDomain, verifyOrganizationDomain, regenerateOrganizationDomainToken, removeOrganizationDomain } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "forbidden" ? 403 : e === "no_organization" || e === "not_found" ? 404 : e === "invalid_domain" || e === "no_token" ? 400 : e === "already_added" || e === "already_verified" ? 409 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body?.action || (typeof body?.domain === "string" ? "add" : null);
  const domainId = String(body?.domainId ?? "");
  let res;
  if (action === "add") res = await addOrganizationDomain(email, typeof body?.domain === "string" ? body.domain : "");
  else if (action === "verify") res = await verifyOrganizationDomain(email, domainId);
  else if (action === "regenerate") res = await regenerateOrganizationDomainToken(email, domainId);
  else if (action === "remove") res = await removeOrganizationDomain(email, domainId);
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json(res); // ok + safe fields (raw token on add/regenerate; never the hash)
}

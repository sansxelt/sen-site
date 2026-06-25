// POST /api/v/org/domains — add a domain to the caller's organization (scaffold for future
// SSO / provisioning). Owner/admin only. Returns the DNS TXT record ONCE; the raw token is
// never stored or logged. No automatic DNS verification and no auto-join in v1.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addOrganizationDomain } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) => (e === "forbidden" ? 403 : e === "no_organization" ? 404 : e === "invalid_domain" ? 400 : e === "already_added" ? 409 : 500);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await addOrganizationDomain(email, typeof body?.domain === "string" ? body.domain : "");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true, domain: res.domain, txtName: res.txtName, txtValue: res.txtValue });
}

// POST /api/v/org/provisioning — owner/admin updates verified-domain provisioning settings:
// joinMode (disabled|request|auto_member) + defaultRole (member|viewer). Never allows a privileged
// default role. Org resolved server-side from the caller.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateOrganizationProvisioningSettings } from "@/lib/v-organization";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "forbidden" ? 403 : e === "no_organization" ? 404 : e === "invalid_mode" || e === "invalid_role" ? 400 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await updateOrganizationProvisioningSettings(email, String(body?.joinMode ?? ""), String(body?.defaultRole ?? ""));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json({ ok: true });
}

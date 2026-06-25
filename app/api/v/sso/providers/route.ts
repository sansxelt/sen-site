// POST /api/v/sso/providers — owner/admin manages org SSO providers. action: save | enable |
// disable | delete. Org resolved server-side from the caller. The client secret is write-only
// (encrypted at rest) and never returned.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertSsoProvider, setSsoProviderStatus, deleteSsoProvider, type SsoInput } from "@/lib/v-sso";

export const runtime = "nodejs";

const status = (e: string) =>
  e === "forbidden" ? 403 : e === "no_organization" || e === "not_found" ? 404 : e === "saml_not_enabled" ? 501 : e.startsWith("invalid") || e === "domain_not_verified" || e === "incomplete_config" ? 400 : 500;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  let res;
  if (action === "save") res = await upsertSsoProvider(email, (body?.provider ?? {}) as SsoInput);
  else if (action === "enable") res = await setSsoProviderStatus(email, String(body?.providerId ?? ""), "active");
  else if (action === "disable") res = await setSsoProviderStatus(email, String(body?.providerId ?? ""), "disabled");
  else if (action === "delete") res = await deleteSsoProvider(email, String(body?.providerId ?? ""));
  else return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: status(res.error) });
  return NextResponse.json(res);
}

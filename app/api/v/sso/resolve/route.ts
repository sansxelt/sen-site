// POST /api/v/sso/resolve — the /sso page posts a work email; if an ACTIVE SSO provider serves
// that email's verified domain, returns the provider start URL to redirect to. Enumeration-safe:
// the response shape is identical whether or not a provider exists for unknown emails (the page
// shows the same neutral message), and no org details are exposed.
import { NextResponse } from "next/server";
import { resolveSsoForEmail } from "@/lib/v-sso";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: true, redirect: null });
  const provider = await resolveSsoForEmail(email);
  // OIDC is live; SAML is scaffold-only, so only OIDC produces a real start URL.
  const redirect = provider && provider.type === "oidc" ? `/api/v/sso/oidc/${provider.providerId}/start` : null;
  return NextResponse.json({ ok: true, redirect });
}
